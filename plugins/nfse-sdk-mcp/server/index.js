import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import {
  buildDpsFromJson,
  emitirNfse,
  loadPfxFromBuffer,
  prepararNota,
  validateDpsJsonRequest,
  validateDpsXmlAgainstXsd,
} from '@useinvio/nfse-sdk';

const server = new Server(
  { name: '@useinvio/nfse-sdk-mcp', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

const dpsSchema = {
  type: 'object',
  properties: { dps: { type: 'object', description: 'DpsJsonRequest declarative payload.' } },
  required: ['dps'],
  additionalProperties: false,
};

const draftDpsSchema = {
  type: 'object',
  properties: {
    dps: {
      type: 'object',
      description: 'Rascunho parcial de DpsJsonRequest. Pode omitir campos para receber perguntas.',
    },
  },
  additionalProperties: false,
};

const xmlSchema = {
  type: 'object',
  properties: { xml: { type: 'string', description: 'Unsigned DPS XML.' } },
  required: ['xml'],
  additionalProperties: false,
};

const issueInputSchema = {
  type: 'object',
  properties: {
    dps: { type: 'object', description: 'DpsJsonRequest payload. Provide exactly one of dps or xml.' },
    xml: { type: 'string', description: 'DPS XML. Provide exactly one of dps or xml.' },
    certificate: {
      type: 'object',
      description: 'A1/PFX used in memory for this request only.',
      properties: {
        contentBase64: { type: 'string', description: 'Base64-encoded A1/PFX content.' },
        password: { type: 'string', description: 'PFX password.' },
      },
      required: ['contentBase64', 'password'],
      additionalProperties: false,
    },
    options: {
      type: 'object',
      properties: {
        ambiente: { type: 'string', enum: ['restrita', 'producao'] },
        dpsId: { type: 'string' },
      },
      additionalProperties: false,
    },
  },
  required: ['certificate'],
  additionalProperties: false,
};

const tools = [
  {
    name: 'get_dps_questions',
    description: 'Analyze a partial DPS JSON and return the minimum questions needed to complete it. Never requests a certificate.',
    inputSchema: draftDpsSchema,
  },
  { name: 'validate_dps_json', description: 'Validate DPS JSON without generating XML or using a certificate.', inputSchema: dpsSchema },
  { name: 'build_dps_xml', description: 'Validate DPS JSON and build unsigned DPS XML.', inputSchema: dpsSchema },
  { name: 'validate_dps_xml', description: 'Validate unsigned DPS XML against the local NFS-e XSD.', inputSchema: xmlSchema },
  { name: 'prepare_nfse', description: 'Validate, sign, and prepare a DPS locally. Requires an in-memory A1/PFX certificate.', inputSchema: issueInputSchema },
  { name: 'emit_nfse', description: 'Validate, sign, and transmit a DPS to SEFIN. Requires an in-memory A1/PFX certificate.', inputSchema: issueInputSchema },
];

const QUESTION_BY_PATH = {
  ambiente: 'Qual ambiente deve ser usado: restrita ou producao?',
  prestador: 'Informe os dados do prestador (CNPJ ou CPF, codigo do municipio de emissao, serie, regime do Simples Nacional e regime especial).',
  'prestador.cnpj': 'Qual e o CNPJ do prestador?',
  'prestador.cpf': 'Qual e o CPF do prestador?',
  'prestador.cLocEmi': 'Qual e o codigo IBGE do municipio de emissao?',
  'prestador.serie': 'Qual e a serie da DPS?',
  servico: 'Informe a classificacao e a descricao do servico.',
  'servico.cTribNac': 'Qual e o codigo de tributacao nacional do servico?',
  'servico.xDescServ': 'Qual e a descricao do servico prestado?',
  'servico.cLocPrestacao': 'Qual e o codigo IBGE do municipio de prestacao?',
  emissao: 'Informe numero, valores e tributacao da DPS.',
  nDPS: 'Qual e o numero da DPS?',
  'valores.vServ': 'Qual e o valor do servico em reais? Se for uma operacao em moeda estrangeira, informe valor estrangeiro e cotacao.',
  tributacaoMunicipal: 'Como o ISSQN deve ser tratado nesta operacao?',
  'tributacaoMunicipal.tribISSQN': 'Qual e o codigo de tributacao do ISSQN?',
  totTrib: 'Informe os percentuais ou a indicacao de total de tributos exigida pelo regime.',
};

function questionFor(issue) {
  return {
    field: issue.path,
    question: QUESTION_BY_PATH[issue.path] ?? `Informe ou corrija ${issue.path}: ${issue.message}`,
    reason: issue.message,
    ...(issue.suggestion ? { hint: issue.suggestion } : {}),
  };
}

function dpsQuestions(dps = {}) {
  const report = validateDpsJsonRequest(dps);
  const seen = new Set();
  const questions = report.issues
    .map(questionFor)
    .filter((question) => {
      if (seen.has(question.field)) return false;
      seen.add(question.field);
      return true;
    });
  return {
    readyForXml: report.valid,
    questions,
    warnings: report.warnings,
    nextStep: report.valid ? 'Use build_dps_xml para gerar e validar o XML sem certificado.' : 'Responda as perguntas e execute get_dps_questions novamente.',
  };
}

function text(value) {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
}

function fail(error) {
  const message = error instanceof Error ? error.message : String(error);
  return { content: [{ type: 'text', text: JSON.stringify({ error: message }, null, 2) }], isError: true };
}

function pfx(certificate) {
  if (!certificate?.contentBase64 || !certificate.password) {
    throw new Error('certificate.contentBase64 e certificate.password sao obrigatorios.');
  }
  return loadPfxFromBuffer(Buffer.from(certificate.contentBase64, 'base64'), certificate.password);
}

function emissionInput(args) {
  const hasDps = args.dps !== undefined;
  const hasXml = args.xml !== undefined;
  if (hasDps === hasXml) throw new Error('Informe exatamente um de dps ou xml.');
  return args.dps ?? args.xml;
}

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;
  try {
    switch (name) {
      case 'get_dps_questions': return text(dpsQuestions(args.dps));
      case 'validate_dps_json': return text(validateDpsJsonRequest(args.dps));
      case 'build_dps_xml': return text(buildDpsFromJson(args.dps));
      case 'validate_dps_xml':
        validateDpsXmlAgainstXsd(args.xml);
        return text({ valid: true, schemaVersion: '1.01' });
      case 'prepare_nfse': {
        const nota = prepararNota(emissionInput(args), pfx(args.certificate), args.options);
        return text(nota);
      }
      case 'emit_nfse': return text(await emitirNfse(emissionInput(args), pfx(args.certificate), args.options));
      default: throw new Error(`Ferramenta desconhecida: ${name}`);
    }
  } catch (error) {
    return fail(error);
  }
});

await server.connect(new StdioServerTransport());
