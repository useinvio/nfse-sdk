/**
 * Test helpers: a throwaway ICP-Brasil-style A1 certificate and an in-process
 * mock of SEFIN and ADN. Together they run the full flow (emit, query,
 * recover, cancel, DANFSe) with no real certificate, network or SEFIN account.
 *
 *   import { createTestCertificate, installMockSefin } from '@useinvio/nfse-sdk/testing';
 *
 * Never use these in production: the certificate is self-signed and the mock
 * only approximates SEFIN (it validates the XSD and signatures, not fiscal rules).
 */
import { generateKeyPairSync, randomInt } from 'node:crypto';
import forge from 'node-forge';
import { NfseCertificate, resolveCredentials, type CertificateInput } from './certificate.js';
import { ADN_BASE_URL, SEFIN_BASE_URL, type Ambiente } from './config.js';
import { gunzipBase64, gzipBase64 } from './gzipB64.js';
import { buscarRejeicao } from './rejeicoes.js';
import { setSefinTransport, type SefinErro, type SefinTransportRequest, type SefinTransportResponse } from './sefinClient.js';
import { verifyDps } from './signXml.js';
import { directChildren, parseNfseXml } from './xmlInspection.js';
import { validateDpsXmlAgainstXsd, validatePedRegEventoXmlAgainstXsd } from './xsdValidation.js';

// ---------------------------------------------------------------- certificate

export interface TestCertificateOptions {
  /** Holder CNPJ written to the ICP-Brasil otherName 2.16.76.1.3.3. Default: 12345678000195. */
  cnpj?: string;
  /** Holder CPF (e-CPF otherName 2.16.76.1.3.1). When set, `cnpj` is ignored. */
  cpf?: string;
  /** Common name. Default: "EMPRESA DE TESTE LTDA:<documento>". */
  commonName?: string;
  /** Days of validity from now. Negative values create an expired certificate. Default: 365. */
  validDays?: number;
  /** PFX password. Default: "test". */
  password?: string;
}

export interface TestCertificate {
  certificate: NfseCertificate;
  /** PKCS#12 bytes, for testing `fromPfx`/`fromBase64`/`fromEnv`. */
  pfx: Buffer;
  password: string;
  certPem: string;
  keyPem: string;
}

function icpOtherName(oid: string, value: string): string {
  const { asn1 } = forge;
  const otherName = asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, true, [
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false, asn1.oidToDer(oid).getBytes()),
    asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, true, [asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false, value)]),
  ]);
  return asn1.toDer(asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [otherName])).getBytes();
}

/** Creates a self-signed A1 certificate whose holder CNPJ/CPF is read like a real ICP-Brasil one. */
export function createTestCertificate(options: TestCertificateOptions = {}): TestCertificate {
  const password = options.password ?? 'test';
  const cpf = options.cpf?.replace(/\D/g, '');
  const cnpj = cpf ? undefined : (options.cnpj ?? '12345678000195').replace(/\D/g, '');
  const documento = cpf ?? cnpj!;
  const { privateKey: keyPem } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  const key = forge.pki.privateKeyFromPem(keyPem) as forge.pki.rsa.PrivateKey;
  const cert = forge.pki.createCertificate();
  cert.publicKey = forge.pki.setRsaPublicKey(key.n, key.e);
  cert.serialNumber = `0${randomInt(1, 2 ** 31).toString(16)}`;
  const validDays = options.validDays ?? 365;
  const now = Date.now();
  cert.validity.notBefore = new Date(Math.min(now, now + validDays * 86_400_000) - 86_400_000);
  cert.validity.notAfter = new Date(now + validDays * 86_400_000);
  cert.setSubject([{ name: 'commonName', value: options.commonName ?? `EMPRESA DE TESTE LTDA:${documento}` }]);
  cert.setIssuer([{ name: 'commonName', value: 'AC TESTE NFSE-SDK (NAO ICP-BRASIL)' }]);
  const san = cpf
    ? icpOtherName('2.16.76.1.3.1', `01011990${cpf}${'0'.repeat(11)}`)
    : icpOtherName('2.16.76.1.3.3', cnpj!);
  cert.setExtensions([{ id: '2.5.29.17', value: san } as any]);
  cert.sign(key, forge.md.sha256.create());
  const certPem = forge.pki.certificateToPem(cert);
  const p12 = forge.pkcs12.toPkcs12Asn1(key, [cert], password, { algorithm: '3des' });
  const pfx = Buffer.from(forge.asn1.toDer(p12).getBytes(), 'binary');
  return { certificate: NfseCertificate.fromPem({ key: keyPem, cert: certPem }), pfx, password, certPem, keyPem };
}

