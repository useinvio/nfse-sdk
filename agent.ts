/**
 * Framework-neutral tool definitions for MCP servers and LLM agents.
 *
 * Each tool carries a JSON Schema for input and output, MCP-style annotations
 * and a `run` handler. Adapters (MCP, OpenAI, LangChain, Vercel AI SDK) only
 * need to map these fields. Certificate and environment are host
 * configuration passed in `NfseAgentContext`, never tool input, so a model
 * cannot select production or see key material.
 */
import { randomUUID } from 'node:crypto';
import { CertificateValidationError } from './certificateValidation.js';
import { NfseCertificate } from './certificate.js';
import { ConsultaNfseError, obterNfse, recuperarNfsePorDps } from './consultas.js';
import type { NfseResumo } from './nfseXml.js';
import { prepararNota, transmitirNotaPreparada, type NotaPreparada } from './emissaoNota.js';
import { buildCancelamentoFromJson, EventoInvalidoError, type BuiltPedRegEvento } from './eventoJson.js';
import { registrarEvento, RegistrarEventoError } from './eventosNfse.js';
import { explicarRejeicao, type ExplicacaoRejeicao } from './rejeicoes.js';
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
import type { CertificateInput } from './certificate.js';

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
  /** Host-owned A1 certificate (`NfseCertificate` recommended). Required only by tools that talk to SEFIN. */
  pfx?: CertificateInput;
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
   * with `issues`. Infrastructure failures (XSD engine, network) reject.
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
  const official = authorization ? undefined : explicarRejeicao(erro);
  const suggestion = authorization
    ? 'Consulte a nota pela chave ou concilie a DPS antes de reenviar.'
    : official?.conhecida
      ? [official.campo && `Campo: ${official.campo}.`, official.regra && `Regra oficial: ${official.regra.slice(0, 300)}`].filter(Boolean).join(' ')
      : undefined;
  return {
    code: erro.Codigo,
    path: '$',
    severity: 'error',
    source: authorization ? 'sdk' : 'sefin',
    message: erro.Complemento ? `${erro.Descricao} (${erro.Complemento})` : erro.Descricao,
    ...(suggestion ? { suggestion } : {}),
  };
}

/**
 * Converts known SDK errors to `NfseAgentIssue[]`. Returns `undefined` for
 * anything else (transport, XSD engine, programming errors) so the caller can rethrow.
 */
