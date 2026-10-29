/**
 * Framework-neutral tool definitions for MCP servers and LLM agents.
 *
 * Each tool carries a JSON Schema for input and output, MCP-style annotations
 * and a `run` handler. Adapters (MCP, OpenAI, LangChain, Vercel AI SDK) only
 * need to map these fields. Certificate and environment are host
 * configuration passed in `NfseAgentContext`, never tool input, so a model
 * cannot select production or see key material.
 */
import { CertificateValidationError } from './certificateValidation.js';
import { DEFAULT_AMBIENTE } from './config.js';
import { buildDpsFromJson } from './dpsJson.js';
import { DPS_JSON_REQUEST_SCHEMA, type JsonSchema } from './dpsJsonSchema.js';
import { EmitirNotaError } from './emissaoNota.js';
import { DpsFiscalValidationError, validateDpsJsonRequest, type DpsValidationIssue } from './fiscalValidation.js';
import { gunzipBase64 } from './gzipB64.js';
import { checkJsonSchema } from './jsonSchemaCheck.js';
import { consultarNfse, extrairErros, type SefinErro } from './sefinClient.js';
import { DpsXsdValidationError, validateDpsXmlAgainstXsd } from './xsdValidation.js';
import type { Ambiente } from './config.js';
import type { DpsJsonRequest } from './dpsJson.js';
import type { PfxMaterial } from './loadPfx.js';

export { DPS_JSON_REQUEST_SCHEMA } from './dpsJsonSchema.js';
export type { JsonSchema } from './dpsJsonSchema.js';

export type NfseAgentIssueSource = 'sdk' | 'invio' | 'schema' | 'xsd' | 'sefin' | 'certificate' | 'environment';

/** One shape for validation, XSD, certificate and SEFIN problems. */
export interface NfseAgentIssue {
  code: string;
  /** Dotted path inside the request (`emissao.` omitted, as in `DpsValidationIssue`); `$` when global. */
  path: string;
  severity: 'error' | 'warning';
  source: NfseAgentIssueSource;
  message: string;
  suggestion?: string;
}

export interface NfseAgentContext {
  /** Host-owned A1 certificate. Required only by tools that talk to SEFIN. */
  pfx?: PfxMaterial;
  /** Host-owned environment. Defaults to `restrita`; tool input cannot override it. */
  ambiente?: Ambiente;
}

/** Same hints as MCP `ToolAnnotations`. */
export interface NfseAgentToolAnnotations {
  readOnlyHint: boolean;
  destructiveHint: boolean;
  idempotentHint: boolean;
  openWorldHint: boolean;
}

export interface NfseAgentTool<Input = any, Output = any> {
  name: string;
  title: string;
  description: string;
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
  annotations: NfseAgentToolAnnotations;
  requiresCertificate: boolean;
  /**
   * Expected failures (invalid input, rejection, missing certificate) resolve
   * with `issues`. Infrastructure failures (xmllint, network) reject.
   */
  run(input: Input, context?: NfseAgentContext): Promise<Output>;
}

export interface DpsRequestToolInput {
  request: Omit<DpsJsonRequest, 'ambiente'>;
}

export interface ValidateDpsToolOutput {
  valid: boolean;
  schemaVersion: string;
  ambiente: Ambiente;
  issues: NfseAgentIssue[];
  warnings: NfseAgentIssue[];
}

export interface BuildDpsXmlToolOutput {
  ok: boolean;
  ambiente: Ambiente;
  dpsId?: string;
  xml?: string;
  issues: NfseAgentIssue[];
  warnings: NfseAgentIssue[];
}

export interface GetNfseToolInput {
  chaveAcesso: string;
}

export interface GetNfseToolOutput {
  ok: boolean;
  ambiente: Ambiente;
  chaveAcesso: string;
  status?: number;
  nfseXml?: string;
  body?: unknown;
  issues: NfseAgentIssue[];
}

function fromValidationIssue(issue: DpsValidationIssue): NfseAgentIssue {
  return { ...issue };
}

function sefinIssue(erro: SefinErro): NfseAgentIssue {
  const authorization = erro.Codigo === 'INVALID_AUTHORIZATION_RESPONSE';
  return {
    code: erro.Codigo,
    path: '$',
    severity: 'error',
    source: authorization ? 'sdk' : 'sefin',
    message: erro.Complemento ? `${erro.Descricao} (${erro.Complemento})` : erro.Descricao,
    ...(authorization ? { suggestion: 'Consulte a nota pela chave ou concilie a DPS antes de reenviar.' } : {}),
  };
}

/**
 * Converts known SDK errors to `NfseAgentIssue[]`. Returns `undefined` for
 * anything else (transport, xmllint, programming errors) so the caller can rethrow.
 */
