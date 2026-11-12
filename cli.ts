/**
 * `nfse` command line: diagnose the setup, inspect the certificate, validate,
 * emit, query, cancel and explain rejections, from the terminal.
 *
 *   npx -p @useinvio/nfse-sdk nfse doctor
 *   npx -p @useinvio/nfse-sdk nfse emit nota.json --mock
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { parseArgs } from 'node:util';
import { NfseCertificate, type CertificateInput } from './certificate.js';
import { CertificateValidationError } from './certificateValidation.js';
import { ConsultaNfseError, obterNfse, recuperarNfsePorDps } from './consultas.js';
import { buildDpsFromJson, type DpsJsonRequest } from './dpsJson.js';
import { EmitirNotaError, prepararNota, transmitirNotaPreparada } from './emissaoNota.js';
import { buildCancelamentoFromJson, EventoInvalidoError } from './eventoJson.js';
import { registrarEvento, RegistrarEventoError } from './eventosNfse.js';
import { DpsFiscalValidationError, validateDpsJsonRequest } from './fiscalValidation.js';
import { explicarRejeicao, type ExplicacaoRejeicao } from './rejeicoes.js';
import { baixarDanfse, type SefinErro } from './sefinClient.js';
import { DpsXsdValidationError, validateDpsXmlAgainstXsd } from './xsdValidation.js';
import type { Ambiente } from './config.js';
import type { NfseResumo } from './nfseXml.js';

const VERSION = (() => {
  try {
    return JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version as string;
  } catch {
    return 'desconhecida';
  }
})();

const HELP = `nfse ${VERSION} — NFS-e Nacional pelo terminal

Uso: nfse <comando> [opções]

Comandos
  init [nota.json]          Cria um JSON de nota de exemplo para editar
  doctor                    Confere Node.js, motor XSD e certificado
  cert [arquivo.pfx]        Mostra titular, validade e fingerprint do certificado
  validate <nota.json>      Valida o JSON da DPS (regras + XSD oficial), sem enviar
  xml <nota.json>           Gera o XML da DPS não assinado
  emit <nota.json>          Emite a NFS-e (mostra o resumo e pede confirmação)
  get <chave>               Consulta uma NFS-e pela chave de acesso
  danfse <chave>            Baixa o PDF do DANFSe
  cancel <chave>            Cancela (--motivo 1|2|9 --justificativa "...")
  recover <dpsId>           Diz se a SEFIN gerou NFS-e para uma DPS (após timeout)
  explain <código...>       Explica códigos de rejeição com o texto oficial (ex.: E0014)
  mcp                       Inicia o servidor MCP (stdio)

Opções
  --producao                Usa o ambiente de produção (padrão: produção restrita)
  --mock                    Usa uma SEFIN simulada e um certificado de teste
  --cert <arquivo.pfx>      Certificado A1 (padrão: NFSE_CERT_PATH / NFSE_CERT_BASE64)
  --password-file <arq>     Arquivo com a senha (padrão: NFSE_CERT_PASSWORD[_FILE] ou pergunta)
  -o, --output <arquivo>    Salva o XML, a resposta ou o PDF
  -y, --yes                 Não pede confirmação (emit, cancel)
  --json                    Saída em JSON
  -h, --help                Esta ajuda
  -v, --version             Versão

Exemplos
  nfse init
  nfse doctor
  nfse validate nota.json
  nfse emit nota.json --mock
  nfse explain E0014 E0312
`;

interface Options {
  producao: boolean;
  mock: boolean;
  cert?: string;
  'password-file'?: string;
  output?: string;
  yes: boolean;
  json: boolean;
  motivo?: string;
  justificativa?: string;
}

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code: number) => (text: string) => (useColor ? `\x1b[${code}m${text}\x1b[0m` : text);
const green = paint(32);
const red = paint(31);
const yellow = paint(33);
const bold = paint(1);
const dim = paint(2);

const ok = (text: string) => console.log(`${green('✔')} ${text}`);
const bad = (text: string) => console.log(`${red('✖')} ${text}`);
const warn = (text: string) => console.log(`${yellow('⚠')} ${text}`);

class CliError extends Error {
  constructor(message: string, public readonly exitCode = 1) {
    super(message);
  }
}

function ambienteOf(options: Options): Ambiente {
  if (options.producao) return 'producao';
  const env = process.env.NFSE_AMBIENTE?.trim().toLowerCase();
  return env === 'producao' ? 'producao' : 'restrita';
}

async function ask(question: string, hidden = false, hint = 'Use --password-file ou NFSE_CERT_PASSWORD_FILE.'): Promise<string> {
  if (!process.stdin.isTTY) throw new CliError(`Entrada interativa indisponível. ${hint}`);
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) {
    const output = rl as unknown as { _writeToOutput: (text: string) => void; output: NodeJS.WriteStream };
    output._writeToOutput = (text: string) => {
      if (text.includes(question)) output.output.write(text);
    };
  }
  try {
    return await new Promise<string>((resolve) => rl.question(question, resolve));
  } finally {
    rl.close();
    if (hidden) process.stdout.write('\n');
  }
}

async function loadCertificate(options: Options, required: boolean): Promise<CertificateInput | undefined> {
  if (options.mock) {
    const { createTestCertificate } = await import('./testing.js');
    return createTestCertificate().certificate;
  }
  const path = options.cert ?? process.env.NFSE_CERT_PATH;
  if (!path && !process.env.NFSE_CERT_BASE64) {
    if (required) throw new CliError('Certificado não configurado. Use --cert, NFSE_CERT_PATH/NFSE_CERT_BASE64, ou --mock para testar.');
    return undefined;
  }
  let password: string | undefined;
  if (options['password-file']) password = readFileSync(options['password-file'], 'utf8').replace(/\r?\n$/, '');
  else if (process.env.NFSE_CERT_PASSWORD_FILE) password = readFileSync(process.env.NFSE_CERT_PASSWORD_FILE, 'utf8').replace(/\r?\n$/, '');
  else if (process.env.NFSE_CERT_PASSWORD !== undefined) password = process.env.NFSE_CERT_PASSWORD;
  else password = await ask('Senha do certificado: ', true);
  if (path) return NfseCertificate.fromFile(path, password);
  return NfseCertificate.fromBase64(process.env.NFSE_CERT_BASE64!, password);
}

function readRequest(file: string | undefined, ambiente: Ambiente): DpsJsonRequest {
  if (!file) throw new CliError('Informe o arquivo JSON da nota. Ex.: nfse validate nota.json');
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new CliError(`Não foi possível ler ${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
  const request = parsed as DpsJsonRequest;
  if (request && typeof request === 'object' && request.ambiente && request.ambiente !== ambiente) {
    throw new CliError(`O arquivo pede ambiente "${request.ambiente}", mas o comando roda em "${ambiente}". Use --producao ou remova "ambiente" do JSON.`);
  }
  return { ...request, ambiente };
}

function printExplanations(explicacoes: ExplicacaoRejeicao[]): void {
  for (const e of explicacoes) {
    console.log(`\n${bold(e.codigo)} ${e.conhecida ? '' : dim('(fora do catálogo oficial)')}`);
    if (e.descricaoRecebida) console.log(`  Recebido: ${e.descricaoRecebida}${e.complemento ? ` (${e.complemento})` : ''}`);
    if (e.mensagemOficial && e.mensagemOficial !== e.descricaoRecebida) console.log(`  Mensagem oficial: ${e.mensagemOficial}`);
    if (e.regra && e.regra !== e.mensagemOficial) console.log(`  Regra: ${e.regra.replace(/\n+/g, ' ')}`);
    if (e.campo) console.log(`  Campo: ${e.campo}`);
    if (e.dica) console.log(`  ${dim(e.dica)}`);
    if (e.fonte) console.log(`  ${dim(`Fonte: ${e.fonte.documento}`)}`);
  }
}

function printRejection(erros: SefinErro[], status: number, options: Options): never {
  if (options.json) {
    console.log(JSON.stringify({ ok: false, status, erros, explicacoes: erros.map((erro) => explicarRejeicao(erro)) }, null, 2));
  } else {
    bad(`A SEFIN rejeitou (HTTP ${status}).`);
    printExplanations(erros.map((erro) => explicarRejeicao(erro)));
  }
  throw new CliError('', 2);
}

function printResumo(resumo: NfseResumo): void {
  console.log(`  Chave de acesso  ${bold(resumo.chaveAcesso)}`);
  console.log(`  Número           ${resumo.nNFSe}   Situação ${resumo.cStat}   Ambiente ${resumo.ambiente}`);
  console.log(`  Emitente         ${resumo.emitente.CNPJ ?? resumo.emitente.CPF ?? '-'} ${resumo.emitente.xNome ?? ''}`);
  if (resumo.tomador) console.log(`  Tomador          ${resumo.tomador.CNPJ ?? resumo.tomador.CPF ?? resumo.tomador.NIF ?? '-'} ${resumo.tomador.xNome ?? ''}`);
  console.log(`  Competência      ${resumo.dps.dCompet}   DPS ${resumo.dps.serie}/${resumo.dps.nDPS}`);
  console.log(`  Valor líquido    R$ ${resumo.valores.vLiq}${resumo.valores.vISSQN ? `   ISSQN R$ ${resumo.valores.vISSQN}` : ''}`);
}

async function confirm(options: Options, ambiente: Ambiente, action: string): Promise<void> {
  if (options.yes) return;
  const label = ambiente === 'producao' ? red('PRODUÇÃO (validade jurídica)') : 'produção restrita (teste)';
  const expected = ambiente === 'producao' ? 'emitir' : 's';
  const answer = await ask(`\n${action} em ${label}? ${ambiente === 'producao' ? 'Digite "emitir" para confirmar' : '[s/N]'}: `, false, 'Use --yes para confirmar sem perguntar.');
  if (answer.trim().toLowerCase() !== expected) throw new CliError('Cancelado. Nada foi enviado.', 0);
}

const commands: Record<string, (args: string[], options: Options) => Promise<void>> = {
  async init(args) {
    const file = args[0] ?? 'nota.json';
    if (existsSync(file)) throw new CliError(`${file} já existe; escolha outro nome: nfse init outra-nota.json`);
    const { examplePayload } = await import('./cliExample.js');
    const { ambiente: _ambiente, ...payload } = examplePayload();
    writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`);
    ok(`${file} criado com valores ilustrativos.`);
    warn('Troque CNPJ, municípios, código de serviço e tributação pelos do seu prestador antes de emitir.');
    console.log(`Próximo passo: nfse validate ${file}`);
  },

  async doctor(_args, options) {
    let failures = 0;
    const [major] = process.versions.node.split('.').map(Number);
    if (major >= 20) ok(`Node.js ${process.versions.node}`);
    else { bad(`Node.js ${process.versions.node}: o SDK exige 20 ou mais recente`); failures++; }

    try {
      const { examplePayload } = await import('./cliExample.js');
      validateDpsXmlAgainstXsd(buildDpsFromJson(examplePayload()).xml);
      ok('Motor XSD (libxml2 WebAssembly) e schemas oficiais v1.01 carregados');
    } catch (error) {
      bad(`Motor XSD: ${error instanceof Error ? error.message : String(error)}`);
      failures++;
    }

    const ambiente = ambienteOf(options);
    ok(`Ambiente: ${ambiente === 'producao' ? red('produção') : 'produção restrita'}${options.mock ? ' (SEFIN simulada)' : ''}`);

    try {
      const certificate = await loadCertificate(options, false);
      if (!certificate) {
        warn('Certificado não configurado: defina NFSE_CERT_PATH e NFSE_CERT_PASSWORD (ou use --mock)');
      } else if (certificate instanceof NfseCertificate) {
        const days = certificate.daysUntilExpiry();
        const holder = certificate.cnpj ? `CNPJ ${certificate.cnpj}` : certificate.cpf ? `CPF ${certificate.cpf}` : 'sem CNPJ/CPF ICP-Brasil';
        if (!certificate.isValidAt()) { bad(`Certificado ${holder} fora da vigência (até ${certificate.notAfter.toISOString().slice(0, 10)})`); failures++; }
        else if (days < 30) warn(`Certificado ${holder} vence em ${days} dias (${certificate.notAfter.toISOString().slice(0, 10)})`);
        else ok(`Certificado ${holder}, válido por mais ${days} dias`);
        if (!certificate.cnpj && !certificate.cpf) warn('O certificado não traz CNPJ/CPF nos campos ICP-Brasil: informe o autor ao cancelar');
      }
    } catch (error) {
      bad(`Certificado: ${error instanceof CertificateValidationError ? `${error.code}: ${error.message}` : error instanceof Error ? error.message : String(error)}`);
      failures++;
    }
    console.log(failures ? `\n${failures} problema(s) encontrado(s).` : `\n${green('Tudo pronto.')} Próximo passo: nfse validate nota.json`);
    if (failures) throw new CliError('', 1);
  },

  async cert(args, options) {
    const certificate = await loadCertificate({ ...options, cert: args[0] ?? options.cert }, true);
    if (!(certificate instanceof NfseCertificate)) throw new CliError('Certificado legado não suportado aqui.');
    if (options.json) { console.log(JSON.stringify({ ...certificate.toJSON(), diasRestantes: certificate.daysUntilExpiry() }, null, 2)); return; }
    console.log(`  Titular       ${certificate.subject}`);
    console.log(`  CNPJ / CPF    ${certificate.cnpj ?? certificate.cpf ?? '—'}`);
    console.log(`  Emissor       ${certificate.issuer}`);
    console.log(`  Validade      ${certificate.notBefore.toISOString().slice(0, 10)} a ${certificate.notAfter.toISOString().slice(0, 10)} (${certificate.daysUntilExpiry()} dias restantes)`);
    console.log(`  Fingerprint   ${certificate.fingerprintSha256}`);
  },

  async validate(args, options) {
    const ambiente = ambienteOf(options);
    const request = readRequest(args[0], ambiente);
    const report = validateDpsJsonRequest(request);
    let xmlIssue: string[] = [];
    if (report.valid) {
      try {
        validateDpsXmlAgainstXsd(buildDpsFromJson(request).xml);
      } catch (error) {
        if (!(error instanceof DpsXsdValidationError)) throw error;
        xmlIssue = error.details;
      }
    }
    const valid = report.valid && xmlIssue.length === 0;
    if (options.json) { console.log(JSON.stringify({ valid, issues: report.issues, warnings: report.warnings, xsd: xmlIssue }, null, 2)); }
    else {
      for (const issue of report.issues) bad(`${issue.path}: ${issue.message}${issue.suggestion ? dim(` — ${issue.suggestion}`) : ''}`);
      for (const detail of xmlIssue) bad(`XSD: ${detail}`);
      for (const warning of report.warnings) warn(`${warning.path}: ${warning.message}`);
      if (valid) ok(`DPS válida (${ambiente}). Próximo passo: nfse emit ${args[0]}`);
    }
    if (!valid) throw new CliError('', 1);
  },

  async xml(args, options) {
    const { id, xml } = buildDpsFromJson(readRequest(args[0], ambienteOf(options)));
    validateDpsXmlAgainstXsd(xml);
    if (options.output) { writeFileSync(options.output, xml); ok(`${id} salvo em ${options.output}`); }
    else console.log(xml);
  },

  async emit(args, options) {
    const ambiente = ambienteOf(options);
    const request = readRequest(args[0], ambiente);
    if (options.mock) (await import('./testing.js')).installMockSefin();
    const certificate = (await loadCertificate(options, true))!;
    const nota = prepararNota(request, certificate);
    const emissao = request.emissao as unknown as Record<string, any>;
    if (!options.json) {
      console.log(bold('\nResumo da NFS-e'));
      console.log(`  Prestador   ${request.prestador?.cnpj ?? '-'}`);
      if (emissao.tomador) console.log(`  Tomador     ${emissao.tomador.CNPJ ?? emissao.tomador.CPF ?? emissao.tomador.NIF ?? '-'} ${emissao.tomador.xNome ?? ''}`);
      console.log(`  Serviço     ${request.servico?.cTribNac ?? '-'} ${request.servico?.xDescServ ?? ''}`);
      console.log(`  Valor       R$ ${emissao.valores?.vServ ?? emissao.vServ ?? '-'}`);
      console.log(`  DPS         ${nota.dpsId}`);
    }
    await confirm(options, ambiente, 'Emitir esta NFS-e');
    try {
      const result = await transmitirNotaPreparada(nota, certificate);
      if (options.output) writeFileSync(options.output, result.nfseXml);
      if (options.json) console.log(JSON.stringify({ ok: true, chaveAcesso: result.chaveAcesso, dpsId: result.dpsId }, null, 2));
      else ok(`NFS-e emitida. Chave de acesso: ${bold(result.chaveAcesso)}${options.output ? ` (XML em ${options.output})` : ''}`);
    } catch (error) {
      if (error instanceof EmitirNotaError && !error.erros.some((e) => e.Codigo === 'INVALID_AUTHORIZATION_RESPONSE')) printRejection(error.erros, error.status, options);
      warn(`Sem resposta clara da SEFIN (${error instanceof Error ? error.message : String(error)}). Consultando a DPS antes de qualquer reenvio...`);
      const existing = await recuperarNfsePorDps(nota.dpsId, certificate, ambiente, { retries: 3 });
      if (existing) { ok(`A NFS-e foi emitida. Chave de acesso: ${bold(existing.chaveAcesso)}`); return; }
      throw new CliError(`A SEFIN não recebeu a DPS ${nota.dpsId}. É seguro rodar o mesmo comando de novo.`);
    }
  },

  async get(args, options) {
    const chave = args[0];
    if (!chave) throw new CliError('Informe a chave de acesso (50 dígitos).');
    const certificate = (await loadCertificate(options, true))!;
    try {
      const nota = await obterNfse(chave, certificate, ambienteOf(options));
      if (options.output) writeFileSync(options.output, nota.nfseXml);
      if (options.json) console.log(JSON.stringify(nota.resumo, null, 2));
      else printResumo(nota.resumo);
    } catch (error) {
      if (error instanceof ConsultaNfseError && error.notFound) throw new CliError(`NFS-e não encontrada em ${ambienteOf(options)}.`);
      if (error instanceof ConsultaNfseError) printRejection(error.erros, error.status, options);
      throw error;
    }
  },

  async danfse(args, options) {
    const chave = args[0];
    if (!chave) throw new CliError('Informe a chave de acesso (50 dígitos).');
    const certificate = (await loadCertificate(options, true))!;
    const result = await baixarDanfse(chave, certificate, ambienteOf(options));
    if (!result.pdf) throw new CliError(`DANFSe indisponível (HTTP ${result.status}).`);
    const output = options.output ?? `danfse-${chave}.pdf`;
    writeFileSync(output, result.pdf);
    ok(`DANFSe salvo em ${output}`);
  },

  async cancel(args, options) {
    const chave = args[0];
    if (!chave) throw new CliError('Informe a chave de acesso (50 dígitos).');
    const ambiente = ambienteOf(options);
    const certificate = (await loadCertificate(options, true))!;
    const autor = certificate instanceof NfseCertificate && (certificate.cnpj || certificate.cpf)
      ? (certificate.cnpj ? { CNPJ: certificate.cnpj } : { CPF: certificate.cpf })
      : undefined;
    if (!autor) throw new CliError('O certificado não traz CNPJ/CPF ICP-Brasil; cancele pelo SDK informando o autor.');
    const built = buildCancelamentoFromJson({
      ambiente,
      chaveAcesso: chave,
      autor,
      cMotivo: (options.motivo ?? '') as '1' | '2' | '9',
      xMotivo: options.justificativa ?? '',
    });
    const nota = await obterNfse(chave, certificate, ambiente).catch(() => undefined);
    if (nota && !options.json) { console.log(bold('\nNFS-e a cancelar')); printResumo(nota.resumo); }
    await confirm(options, ambiente, 'Cancelar esta NFS-e');
    try {
      const result = await registrarEvento(built, certificate);
      if (options.json) console.log(JSON.stringify({ ok: true, pedRegEventoId: result.pedRegEventoId }, null, 2));
      else ok(`Cancelamento registrado (${result.pedRegEventoId}).`);
    } catch (error) {
      if (error instanceof RegistrarEventoError) printRejection(error.erros, error.status, options);
      throw error;
    }
  },

  async recover(args, options) {
    const dpsId = args[0];
    if (!dpsId) throw new CliError('Informe o Id da DPS ("DPS" + 42 dígitos).');
    const certificate = (await loadCertificate(options, true))!;
    const nota = await recuperarNfsePorDps(dpsId, certificate, ambienteOf(options));
    if (options.json) { console.log(JSON.stringify(nota ? { encontrada: true, ...nota.resumo } : { encontrada: false }, null, 2)); return; }
    if (!nota) { warn('A SEFIN não tem NFS-e para esta DPS: ela não chegou a ser processada. É seguro reenviar a mesma DPS.'); return; }
    ok('A SEFIN gerou a NFS-e:');
    printResumo(nota.resumo);
  },

  async explain(args, options) {
    if (!args.length) throw new CliError('Informe um ou mais códigos. Ex.: nfse explain E0014');
    const explicacoes = args.map((codigo) => explicarRejeicao(codigo));
    if (options.json) console.log(JSON.stringify(explicacoes, null, 2));
    else printExplanations(explicacoes);
  },

  async mcp() {
    const { runNfseMcpStdio } = await import('./mcpServer.js');
    await runNfseMcpStdio();
  },
};

/** Entry point; exported for tests. Returns the process exit code. */
export async function runCli(argv: string[]): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        producao: { type: 'boolean', default: false },
        mock: { type: 'boolean', default: false },
        cert: { type: 'string' },
        'password-file': { type: 'string' },
        output: { type: 'string', short: 'o' },
        yes: { type: 'boolean', short: 'y', default: false },
        json: { type: 'boolean', default: false },
        motivo: { type: 'string' },
        justificativa: { type: 'string' },
        help: { type: 'boolean', short: 'h', default: false },
        version: { type: 'boolean', short: 'v', default: false },
      },
    });
  } catch (error) {
    console.error(`${red('✖')} ${error instanceof Error ? error.message : String(error)}\n\n${HELP}`);
    return 1;
  }
  const { values, positionals } = parsed;
  if (values.version) { console.log(VERSION); return 0; }
  const [name, ...args] = positionals;
  if (values.help || !name) { console.log(HELP); return name || values.help ? 0 : 1; }
  const command = commands[name];
  if (!command) { console.error(`${red('✖')} Comando desconhecido: ${name}\n\n${HELP}`); return 1; }
  const options = values as unknown as Options;
  if (options.mock && options.producao) { console.error(`${red('✖')} --mock não pode ser usado com --producao.`); return 1; }
  try {
    await command(args, options);
    return 0;
  } catch (error) {
    if (error instanceof CliError) {
      if (error.message) console.error(`${error.exitCode === 0 ? '' : `${red('✖')} `}${error.message}`);
      return error.exitCode;
    }
    if (error instanceof DpsFiscalValidationError) {
      for (const issue of error.issues) console.error(`${red('✖')} ${issue.path}: ${issue.message}`);
      return 1;
    }
    if (error instanceof CertificateValidationError || error instanceof EventoInvalidoError || error instanceof DpsXsdValidationError) {
      console.error(`${red('✖')} ${error.message}`);
      return 1;
    }
    console.error(`${red('✖')} ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}