export function toAgentIssues(error: unknown): NfseAgentIssue[] | undefined {
  if (error instanceof DpsFiscalValidationError) return error.issues.map(fromValidationIssue);
  if (error instanceof DpsXsdValidationError) {
    return error.details.map((message) => ({ code: 'XSD_INVALID', path: '$', severity: 'error', source: 'xsd', message }));
  }
  if (error instanceof CertificateValidationError) {
    return [{ code: error.code, path: '$', severity: 'error', source: 'certificate', message: error.message }];
  }
  if (error instanceof EmitirNotaError || error instanceof RegistrarEventoError || error instanceof ConsultaNfseError) {
    const issues = error.erros.map(sefinIssue);
    return issues.length ? issues : [{ code: 'SEFIN_REJECTED', path: '$', severity: 'error', source: 'sefin', message: error.message }];
  }
  if (error instanceof EventoInvalidoError) {
    return [{ code: error.code, path: error.field, severity: 'error', source: 'sdk', message: error.message }];
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

export interface ExplainRejectionToolInput {
  codigos: string[];
}

export interface ExplainRejectionToolOutput {
  explicacoes: ExplicacaoRejeicao[];
}

export const explainRejectionTool: NfseAgentTool<ExplainRejectionToolInput, ExplainRejectionToolOutput> = {
  name: 'explain_rejection',
  title: 'Explicar codigo de rejeicao da SEFIN',
  description:
    'Explica codigos de rejeicao da NFS-e Nacional (ex.: E0014) com a mensagem, a regra e o campo oficiais, ' +
    'extraidos dos anexos publicados em gov.br/nfse. Sem rede e sem certificado. Use apos uma rejeicao para ' +
    'explicar ao usuario o que corrigir. Se conhecida=false, o codigo nao esta no catalogo: nao invente uma causa.',
  inputSchema: {
    type: 'object',
    properties: {
      codigos: {
        type: 'array',
        items: { type: 'string', pattern: '^[Ee]?\\d{4}$|^[A-Z_]+$' },
        description: 'De 1 a 20 codigos retornados pela SEFIN, ex.: ["E0014"].',
      },
    },
    required: ['codigos'],
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object',
    properties: { explicacoes: { type: 'array', items: { type: 'object' } } },
    required: ['explicacoes'],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  requiresCertificate: false,
  async run(input) {
    const codigos = Array.isArray(input?.codigos) ? input.codigos.slice(0, 20) : [];
    return { explicacoes: codigos.map((codigo) => explicarRejeicao(String(codigo))) };
  },
};

export interface RecoverNfseToolInput {
  dpsId: string;
}

export interface RecoverNfseToolOutput {
  ok: boolean;
  ambiente: Ambiente;
  dpsId: string;
  /** True when SEFIN has an NFS-e for this DPS. */
  encontrada?: boolean;
  chaveAcesso?: string;
  resumo?: NfseResumo;
  issues: NfseAgentIssue[];
}

function certificateRequired(): NfseAgentIssue {
  return { code: 'CERTIFICATE_REQUIRED', path: '$', severity: 'error', source: 'certificate', message: 'O host nao configurou um certificado A1 para falar com a SEFIN.' };
}

export const recoverNfseByDpsTool: NfseAgentTool<RecoverNfseToolInput, RecoverNfseToolOutput> = {
  name: 'recover_nfse_by_dps',
  title: 'Recuperar NFS-e pelo Id da DPS',
  description:
    'Descobre se a SEFIN gerou uma NFS-e para um Id de DPS (45 caracteres, "DPS" + 42 digitos). ' +
    'Use depois de um timeout ou resposta ambigua na emissao, antes de qualquer reenvio. ' +
    'encontrada=false significa que a DPS nao chegou a SEFIN.',
  inputSchema: {
    type: 'object',
    properties: { dpsId: { type: 'string', pattern: '^DPS\\d{42}$', description: 'Id da DPS.' } },
    required: ['dpsId'],
    additionalProperties: false,
  },
  outputSchema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  requiresCertificate: true,
  async run(input, context) {
    const ambiente = resolveAmbiente(context);
    const dpsId = String(input?.dpsId ?? '');
    if (!/^DPS\d{42}$/.test(dpsId)) {
      return { ok: false, ambiente, dpsId, issues: [{ code: 'SEFIN_PARAMETER_INVALID', path: 'dpsId', severity: 'error', source: 'sdk', message: 'dpsId deve ser "DPS" seguido de 42 digitos.' }] };
    }
    if (!context?.pfx) return { ok: false, ambiente, dpsId, issues: [certificateRequired()] };
    try {
      const nota = await recuperarNfsePorDps(dpsId, context.pfx, ambiente);
      if (!nota) return { ok: true, ambiente, dpsId, encontrada: false, issues: [] };
      return { ok: true, ambiente, dpsId, encontrada: true, chaveAcesso: nota.chaveAcesso, resumo: nota.resumo, issues: [] };
    } catch (error) {
      const issues = toAgentIssues(error);
      if (!issues) throw error;
      return { ok: false, ambiente, dpsId, issues };
    }
  },
};

/** Read-only tools: no tool here sends a document to SEFIN. */
export const nfseAgentTools: readonly NfseAgentTool[] = [
  validateDpsTool,
  buildDpsXmlTool,
  getNfseTool,
  recoverNfseByDpsTool,
  explainRejectionTool,
];

// ---------------------------------------------------------------- write tools

export interface NfseAgentToolkitOptions {
  /**
   * Enables `prepare_*` / `confirm_*` tools that emit and cancel NFS-e. Off by
   * default. Even when enabled, nothing is sent until the model calls
   * `confirm_*` with the id returned by `prepare_*`, which the model must only
   * do after the user approves the summary.
   */
  allowWrite?: boolean;
  /** How long a prepared emission/cancellation can be confirmed. Default: 10 minutes. */
  confirmationTtlMs?: number;
}

export interface NfseAgentToolkit {
  tools: readonly NfseAgentTool[];
  /** Number of prepared operations still waiting for confirmation. */
  pendingCount(): number;
}

interface PendingEmission {
  kind: 'emission';
  nota: NotaPreparada;
  attempted: boolean;
  expiresAt: number;
}

interface PendingCancellation {
  kind: 'cancellation';
  built: BuiltPedRegEvento;
  expiresAt: number;
}

const CONFIRMATION_ID = { type: 'string', description: 'Id devolvido por prepare_*, valido por poucos minutos e de uso unico.' };

function emissionSummary(request: DpsJsonRequest, nota: NotaPreparada) {
  const emissao = (request.emissao ?? {}) as unknown as Record<string, any>;
  const tomador = emissao.tomador as Record<string, any> | undefined;
  return {
    ambiente: nota.ambiente,
    dpsId: nota.dpsId,
    prestador: request.prestador?.cnpj ?? (request.prestador as { cpf?: string } | undefined)?.cpf,
    tomador: tomador ? { documento: tomador.CNPJ ?? tomador.CPF ?? tomador.NIF, nome: tomador.xNome } : undefined,
    servico: { cTribNac: request.servico?.cTribNac, descricao: request.servico?.xDescServ },
    valorServico: emissao.valores?.vServ ?? emissao.vServ,
    competencia: emissao.dCompet,
    serie: emissao.serie ?? request.prestador?.serie,
    nDPS: emissao.nDPS,
  };
}

/**
 * Builds the tool list for an agent session. Read-only tools are always
 * included; emission and cancellation are added only with `allowWrite: true`
 * and always take two steps (prepare, then confirm after user approval).
 */
export function createNfseAgentToolkit(options: NfseAgentToolkitOptions = {}): NfseAgentToolkit {
  const ttl = options.confirmationTtlMs ?? 10 * 60_000;
  const pending = new Map<string, PendingEmission | PendingCancellation>();
  const sweep = () => {
    const now = Date.now();
    for (const [id, entry] of pending) if (entry.expiresAt <= now) pending.delete(id);
  };
  const confirmationText = (ambiente: Ambiente) =>
    `Mostre este resumo ao usuario e so chame o confirm com o confirmationId depois de uma aprovacao explicita. ` +
    `Ambiente: ${ambiente === 'producao' ? 'PRODUCAO (nota com validade juridica)' : 'producao restrita (teste, sem validade juridica)'}.`;

  const prepareEmission: NfseAgentTool<DpsRequestToolInput, Record<string, unknown>> = {
    name: 'prepare_nfse_emission',
    title: 'Preparar emissao de NFS-e',
    description:
      'Valida, monta e assina a DPS SEM enviar. Retorna um resumo e um confirmationId. Mostre o resumo ao usuario ' +
      'e chame confirm_nfse_emission somente depois que ele aprovar explicitamente. Nunca confirme por conta propria.',
    inputSchema: DPS_REQUEST_INPUT_SCHEMA,
    outputSchema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    requiresCertificate: true,
    async run(input, context) {
      sweep();
      const { ambiente, issues, warnings, request } = validateForAgent(input, context);
      if (issues.length) return { ok: false, ambiente, issues, warnings };
      if (!context?.pfx) return { ok: false, ambiente, issues: [certificateRequired()], warnings };
      try {
        const nota = prepararNota(request, context.pfx);
        const confirmationId = randomUUID();
        const expiresAt = Date.now() + ttl;
        pending.set(confirmationId, { kind: 'emission', nota, attempted: false, expiresAt });
        return {
          ok: true,
          confirmationId,
          expiresAt: new Date(expiresAt).toISOString(),
          resumo: emissionSummary(request, nota),
          warnings,
          instrucoes: confirmationText(ambiente),
        };
      } catch (error) {
        const mapped = toAgentIssues(error);
        if (!mapped) throw error;
        return { ok: false, ambiente, issues: mapped, warnings };
      }
    },
  };

  const confirmEmission: NfseAgentTool<{ confirmationId: string }, Record<string, unknown>> = {
    name: 'confirm_nfse_emission',
    title: 'Confirmar emissao de NFS-e',
    description:
      'Transmite a DPS preparada por prepare_nfse_emission. Chame SOMENTE depois que o usuario aprovar o resumo. ' +
      'Se a conexao falhar, o SDK consulta a DPS antes de qualquer reenvio, entao repetir a confirmacao nao duplica a nota.',
    inputSchema: { type: 'object', properties: { confirmationId: CONFIRMATION_ID }, required: ['confirmationId'], additionalProperties: false },
    outputSchema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    requiresCertificate: true,
    async run(input, context) {
      sweep();
      const id = String(input?.confirmationId ?? '');
      const entry = pending.get(id);
      if (!entry || entry.kind !== 'emission') {
        return { ok: false, issues: [{ code: 'CONFIRMATION_NOT_FOUND', path: 'confirmationId', severity: 'error', source: 'sdk', message: 'confirmationId desconhecido, ja usado ou expirado. Prepare a emissao novamente.' }] };
      }
      if (!context?.pfx) return { ok: false, issues: [certificateRequired()] };
      const { nota } = entry;
      if (entry.attempted) {
        // A previous attempt failed without an answer: never resend before asking SEFIN.
        const existing = await recuperarNfsePorDps(nota.dpsId, context.pfx, nota.ambiente);
        if (existing) {
          pending.delete(id);
          return { ok: true, recuperada: true, chaveAcesso: existing.chaveAcesso, dpsId: nota.dpsId, resumo: existing.resumo };
        }
      }
      entry.attempted = true;
      try {
        const result = await transmitirNotaPreparada(nota, context.pfx);
        pending.delete(id);
        return { ok: true, chaveAcesso: result.chaveAcesso, dpsId: result.dpsId, ambiente: nota.ambiente };
      } catch (error) {
        const mapped = toAgentIssues(error);
        if (mapped) {
          const incerta = mapped.some((issue) => issue.code === 'INVALID_AUTHORIZATION_RESPONSE');
          if (!incerta) pending.delete(id);
          return { ok: false, dpsId: nota.dpsId, issues: mapped };
        }
        return {
          ok: false,
          dpsId: nota.dpsId,
          resultadoIncerto: true,
          issues: [{
            code: 'TRANSMISSION_UNCERTAIN',
            path: '$',
            severity: 'error',
            source: 'sdk',
            message: `Falha de comunicacao com a SEFIN: ${error instanceof Error ? error.message : String(error)}`,
            suggestion: 'Chame confirm_nfse_emission de novo com o mesmo confirmationId: o SDK consulta a DPS antes de reenviar.',
          }],
        };
      }
    },
  };

  const prepareCancellation: NfseAgentTool<{ chaveAcesso: string; cMotivo: string; xMotivo: string }, Record<string, unknown>> = {
    name: 'prepare_nfse_cancellation',
    title: 'Preparar cancelamento de NFS-e',
    description:
      'Monta e valida o pedido de cancelamento (evento e101101) SEM enviar e mostra a nota que sera cancelada. ' +
      'cMotivo: 1 = erro na emissao, 2 = servico nao prestado, 9 = outros. xMotivo: 15 a 255 caracteres. ' +
      'Chame confirm_nfse_cancellation somente apos aprovacao explicita do usuario.',
    inputSchema: {
      type: 'object',
      properties: {
        chaveAcesso: { type: 'string', pattern: '^\\d{50}$' },
        cMotivo: { type: 'string', enum: ['1', '2', '9'] },
        xMotivo: { type: 'string', minLength: 15, maxLength: 255 },
      },
      required: ['chaveAcesso', 'cMotivo', 'xMotivo'],
      additionalProperties: false,
    },
    outputSchema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    requiresCertificate: true,
    async run(input, context) {
      sweep();
      const ambiente = resolveAmbiente(context);
      if (!context?.pfx) return { ok: false, ambiente, issues: [certificateRequired()] };
      const pfx = context.pfx;
      const autor = pfx instanceof NfseCertificate && (pfx.cnpj || pfx.cpf) ? (pfx.cnpj ? { CNPJ: pfx.cnpj } : { CPF: pfx.cpf }) : undefined;
      if (!autor) {
        return { ok: false, ambiente, issues: [{ code: 'EVENTO_INVALID', path: 'autor', severity: 'error', source: 'certificate', message: 'O certificado do host nao expoe o CNPJ/CPF do titular.' }] };
      }
      try {
        const built = buildCancelamentoFromJson({ ...(input as any), ambiente, autor });
        let nota: NfseResumo;
        try {
          nota = (await obterNfse(built.chaveAcesso, pfx, ambiente)).resumo;
        } catch (error) {
          const mapped = toAgentIssues(error);
          if (!mapped) throw error;
          return { ok: false, ambiente, issues: mapped };
        }
        const confirmationId = randomUUID();
        const expiresAt = Date.now() + ttl;
        pending.set(confirmationId, { kind: 'cancellation', built, expiresAt });
        return {
          ok: true,
          confirmationId,
          expiresAt: new Date(expiresAt).toISOString(),
          nota: { chaveAcesso: nota.chaveAcesso, nNFSe: nota.nNFSe, tomador: nota.tomador, valorLiquido: nota.valores.vLiq, competencia: nota.dps.dCompet },
          motivo: { cMotivo: (input as any).cMotivo, xMotivo: (input as any).xMotivo },
          instrucoes: confirmationText(ambiente),
        };
      } catch (error) {
        const mapped = toAgentIssues(error);
        if (!mapped) throw error;
        return { ok: false, ambiente, issues: mapped };
      }
    },
  };

  const confirmCancellation: NfseAgentTool<{ confirmationId: string }, Record<string, unknown>> = {
    name: 'confirm_nfse_cancellation',
    title: 'Confirmar cancelamento de NFS-e',
    description: 'Envia o cancelamento preparado por prepare_nfse_cancellation. Chame SOMENTE depois que o usuario aprovar.',
    inputSchema: { type: 'object', properties: { confirmationId: CONFIRMATION_ID }, required: ['confirmationId'], additionalProperties: false },
    outputSchema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    requiresCertificate: true,
    async run(input, context) {
      sweep();
      const id = String(input?.confirmationId ?? '');
      const entry = pending.get(id);
      if (!entry || entry.kind !== 'cancellation') {
        return { ok: false, issues: [{ code: 'CONFIRMATION_NOT_FOUND', path: 'confirmationId', severity: 'error', source: 'sdk', message: 'confirmationId desconhecido, ja usado ou expirado. Prepare o cancelamento novamente.' }] };
      }
      if (!context?.pfx) return { ok: false, issues: [certificateRequired()] };
      pending.delete(id);
      try {
        const result = await registrarEvento(entry.built, context.pfx);
        return { ok: true, chaveAcesso: result.chaveAcesso, pedRegEventoId: result.pedRegEventoId };
      } catch (error) {
        const mapped = toAgentIssues(error);
        if (!mapped) throw error;
        return { ok: false, chaveAcesso: entry.built.chaveAcesso, issues: mapped };
      }
    },
  };

  const tools = options.allowWrite
    ? [...nfseAgentTools, prepareEmission, confirmEmission, prepareCancellation, confirmCancellation]
    : [...nfseAgentTools];
  return { tools, pendingCount: () => (sweep(), pending.size) };
}
