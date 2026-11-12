import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import forge from 'node-forge';
import {
  baixarDanfse,
  buildDpsFromJson,
  cancelarNfse,
  cancelarNfsePorSubstituicao,
  consultarAliquota,
  consultarConvenio,
  consultarDps,
  consultarEvento,
  consultarNfse,
  ConsultaNfseError,
  distribuirDfePorNsu,
  EventoInvalidoError,
  gunzipBase64,
  gzipBase64,
  lerNfse,
  NfseCertificate,
  NfseClient,
  obterNfse,
  recuperarNfsePorDps,
  RegistrarEventoError,
  SefinParametroInvalidoError,
  transmitirDpsCompactada,
  validatePedRegEventoXmlAgainstXsd,
  verifyDps,
} from '../index.js';
import { invoice } from './fixtures.js';
import { mockHttpsSequence } from './httpsMock.js';

const CHAVE = '3'.repeat(50);
const CHAVE_SUBSTITUTA = '4'.repeat(50);

const { privateKey: keyPem } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

function certPem(commonName: string): string {
  const key = forge.pki.privateKeyFromPem(keyPem) as forge.pki.rsa.PrivateKey;
  const cert = forge.pki.createCertificate();
  cert.publicKey = forge.pki.setRsaPublicKey(key.n, key.e);
  cert.serialNumber = '0b';
  cert.validity.notBefore = new Date(Date.now() - 86_400_000);
  cert.validity.notAfter = new Date(Date.now() + 30 * 86_400_000);
  cert.setSubject([{ name: 'commonName', value: commonName }]);
  cert.setIssuer([{ name: 'commonName', value: 'AC TESTE' }]);
  cert.sign(key, forge.md.sha256.create());
  return forge.pki.certificateToPem(cert);
}

const PEM = certPem('EMPRESA TESTE LTDA:12345678000195');
const certificate = NfseCertificate.fromPem({ key: keyPem, cert: PEM });

function nfseXml(chave = CHAVE): string {
  const { xml: dps } = buildDpsFromJson(invoice());
  return '<NFSe versao="1.01" xmlns="http://www.sped.fazenda.gov.br/nfse">'
    + `<infNFSe Id="NFS${chave}"><xLocEmi>Sao Paulo</xLocEmi><xLocPrestacao>Sao Paulo</xLocPrestacao>`
    + '<nNFSe>42</nNFSe><cLocIncid>3550308</cLocIncid><xLocIncid>Sao Paulo</xLocIncid>'
    + '<xTribNac>Analise e desenvolvimento de sistemas</xTribNac><verAplic>SefinNac</verAplic><ambGer>2</ambGer>'
    + '<tpEmis>1</tpEmis><cStat>100</cStat><dhProc>2026-11-10T13:00:00Z</dhProc><nDFSe>777</nDFSe>'
    + '<emit><CNPJ>12345678000195</CNPJ><xNome>EMPRESA TESTE LTDA</xNome></emit>'
    + '<valores><vBC>1000.00</vBC><pAliqAplic>2.00</pAliqAplic><vISSQN>20.00</vISSQN><vLiq>1000.00</vLiq></valores>'
    + `${dps.replace(/^<\?xml[^>]*>/, '')}</infNFSe></NFSe>`;
}

test('cancelarNfse signs, validates and posts pedidoRegistroEventoXmlGZipB64 to SEFIN', async (t) => {
  const eventoXml = '<evento><infEvento Id="EVT1"/></evento>';
  const calls = mockHttpsSequence(t, [{ status: 201, body: { eventoXmlGZipB64: Buffer.from(gzipBase64(eventoXml)).toString('base64') } }]);
  const result = await cancelarNfse(
    { chaveAcesso: CHAVE, cMotivo: '1', xMotivo: 'Nota emitida com valor incorreto' },
    certificate,
    { retries: 5 } as any,
  );

  assert.equal(calls.length, 1);
  const { options, payload } = calls[0];
  assert.equal(options.method, 'POST');
  assert.equal(options.hostname, 'sefin.producaorestrita.nfse.gov.br');
  assert.equal(options.path, `/SefinNacional/nfse/${CHAVE}/eventos`);
  const body = JSON.parse(payload);
  assert.deepEqual(Object.keys(body), ['pedidoRegistroEventoXmlGZipB64']);

  const sent = gunzipBase64(body.pedidoRegistroEventoXmlGZipB64);
  assert.equal(sent, result.pedRegEventoXml);
  assert.match(sent, /<CNPJAutor>12345678000195<\/CNPJAutor>/, 'autor defaults to the certificate holder');
  assert.match(sent, /<tpAmb>2<\/tpAmb>/);
  assert.ok(verifyDps(sent, PEM));
  validatePedRegEventoXmlAgainstXsd(sent);
  assert.equal(result.eventoXml, eventoXml);
  assert.equal(result.pedRegEventoId, `PRE${CHAVE}101101`);
});

