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
  { name: 'validate_dps_json', description: 'Validate DPS JSON without generating XML or using a certificate.', inputSchema: dpsSchema },
  { name: 'build_dps_xml', description: 'Validate DPS JSON and build unsigned DPS XML.', inputSchema: dpsSchema },
  { name: 'validate_dps_xml', description: 'Validate unsigned DPS XML against the local NFS-e XSD.', inputSchema: xmlSchema },
  { name: 'prepare_nfse', description: 'Validate, sign, and prepare a DPS locally. Requires an in-memory A1/PFX certificate.', inputSchema: issueInputSchema },
  { name: 'emit_nfse', description: 'Validate, sign, and transmit a DPS to SEFIN. Requires an in-memory A1/PFX certificate.', inputSchema: issueInputSchema },
];

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