// ---------------------------------------------------------------- mock SEFIN

export interface MockNfse {
  chaveAcesso: string;
  dpsId: string;
  ambiente: Ambiente;
  nfseXml: string;
  nsu: number;
  cancelada: boolean;
  eventos: Array<{ tpEvento: string; nSeqEvento: number; pedRegEventoXml: string; eventoXml: string }>;
}

export interface MockRequestLog {
  method: string;
  host: string;
  path: string;
  status?: number;
  error?: string;
}

export type MockHandler = (request: SefinTransportRequest, match: RegExpMatchArray) => SefinTransportResponse | Promise<SefinTransportResponse>;

export interface MockSefin {
  /** Authorized NFS-e by access key. */
  readonly notas: Map<string, MockNfse>;
  readonly requests: MockRequestLog[];
  /** Rejects the next matching request with these errors (default: HTTP 400). */
  rejectNext(erros: SefinErro[] | string, options?: { status?: number; path?: RegExp }): void;
  /** Fails the next request with a network error before SEFIN processes it. */
  failNext(error?: Error): void;
  /**
   * Processes the next request, then fails with a network error as if the
   * connection dropped before the answer arrived. Use it to test recovery.
   */
  dropResponseNext(error?: Error): void;
  /** Adds or overrides a route. `path` is matched against the URL path without the service prefix. */
  route(method: 'GET' | 'POST', path: RegExp, handler: MockHandler): void;
  /** Uninstalls the mock and restores the real HTTPS transport. */
  restore(): void;
}

export interface MockSefinOptions {
  /** Municipality code used in generated access keys when the DPS has none. Default: 3550308. */
  codigoMunicipio?: string;
  /** Skip the XSD check on received DPS/events. Default: false. */
  skipXsd?: boolean;
}

const json = (status: number, body: unknown): SefinTransportResponse => ({ status, body: JSON.stringify(body) });
const errorBody = (codigo: string, descricao: string) => ({ erros: [{ Codigo: codigo, Descricao: descricao }] });

function officialError(codigo: string, fallback: string): SefinErro {
  return { Codigo: codigo, Descricao: buscarRejeicao(codigo)?.mensagem ?? fallback };
}

function text(element: Element | undefined, ...path: string[]): string {
  let current = element;
  for (const name of path) current = current ? directChildren(current, name)[0] : undefined;
  return current?.textContent ?? '';
}