test('event rejections are typed and POSTs are never retried', async (t) => {
  const calls = mockHttpsSequence(t, [{ status: 400, body: { erros: [{ Codigo: 'E0840', Descricao: 'Evento ja registrado' }] } }]);
  await assert.rejects(
    cancelarNfsePorSubstituicao(
      { chaveAcesso: CHAVE, chaveSubstituta: CHAVE_SUBSTITUTA, cMotivo: '99', autor: { CPF: '39053344705' } },
      certificate,
    ),
    (e) => e instanceof RegistrarEventoError && e.status === 400 && e.erros[0].Codigo === 'E0840',
  );
  assert.equal(calls.length, 1);

  const postCalls = mockHttpsSequence(t, [{ status: 503 }]);
  const res = await transmitirDpsCompactada('eA==', certificate, 'restrita', { retries: 3 });
  assert.equal(res.status, 503);
  assert.equal(postCalls.length, 1, 'emission POST must not be retried');
});

test('autor is required when the certificate has no ICP-Brasil holder document', async (t) => {
  const anonymous = NfseCertificate.fromPem({ key: keyPem, cert: certPem('SEM DOCUMENTO') });
  const calls = mockHttpsSequence(t, [{ status: 201 }]);
  await assert.rejects(
    cancelarNfse({ chaveAcesso: CHAVE, cMotivo: '2', xMotivo: 'Servico nao foi prestado ao tomador' }, anonymous),
    EventoInvalidoError,
  );
  assert.equal(calls.length, 0);
});