export function toAgentIssues(error: unknown): NfseAgentIssue[] | undefined {
  if (error instanceof DpsFiscalValidationError) return error.issues.map(fromValidationIssue);
  if (error instanceof DpsXsdValidationError) {
    return error.details.map((message) => ({ code: 'XSD_INVALID', path: '$', severity: 'error', source: 'xsd', message }));
  }
  if (error instanceof CertificateValidationError) {
    return [{ code: error.code, path: '$', severity: 'error', source: 'certificate', message: error.message }];
  }
  if (error instanceof EmitirNotaError) {
    const issues = error.erros.map(sefinIssue);
    return issues.length ? issues : [{ code: 'SEFIN_REJECTED', path: '$', severity: 'error', source: 'sefin', message: error.message }];
  }
  return undefined;
}

function resolveAmbiente(context: NfseAgentContext | undefined): Ambiente {
  return context?.ambiente ?? DEFAULT_AMBIENTE;
}

function stripEmissao(path: string): string {
  return path.replace(/^emissao\./, '');
}

/** Fields the schema does not accept are reported instead of silently ignored by the builder. */
function unsupportedFieldIssues(request: unknown): NfseAgentIssue[] {
  return checkJsonSchema(DPS_JSON_REQUEST_SCHEMA, request)
    .filter(({ keyword }) => keyword === 'additionalProperties')
    .map(({ path }) => ({
      code: 'UNSUPPORTED_FIELD',
      path: stripEmissao(path),
      severity: 'error',
      source: 'schema',
      message: `${path} nao e um campo suportado pelo schema da DPS`,
      suggestion: 'Remova o campo ou use o nome canonico descrito no schema.',
    }));
}

function environmentIssue(request: unknown, ambiente: Ambiente): NfseAgentIssue[] {
  const requested = (request as { ambiente?: unknown } | null)?.ambiente;
  if (requested === undefined || requested === ambiente) return [];
  return [{
    code: 'AMBIENTE_NOT_ALLOWED',
    path: 'ambiente',
    severity: 'error',
    source: 'environment',
    message: `O ambiente e definido pelo host (${ambiente}); a requisicao pediu ${String(requested)}.`,
    suggestion: 'Remova o campo ambiente da requisicao.',
  }];
}

function validateForAgent(input: DpsRequestToolInput, context: NfseAgentContext | undefined) {
  const ambiente = resolveAmbiente(context);
  const request = (input as Partial<DpsRequestToolInput> | undefined)?.request;
  const hostIssues = environmentIssue(request, ambiente);
  const withAmbiente = request && typeof request === 'object' && !Array.isArray(request) ? { ...request, ambiente } : request;
  const report = validateDpsJsonRequest(withAmbiente);
  const structural = report.issues.some((issue) => issue.code === 'INVALID_STRUCTURE');
  const issues = [
    ...hostIssues,
    ...(structural ? [] : unsupportedFieldIssues(withAmbiente)),
    ...report.issues.map(fromValidationIssue),
  ];
  return { ambiente, report, issues, warnings: report.warnings.map(fromValidationIssue), request: withAmbiente as DpsJsonRequest };
}

const { $schema: _draft, ...requestSchema } = DPS_JSON_REQUEST_SCHEMA;
const { ambiente: _ambiente, ...requestProperties } = requestSchema.properties as Record<string, JsonSchema>;

/** `DPS_JSON_REQUEST_SCHEMA` without `ambiente`, which belongs to the host. */
export const DPS_AGENT_REQUEST_SCHEMA: JsonSchema = { ...requestSchema, properties: requestProperties };

const DPS_REQUEST_INPUT_SCHEMA: JsonSchema = {
  type: 'object',
  properties: { request: DPS_AGENT_REQUEST_SCHEMA },
  required: ['request'],
  additionalProperties: false,
};

const ISSUE_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    code: { type: 'string', description: 'Codigo estavel do problema, ex.: TOT_TRIB_REQUIRED ou codigo SEFIN.' },
    path: { type: 'string', description: 'Campo afetado; $ quando global.' },
    severity: { type: 'string', enum: ['error', 'warning'] },
    source: { type: 'string', enum: ['sdk', 'invio', 'schema', 'xsd', 'sefin', 'certificate', 'environment'] },
    message: { type: 'string' },
    suggestion: { type: 'string' },
  },
  required: ['code', 'path', 'severity', 'source', 'message'],
  additionalProperties: false,
};
const ISSUES = { type: 'array', items: ISSUE_SCHEMA };
const AMBIENTE = { type: 'string', enum: ['restrita', 'producao'] };