function mod11(digits: string): string {
  let sum = 0;
  let weight = 2;
  for (let i = digits.length - 1; i >= 0; i--) {
    sum += Number(digits[i]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const dv = 11 - (sum % 11);
  return String(dv >= 10 ? 0 : dv);
}

/**
 * Installs an in-process SEFIN + ADN. Every SDK call is answered locally until
 * `restore()`. Received DPS and events are checked against the official XSD and
 * their XMLDSIG signature is verified with the calling certificate.
 */
export function installMockSefin(options: MockSefinOptions = {}): MockSefin {
  const notas = new Map<string, MockNfse>();
  const dps = new Map<string, string>();
  const requests: MockRequestLog[] = [];
  const pending: Array<{ kind: 'reject' | 'fail' | 'drop'; erros?: SefinErro[]; status?: number; path?: RegExp; error?: Error }> = [];
  const custom: Array<{ method: string; path: RegExp; handler: MockHandler }> = [];
  let nNFSe = 0;
  let nsu = 0;

  const certPemOf = (certificate: CertificateInput) => resolveCredentials(certificate).certPem;
  const ambienteOf = (url: URL): Ambiente =>
    url.origin === new URL(SEFIN_BASE_URL.producao).origin || url.origin === new URL(ADN_BASE_URL.producao).origin ? 'producao' : 'restrita';

  function emitir(request: SefinTransportRequest): SefinTransportResponse {
    const body = JSON.parse(request.body ?? '{}');
    if (typeof body.dpsXmlGZipB64 !== 'string') return json(400, errorBody('E1235', 'Campo dpsXmlGZipB64 ausente.'));
    const xml = gunzipBase64(body.dpsXmlGZipB64);
    if (!options.skipXsd) {
      try {
        validateDpsXmlAgainstXsd(xml);
      } catch (error) {
        return json(400, { erros: [{ ...officialError('E1235', 'Falha no esquema XML do DF-e.'), Complemento: (error as Error).message }] });
      }
    }
    if (!verifyDps(xml, certPemOf(request.certificate))) {
      return json(400, { erros: [officialError('E0714', 'Arquivo enviado com erro na assinatura.')] });
    }
    const root = parseNfseXml(xml, 'DPS');
    const inf = directChildren(root, 'infDPS')[0];
    const dpsId = inf.getAttribute('Id') ?? '';
    const ambiente = ambienteOf(request.url);
    if ((text(inf, 'tpAmb') === '1') !== (ambiente === 'producao')) {
      return json(400, { erros: [officialError('E0006', 'Ambiente informado diverge do ambiente de recebimento.')] });
    }
    if (dps.has(dpsId)) return json(400, { erros: [officialError('E0014', 'DPS ja processada.')] });

    const cnpj = text(inf, 'prest', 'CNPJ');
    const cpf = text(inf, 'prest', 'CPF');
    const cMun = (text(inf, 'cLocEmi') || options.codigoMunicipio || '3550308').padStart(7, '0');
    const now = new Date();
    const aamm = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
    nNFSe += 1;
    const base = `${cMun}${ambiente === 'producao' ? '1' : '2'}${cnpj ? '2' : '1'}${(cnpj || cpf).padStart(14, '0')}`
      + `${String(nNFSe).padStart(13, '0')}${aamm}${String(randomInt(0, 1e9)).padStart(9, '0')}`;
    const chaveAcesso = `${base}${mod11(base)}`;
    const vServ = text(inf, 'valores', 'vServPrest', 'vServ') || '0.00';
    const xNome = text(inf, 'prest', 'xNome') || 'EMITENTE DE TESTE';
    const nfseXml = '<NFSe versao="1.01" xmlns="http://www.sped.fazenda.gov.br/nfse">'
      + `<infNFSe Id="NFS${chaveAcesso}"><xLocEmi>Municipio ${cMun}</xLocEmi><xLocPrestacao>Municipio ${text(inf, 'serv', 'locPrest', 'cLocPrestacao') || cMun}</xLocPrestacao>`
      + `<nNFSe>${nNFSe}</nNFSe><cLocIncid>${cMun}</cLocIncid><xLocIncid>Municipio ${cMun}</xLocIncid>`
      + `<xTribNac>${text(inf, 'serv', 'cServ', 'cTribNac') || 'Servico'}</xTribNac><verAplic>MockSefin</verAplic><ambGer>2</ambGer>`
      + `<tpEmis>1</tpEmis><cStat>100</cStat><dhProc>${now.toISOString().replace(/\.\d+Z$/, 'Z')}</dhProc><nDFSe>${nNFSe}</nDFSe>`
      + `<emit>${cnpj ? `<CNPJ>${cnpj}</CNPJ>` : `<CPF>${cpf}</CPF>`}<xNome>${xNome}</xNome></emit>`
      + `<valores><vLiq>${vServ}</vLiq></valores>`
      + `${xml.replace(/^<\?xml[^>]*>\s*/, '')}</infNFSe></NFSe>`;
    nsu += 1;
    notas.set(chaveAcesso, { chaveAcesso, dpsId, ambiente, nfseXml, nsu, cancelada: false, eventos: [] });
    dps.set(dpsId, chaveAcesso);
    return json(201, {
      tipoAmbiente: ambiente === 'producao' ? 1 : 2,
      versaoAplicativo: 'MockSefin',
      dataHoraProcessamento: now.toISOString(),
      idDps: dpsId,
      chaveAcesso,
      nfseXmlGZipB64: gzipBase64(nfseXml),
      alertas: [],
    });
  }

  function registrarEvento(request: SefinTransportRequest, chave: string): SefinTransportResponse {
    const nota = notas.get(chave);
    if (!nota) return json(400, { erros: [officialError('E1831', 'A NFS-e indicada nao existe.')] });
    const body = JSON.parse(request.body ?? '{}');
    if (typeof body.pedidoRegistroEventoXmlGZipB64 !== 'string') {
      return json(400, errorBody('E1235', 'Campo pedidoRegistroEventoXmlGZipB64 ausente.'));
    }
    const xml = gunzipBase64(body.pedidoRegistroEventoXmlGZipB64);
    if (!options.skipXsd) {
      try {
        validatePedRegEventoXmlAgainstXsd(xml);
      } catch (error) {
        return json(400, { erros: [{ ...officialError('E1235', 'Falha no esquema XML do DF-e.'), Complemento: (error as Error).message }] });
      }
    }
    if (!verifyDps(xml, certPemOf(request.certificate))) return json(400, { erros: [officialError('E0714', 'Arquivo enviado com erro na assinatura.')] });
    const root = parseNfseXml(xml, 'pedRegEvento');
    if ((text(directChildren(root, 'infPedReg')[0], 'tpAmb') === '1') !== (nota.ambiente === 'producao')) {
      return json(400, { erros: [officialError('E1845', 'Ambiente informado diverge do ambiente de recebimento.')] });
    }
    const inf = directChildren(root, 'infPedReg')[0];
    if (text(inf, 'chNFSe') !== chave) return json(400, errorBody('MOCK_KEY_MISMATCH', 'chNFSe difere da chave do caminho (mock).'));
    const tpEvento = (inf.getAttribute('Id') ?? '').slice(-6);
    if (nota.cancelada) return json(400, { erros: [officialError(tpEvento === '105102' ? 'E0845' : 'E0840', 'NFS-e ja cancelada.')] });
    nota.cancelada = true;
    const nSeqEvento = nota.eventos.filter((e) => e.tpEvento === tpEvento).length + 1;
    const eventoXml = '<evento versao="1.01" xmlns="http://www.sped.fazenda.gov.br/nfse">'
      + `<infEvento Id="EVT${chave}${tpEvento}${String(nSeqEvento).padStart(3, '0')}"><verAplic>MockSefin</verAplic><ambGer>2</ambGer>`
      + `<nSeqEvento>${nSeqEvento}</nSeqEvento><dhProc>${new Date().toISOString()}</dhProc><nDFe>${nota.eventos.length + 1}</nDFe>`
      + `${xml.replace(/^<\?xml[^>]*>\s*/, '')}</infEvento></evento>`;
    nota.eventos.push({ tpEvento, nSeqEvento, pedRegEventoXml: xml, eventoXml });
    nsu += 1;
    return json(201, { tipoAmbiente: nota.ambiente === 'producao' ? 1 : 2, versaoAplicativo: 'MockSefin', dataHoraProcessamento: new Date().toISOString(), eventoXmlGZipB64: gzipBase64(eventoXml) });
  }

  const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');
  const routes: Array<{ service: 'sefin' | 'adn'; method: string; path: RegExp; handler: MockHandler }> = [
    { service: 'sefin', method: 'POST', path: /^\/nfse$/, handler: (req) => emitir(req) },
    { service: 'sefin', method: 'GET', path: /^\/nfse\/(\d{50})$/, handler: (_req, m) => {
      const nota = notas.get(m[1]);
      return nota ? json(200, { chaveAcesso: nota.chaveAcesso, nfseXmlGZipB64: gzipBase64(nota.nfseXml) }) : json(404, errorBody('MOCK_NOT_FOUND', 'NFS-e nao encontrada (mock).'));
    } },
    { service: 'sefin', method: 'GET', path: /^\/dps\/(DPS\d{42})$/, handler: (_req, m) => {
      const chave = dps.get(m[1]);
      return chave ? json(200, { idDps: m[1], chaveAcesso: chave }) : json(404, errorBody('MOCK_NOT_FOUND', 'DPS nao encontrada (mock).'));
    } },
    { service: 'sefin', method: 'POST', path: /^\/nfse\/(\d{50})\/eventos$/, handler: (req, m) => registrarEvento(req, m[1]) },
    { service: 'sefin', method: 'GET', path: /^\/nfse\/(\d{50})\/eventos\/(\d{6})\/(\d{1,3})$/, handler: (_req, m) => {
      const evento = notas.get(m[1])?.eventos.find((e) => e.tpEvento === m[2] && e.nSeqEvento === Number(m[3]));
      return evento ? json(200, { eventoXmlGZipB64: gzipBase64(evento.eventoXml) }) : json(404, errorBody('MOCK_NOT_FOUND', 'Evento nao encontrado (mock).'));
    } },
    { service: 'adn', method: 'GET', path: /^\/danfse\/(\d{50})$/, handler: (_req, m) =>
      notas.has(m[1]) ? { status: 200, contentType: 'application/pdf', body: PDF } : json(404, errorBody('MOCK_NOT_FOUND', 'NFS-e nao encontrada (mock).')) },
    { service: 'adn', method: 'GET', path: /^\/contribuintes\/NFSe\/(\d{50})\/Eventos$/, handler: (_req, m) => {
      const nota = notas.get(m[1]);
      return nota ? json(200, { eventos: nota.eventos.map((e) => ({ tipoEvento: e.tpEvento, arquivoXml: gzipBase64(e.eventoXml) })) }) : json(404, errorBody('MOCK_NOT_FOUND', 'NFS-e nao encontrada (mock).'));
    } },
    { service: 'adn', method: 'GET', path: /^\/contribuintes\/DFe\/(\d+)$/, handler: (_req, m) => {
      const lote = [...notas.values()].filter((n) => n.nsu > Number(m[1])).map((n) => ({ NSU: n.nsu, ChaveAcesso: n.chaveAcesso, TipoDocumento: 'NFSE', ArquivoXml: gzipBase64(n.nfseXml) }));
      return json(200, { StatusProcessamento: lote.length ? 'DOCUMENTOS_LOCALIZADOS' : 'NENHUM_DOCUMENTO_LOCALIZADO', LoteDFe: lote });
    } },
    { service: 'adn', method: 'GET', path: /^\/parametrizacao\/(\d{7})\/convenio$/, handler: (_req, m) =>
      json(200, { mensagem: 'Mock', parametrosConvenio: { codigoMunicipio: m[1], aderenteEmissorNacional: 1 } }) },
    { service: 'adn', method: 'GET', path: /^\/parametrizacao\/.+$/, handler: () => json(200, { mensagem: 'Mock: parametro nao configurado.' }) },
  ];

  async function handle(request: SefinTransportRequest): Promise<SefinTransportResponse> {
    const isAdn = Object.values(ADN_BASE_URL).some((base) => new URL(base).origin === request.url.origin);
    const sefinBase = Object.values(SEFIN_BASE_URL).find((base) => request.url.href.startsWith(base));
    const path = isAdn ? request.url.pathname : sefinBase ? request.url.pathname.slice(new URL(sefinBase).pathname.length) : request.url.pathname;
    const log: MockRequestLog = { method: request.method, host: request.url.host, path: request.url.pathname + request.url.search };
    requests.push(log);

    const pendingIndex = pending.findIndex((p) => !p.path || p.path.test(path));
    const control = pendingIndex >= 0 ? pending.splice(pendingIndex, 1)[0] : undefined;
    if (control?.kind === 'fail') {
      log.error = control.error!.message;
      throw control.error;
    }
    if (control?.kind === 'reject') {
      log.status = control.status ?? 400;
      return json(log.status, { erros: control.erros });
    }

    for (const route of custom) {
      const match = request.method === route.method ? path.match(route.path) : null;
      if (match) return finish(await route.handler(request, match));
    }
    for (const route of routes) {
      if (route.service === (isAdn ? 'adn' : 'sefin') && route.method === request.method) {
        const match = path.match(route.path);
        if (match) return finish(await route.handler(request, match));
      }
    }
    return finish(json(404, errorBody('MOCK_NO_ROUTE', `Rota nao simulada: ${request.method} ${path}`)));

    function finish(response: SefinTransportResponse): SefinTransportResponse {
      log.status = response.status;
      if (control?.kind === 'drop') {
        log.error = control.error!.message;
        throw control.error;
      }
      return response;
    }
  }

  const networkError = (message: string) => Object.assign(new Error(message), { code: 'ECONNRESET' });
  const previous = setSefinTransport(handle);
  let installed = true;

  return {
    notas,
    requests,
    rejectNext(erros, opts = {}) {
      const list = typeof erros === 'string' ? [officialError(erros, `Rejeicao simulada ${erros}.`)] : erros;
      pending.push({ kind: 'reject', erros: list, status: opts.status, path: opts.path });
    },
    failNext(error = networkError('socket hang up (mock)')) {
      pending.push({ kind: 'fail', error });
    },
    dropResponseNext(error = networkError('connection dropped after processing (mock)')) {
      pending.push({ kind: 'drop', error });
    },
    route(method, path, handler) {
      custom.unshift({ method, path, handler });
    },
    restore() {
      if (!installed) return;
      installed = false;
      setSefinTransport(previous);
    },
  };
}