test('GETs retry transient failures, honor timeoutMs and stop at the first non-retryable answer', async (t) => {
  const calls = mockHttpsSequence(t, [
    { status: 503 },
    { error: Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' }) },
    { status: 404, body: { erros: [{ Codigo: 'E404', Descricao: 'Nao encontrada' }] } },
    { status: 200 },
  ]);
  const res = await consultarNfse(CHAVE, certificate, 'producao', { retries: 5, timeoutMs: 1234 });
  assert.equal(res.status, 404);
  assert.equal(calls.length, 3);
  assert.equal(calls[0].options.timeout, 1234);
  assert.equal(calls[0].options.hostname, 'sefin.nfse.gov.br');
});

test('obterNfse decodes the XML into a typed summary; 404 is a typed error', async (t) => {
  mockHttpsSequence(t, [{ status: 200, body: { chaveAcesso: CHAVE, nfseXmlGZipB64: gzipBase64(nfseXml()) } }]);
  const nota = await obterNfse(CHAVE, certificate, 'restrita');
  assert.equal(nota.chaveAcesso, CHAVE);
  assert.equal(nota.resumo.nNFSe, '42');
  assert.equal(nota.resumo.cStat, '100');
  assert.equal(nota.resumo.ambiente, 'restrita');
  assert.equal(nota.resumo.emitente.CNPJ, '12345678000195');
  assert.equal(nota.resumo.valores.vLiq, '1000.00');
  assert.equal(nota.resumo.valores.vISSQN, '20.00');
  assert.match(nota.resumo.dps.id, /^DPS\d{42}$/);
  assert.ok(nota.resumo.dps.dCompet);

  t.mock.restoreAll();
  mockHttpsSequence(t, [{ status: 404, body: { erros: [{ Codigo: 'E2', Descricao: 'NFS-e nao encontrada' }] } }]);
  await assert.rejects(obterNfse(CHAVE, certificate, 'restrita'), (e) => e instanceof ConsultaNfseError && e.notFound);
});

test('lerNfse rejects XML that is not an authorized NFS-e', () => {
  assert.throws(() => lerNfse('<NFSe xmlns="http://www.sped.fazenda.gov.br/nfse"><infNFSe Id="X"/></NFSe>'), /Id valido/);
  assert.throws(() => lerNfse('<!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]><NFSe/>'));
});

test('recuperarNfsePorDps resolves null on 404 and the NFS-e when the DPS was processed', async (t) => {
  const { id: dpsId } = buildDpsFromJson(invoice());
  const calls = mockHttpsSequence(t, [{ status: 404 }]);
  assert.equal(await recuperarNfsePorDps(dpsId, certificate, 'restrita'), null);
  assert.equal(calls[0].options.path, `/SefinNacional/dps/${dpsId}`);

  t.mock.restoreAll();
  const found = mockHttpsSequence(t, [
    { status: 200, body: { idDps: dpsId, chaveAcesso: CHAVE } },
    { status: 200, body: { nfseXmlGZipB64: gzipBase64(nfseXml()) } },
  ]);
  const nota = await recuperarNfsePorDps(dpsId, certificate, 'restrita');
  assert.equal(nota?.chaveAcesso, CHAVE);
  assert.equal(found[1].options.path, `/SefinNacional/nfse/${CHAVE}`);
});

test('path parameters are validated before any network I/O', async (t) => {
  const calls = mockHttpsSequence(t, [{ status: 200 }]);
  await assert.rejects(consultarDps('DPS123', certificate), SefinParametroInvalidoError);
  await assert.rejects(consultarEvento(CHAVE, '../x', certificate), SefinParametroInvalidoError);
  await assert.rejects(consultarEvento(CHAVE, '101101', certificate, undefined, { nSeqEvento: '1/../2' }), SefinParametroInvalidoError);
  await assert.rejects(consultarConvenio('35503', certificate), SefinParametroInvalidoError);
  await assert.rejects(consultarAliquota('3550308', '01.01/../x', '2026-11-01', certificate), SefinParametroInvalidoError);
  await assert.rejects(distribuirDfePorNsu('12;x', certificate), SefinParametroInvalidoError);
  assert.equal(calls.length, 0);
});

test('DANFSe, distribution and municipal parameters go to the ADN host', async (t) => {
  const pdf = Buffer.from('%PDF-1.7\n...');
  const calls = mockHttpsSequence(t, [
    { status: 200, raw: pdf, contentType: 'application/pdf' },
    { status: 404, body: { mensagem: 'Nao encontrado' } },
    { status: 200, body: { LoteDFe: [] } },
    { status: 200, body: {} },
    { status: 200, body: {} },
    { status: 200, body: {} },
  ]);
  const danfse = await baixarDanfse(CHAVE, certificate, 'producao');
  assert.deepEqual(danfse.pdf, pdf);
  const missing = await baixarDanfse(CHAVE, certificate, 'producao');
  assert.equal(missing.pdf, undefined);
  assert.deepEqual(missing.body, { mensagem: 'Nao encontrado' });
  await distribuirDfePorNsu(15, certificate, 'restrita', { cnpjConsulta: '12.345.678/0001-95', lote: false });
  await consultarConvenio('3550308', certificate, 'restrita');
  await consultarAliquota('3550308', '01.01.01', '2026-11-01', certificate, 'restrita');
  await consultarEvento(CHAVE, '101101', certificate, 'restrita');

  assert.equal(calls[0].options.hostname, 'adn.nfse.gov.br');
  assert.equal(calls[0].options.path, `/danfse/${CHAVE}`);
  assert.equal((calls[0].options.headers as Record<string, string>).Accept, 'application/pdf');
  assert.equal(calls[2].options.hostname, 'adn.producaorestrita.nfse.gov.br');
  assert.equal(calls[2].options.path, '/contribuintes/DFe/15?cnpjConsulta=12345678000195&lote=false');
  assert.equal(calls[3].options.path, '/parametrizacao/3550308/convenio');
  assert.equal(calls[4].options.path, '/parametrizacao/3550308/01.01.01/2026-11-01/aliquota');
  assert.equal(calls[5].options.hostname, 'sefin.producaorestrita.nfse.gov.br');
  assert.equal(calls[5].options.path, `/SefinNacional/nfse/${CHAVE}/eventos/101101/1`);
});

test('NfseClient exposes invoices, events, distribution and municipal parameters', async (t) => {
  const client = new NfseClient({ environment: 'production', certificate, request: { timeoutMs: 5000, retries: 1 } });
  const calls = mockHttpsSequence(t, [{ status: 201, body: {} }, { status: 200, body: {} }, { status: 200, body: {} }, { status: 200, body: {} }]);
  await client.invoices.cancel({ chaveAcesso: CHAVE, cMotivo: '9', xMotivo: 'Cancelamento solicitado pelo cliente' });
  await client.events.get(CHAVE, '101101', 2);
  await client.distribution.byNsu(0);
  await client.municipalParameters.agreement('3550308');

  assert.match(gunzipBase64(JSON.parse(calls[0].payload).pedidoRegistroEventoXmlGZipB64), /<tpAmb>1<\/tpAmb>/);
  assert.equal(calls[1].options.path, `/SefinNacional/nfse/${CHAVE}/eventos/101101/2`);
  assert.equal(calls[2].options.hostname, 'adn.nfse.gov.br');
  assert.ok(calls.every((call) => call.options.timeout === 5000));
});