export const validateDpsTool: NfseAgentTool<DpsRequestToolInput, ValidateDpsToolOutput> = {
  name: 'validate_dps',
  title: 'Validar DPS da NFS-e',
  description:
    'Valida uma requisicao de DPS (NFS-e Nacional) sem certificado, sem rede e sem efeitos colaterais. ' +
    'Retorna issues com code, path, message e suggestion; corrija os campos indicados e valide novamente ate valid=true. ' +
    'Nao invente codigos fiscais (cTribNac, regime, tributacao): pergunte ao usuario quando faltarem.',
  inputSchema: DPS_REQUEST_INPUT_SCHEMA,
  outputSchema: {
    type: 'object',
    properties: { valid: { type: 'boolean' }, schemaVersion: { type: 'string' }, ambiente: AMBIENTE, issues: ISSUES, warnings: ISSUES },
    required: ['valid', 'schemaVersion', 'ambiente', 'issues', 'warnings'],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  requiresCertificate: false,
  async run(input, context) {
    const { ambiente, report, issues, warnings } = validateForAgent(input, context);
    return { valid: issues.length === 0, schemaVersion: report.schemaVersion, ambiente, issues, warnings };
  },
};

export const buildDpsXmlTool: NfseAgentTool<DpsRequestToolInput, BuildDpsXmlToolOutput> = {
  name: 'build_dps_xml',
  title: 'Gerar XML da DPS',
  description:
    'Valida a requisicao e gera o XML nao assinado da DPS, conferido contra o XSD oficial v1.01. ' +
    'Nao assina nem transmite. Use para revisar a nota antes de pedir a emissao ao usuario.',
  inputSchema: DPS_REQUEST_INPUT_SCHEMA,
  outputSchema: {
    type: 'object',
    properties: {
      ok: { type: 'boolean' },
      ambiente: AMBIENTE,
      dpsId: { type: 'string', description: 'Id de 45 caracteres da DPS.' },
      xml: { type: 'string', description: 'XML da DPS nao assinado.' },
      issues: ISSUES,
      warnings: ISSUES,
    },
    required: ['ok', 'ambiente', 'issues', 'warnings'],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  requiresCertificate: false,
  async run(input, context) {
    const { ambiente, issues, warnings, request } = validateForAgent(input, context);
    if (issues.length) return { ok: false, ambiente, issues, warnings };
    try {
      const built = buildDpsFromJson(request);
      validateDpsXmlAgainstXsd(built.xml);
      return { ok: true, ambiente, dpsId: built.id, xml: built.xml, issues: [], warnings };
    } catch (error) {
      const mapped = toAgentIssues(error);
      if (!mapped) throw error;
      return { ok: false, ambiente, issues: mapped, warnings };
    }
  },
};

export const getNfseTool: NfseAgentTool<GetNfseToolInput, GetNfseToolOutput> = {
  name: 'get_nfse',
  title: 'Consultar NFS-e',
  description:
    'Consulta uma NFS-e na SEFIN pela chave de acesso de 50 digitos, no ambiente configurado pelo host. ' +
    'Use tambem para conciliar uma emissao com resposta ambigua antes de qualquer reenvio.',
  inputSchema: {
    type: 'object',
    properties: { chaveAcesso: { type: 'string', pattern: '^\\d{50}$', description: 'Chave de acesso da NFS-e, 50 digitos.' } },
    required: ['chaveAcesso'],
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object',
    properties: {
      ok: { type: 'boolean' },
      ambiente: AMBIENTE,
      chaveAcesso: { type: 'string' },
      status: { type: 'number', description: 'Status HTTP da SEFIN.' },
      nfseXml: { type: 'string', description: 'XML da NFS-e quando retornado.' },
      body: { description: 'Corpo da resposta da SEFIN, sem o XML compactado.' },
      issues: ISSUES,
    },
    required: ['ok', 'ambiente', 'chaveAcesso', 'issues'],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  requiresCertificate: true,
  async run(input, context) {
    const ambiente = resolveAmbiente(context);
    const chaveAcesso = String((input as Partial<GetNfseToolInput> | undefined)?.chaveAcesso ?? '');
    const fail = (issue: NfseAgentIssue): GetNfseToolOutput => ({ ok: false, ambiente, chaveAcesso, issues: [issue] });
    if (!/^\d{50}$/.test(chaveAcesso)) {
      return fail({ code: 'CHAVE_ACESSO_INVALID_FORMAT', path: 'chaveAcesso', severity: 'error', source: 'sdk', message: 'chaveAcesso deve ter 50 digitos numericos.' });
    }
    if (!context?.pfx) {
      return fail({ code: 'CERTIFICATE_REQUIRED', path: '$', severity: 'error', source: 'certificate', message: 'O host nao configurou um certificado A1 para consultar a SEFIN.' });
    }

    const { status, body } = await consultarNfse(chaveAcesso, context.pfx, ambiente);
    const { nfseXmlGZipB64, NfseXmlGZipB64, ...rest } = (body && typeof body === 'object' && !Array.isArray(body) ? body : { value: body }) as Record<string, unknown>;
    const compressed = nfseXmlGZipB64 ?? NfseXmlGZipB64;
    if (status < 200 || status >= 300) {
      const issues = extrairErros(body).map(sefinIssue);
      return { ok: false, ambiente, chaveAcesso, status, body: rest, issues: issues.length ? issues : [
        { code: `HTTP_${status}`, path: '$', severity: 'error', source: 'sefin', message: `A SEFIN respondeu HTTP ${status}.` },
      ] };
    }
    const nfseXml = typeof compressed === 'string' ? gunzipBase64(compressed) : undefined;
    return { ok: true, ambiente, chaveAcesso, status, ...(nfseXml ? { nfseXml } : {}), body: rest, issues: [] };
  },
};

/** All tools, in the order an agent typically needs them. */
export const nfseAgentTools: readonly NfseAgentTool[] = [validateDpsTool, buildDpsXmlTool, getNfseTool];
