import https from 'node:https';
import { performance } from 'node:perf_hooks';
import { resolveAdnBaseUrl, resolveSefinBaseUrl } from './config.js';
import { resolveCredentials, type CertificateInput } from './certificate.js';
import type { Ambiente } from './config.js';

/** Evita que uma conexao travada com o SEFIN prenda um worker indefinidamente. */
const SEFIN_REQUEST_TIMEOUT_MS = 60_000;
export const SEFIN_LATENCY_METRICS_ENV = 'NFSE_SEFIN_LATENCY_METRICS';

/** The access key is not 50 digits; raised before any network I/O so it never reaches the URL path. */
export class ChaveAcessoInvalidaError extends Error {
  readonly code = 'CHAVE_ACESSO_INVALID_FORMAT';
  constructor(public readonly chaveAcesso: string) {
    super('chaveAcesso deve ter exatamente 50 digitos numericos.');
    this.name = 'ChaveAcessoInvalidaError';
  }
}

export function assertChaveAcesso(chave: unknown): string {
  if (typeof chave !== 'string' || !/^\d{50}$/.test(chave)) throw new ChaveAcessoInvalidaError(String(chave));
  return chave;
}

/** A path parameter has the wrong format; raised before any network I/O. */
export class SefinParametroInvalidoError extends Error {
  readonly code = 'SEFIN_PARAMETER_INVALID';
  constructor(public readonly field: string, public readonly value: string, expected: string) {
    super(`${field} invalido: esperado ${expected}.`);
    this.name = 'SefinParametroInvalidoError';
  }
}

function assertSegment(field: string, value: unknown, pattern: RegExp, expected: string): string {
  const text = typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : value;
  if (typeof text !== 'string' || !pattern.test(text)) throw new SefinParametroInvalidoError(field, String(value), expected);
  return text;
}

/** Id da DPS (TSIdDPS): "DPS" + 42 digitos. */
export function assertDpsId(dpsId: unknown): string {
  return assertSegment('dpsId', dpsId, /^DPS\d{42}$/, '"DPS" seguido de 42 digitos');
}

export interface SefinRequestOptions {
  /** Timeout por requisicao em ms. Default: 60000. */
  timeoutMs?: number;
  /**
   * Novas tentativas com backoff exponencial para falhas transitorias (erro de
   * rede, HTTP 429/502/503/504). Aplicado somente a GETs, que sao idempotentes:
   * emissao e eventos nunca sao repetidos automaticamente. Default: 0.
   */
  retries?: number;
  /** Cancela a requisicao (e as novas tentativas pendentes). */
  signal?: AbortSignal;
}

export interface SefinErro {
  Codigo: string;
  Descricao: string;
  Complemento?: string;
}

export interface SefinResposta {
  status: number;
  /** Corpo bruto parseado (JSON) */
  body: any;
}

export type SefinOperation =
  | 'transmitir_dps'
  | 'consultar_nfse'
  | 'consultar_dps'
  | 'enviar_evento'
  | 'consultar_evento'
  | 'baixar_danfse'
  | 'adn_distribuicao_nsu'
  | 'adn_eventos_chave'
  | 'adn_parametros_municipais';

export interface SefinRequestMetric {
  operation: SefinOperation;
  ambiente?: Ambiente;
  method: 'GET' | 'POST';
  pathTemplate: string;
  durationMs: number;
  status?: number;
  success: boolean;
  errorName?: string;
  errorMessage?: string;
}

export type SefinRequestObserver = (metric: SefinRequestMetric) => void;

export interface SefinLatencyTrackerOptions {
  /**
   * Maximum number of recent latency samples kept for each operation/environment
   * series. Min, max, average, and optional percentiles use this rolling window.
   */
  maxSamplesPerSeries?: number;
  /** Percentile metrics are intentionally opt-in because they keep extra series in exporters. */
  includePercentiles?: boolean;
}

export interface SefinLatencySeriesSnapshot {
  operation: SefinOperation;
  ambiente?: Ambiente;
  count: number;
  successCount: number;
  errorCount: number;
  sampleCount: number;
  minMs: number;
  maxMs: number;
  avgMs: number;
  p50Ms?: number;
  p95Ms?: number;
  p99Ms?: number;
}

export interface SefinLatencySnapshot {
  generatedAt: string;
  series: SefinLatencySeriesSnapshot[];
}

export interface SefinLatencyTracker {
  observe(metric: SefinRequestMetric): void;
  snapshot(): SefinLatencySnapshot;
  reset(): void;
}

interface SefinRespostaRaw {
  status: number;
  contentType: string;
  buffer: Buffer;
}

interface RequestOpts {
  method: 'GET' | 'POST';
  /** Caminho relativo à base do SefinNacional, ex.: "/nfse" ou "/nfse/<chave>" */
  path: string;
  jsonBody?: unknown;
  /** Header Accept. Default: application/json. */
  accept?: string;
}

interface RequestMetricOpts {
  operation: SefinOperation;
  ambiente?: Ambiente;
  pathTemplate: string;
}

let sefinRequestObserver: SefinRequestObserver | undefined;

export function isSefinLatencyMetricsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const value = env[SEFIN_LATENCY_METRICS_ENV]?.trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
}

export function setSefinRequestObserver(observer: SefinRequestObserver | undefined): void {
  sefinRequestObserver = observer;
}

export function getSefinRequestObserver(): SefinRequestObserver | undefined {
  return sefinRequestObserver;
}

function notifySefinRequestObserver(metric: SefinRequestMetric): void {
  if (!isSefinLatencyMetricsEnabled()) return;

  try {
    sefinRequestObserver?.(metric);
  } catch {
    // Observability hooks must not change SDK transport behavior.
  }
}

function percentile(sortedValues: number[], quantile: number): number {
  if (!sortedValues.length) return 0;
  const index = Math.min(sortedValues.length - 1, Math.max(0, Math.ceil(sortedValues.length * quantile) - 1));
  return sortedValues[index];
}

function trackerKey(metric: Pick<SefinRequestMetric, 'operation' | 'ambiente'>): string {
  return `${metric.operation}:${metric.ambiente ?? 'default'}`;
}

export function createSefinLatencyTracker(options: SefinLatencyTrackerOptions = {}): SefinLatencyTracker {
  const maxSamplesPerSeries = Math.max(1, Math.floor(options.maxSamplesPerSeries ?? 1_000));
  const includePercentiles = options.includePercentiles === true;
  const series = new Map<string, {
    operation: SefinOperation;
    ambiente?: Ambiente;
    count: number;
    successCount: number;
    errorCount: number;
    durations: number[];
  }>();

  return {
    observe(metric) {
      const key = trackerKey(metric);
      let bucket = series.get(key);
      if (!bucket) {
        bucket = {
          operation: metric.operation,
          ambiente: metric.ambiente,
          count: 0,
          successCount: 0,
          errorCount: 0,
          durations: [],
        };
        series.set(key, bucket);
      }

      bucket.count += 1;
      if (metric.success) bucket.successCount += 1;
      else bucket.errorCount += 1;
      bucket.durations.push(metric.durationMs);
      if (bucket.durations.length > maxSamplesPerSeries) {
        bucket.durations.splice(0, bucket.durations.length - maxSamplesPerSeries);
      }
    },
    snapshot() {
      return {
        generatedAt: new Date().toISOString(),
        series: Array.from(series.values()).map((bucket) => {
          const sortedDurations = [...bucket.durations].sort((a, b) => a - b);
          const total = sortedDurations.reduce((sum, value) => sum + value, 0);

          const snapshot: SefinLatencySeriesSnapshot = {
            operation: bucket.operation,
            ambiente: bucket.ambiente,
            count: bucket.count,
            successCount: bucket.successCount,
            errorCount: bucket.errorCount,
            sampleCount: sortedDurations.length,
            minMs: sortedDurations[0] ?? 0,
            maxMs: sortedDurations.at(-1) ?? 0,
            avgMs: sortedDurations.length ? total / sortedDurations.length : 0,
          };

          if (includePercentiles) {
            snapshot.p50Ms = percentile(sortedDurations, 0.50);
            snapshot.p95Ms = percentile(sortedDurations, 0.95);
            snapshot.p99Ms = percentile(sortedDurations, 0.99);
          }

          return snapshot;
        }).sort((a, b) => (
          a.operation.localeCompare(b.operation) ||
          (a.ambiente ?? '').localeCompare(b.ambiente ?? '')
        )),
      };
    },
    reset() {
      series.clear();
    },
  };
}

/** @internal Request seen by an in-process transport (see `@useinvio/nfse-sdk/testing`). */
export interface SefinTransportRequest {
  method: 'GET' | 'POST';
  url: URL;
  headers: Record<string, string | number>;
  body?: string;
  certificate: CertificateInput;
  signal?: AbortSignal;
}

/** @internal */
export interface SefinTransportResponse {
  status: number;
  contentType?: string;
  body?: Buffer | string;
}

/** @internal */
export type SefinTransport = (request: SefinTransportRequest) => Promise<SefinTransportResponse>;

let sefinTransport: SefinTransport | undefined;

/**
 * @internal Replaces HTTPS with an in-process transport and returns the previous
 * one. Used by `installMockSefin`; never needed in production code.
 */
export function setSefinTransport(transport: SefinTransport | undefined): SefinTransport | undefined {
  const previous = sefinTransport;
  sefinTransport = transport;
  return previous;
}

/**
 * Requisição mTLS de baixo nível ao SefinNacional, retornando o corpo bruto (Buffer).
 * Usa key+cert PEM (ou o agente mTLS dedicado de `NfseCertificate`) no handshake;
 * o .pfx legado ICP-Brasil é rejeitado pelo TLS do Node.
 */
function sefinRequest(
  opts: RequestOpts,
  certificate: CertificateInput,
  metricOpts: RequestMetricOpts,
  baseOverride?: string,
  requestOptions: SefinRequestOptions = {},
): Promise<SefinRespostaRaw> {
  const url = new URL(`${baseOverride ?? resolveSefinBaseUrl()}${opts.path}`);
  const timeoutMs = requestOptions.timeoutMs ?? SEFIN_REQUEST_TIMEOUT_MS;
  const payload = opts.jsonBody != null ? JSON.stringify(opts.jsonBody) : undefined;

  const headers: Record<string, string | number> = {
    Accept: opts.accept ?? 'application/json',
  };
  if (payload != null) {
    headers['Content-Type'] = 'application/json';
    headers['Content-Length'] = Buffer.byteLength(payload);
  }

  const options: https.RequestOptions = {
    method: opts.method,
    hostname: url.hostname,
    port: url.port || 443,
    path: url.pathname + url.search,
    headers,
    ...resolveCredentials(certificate).tls,
    rejectUnauthorized: true,
    timeout: timeoutMs,
    ...(requestOptions.signal ? { signal: requestOptions.signal } : {}),
  };

  return new Promise((resolve, reject) => {
    const startedAt = performance.now();
    let metricSent = false;
    const emitMetric = (metric: Omit<SefinRequestMetric, 'durationMs'>) => {
      if (metricSent) return;
      metricSent = true;
      notifySefinRequestObserver({
        ...metric,
        durationMs: performance.now() - startedAt,
      });
    };

    if (sefinTransport) {
      const base = { operation: metricOpts.operation, ambiente: metricOpts.ambiente, method: opts.method, pathTemplate: metricOpts.pathTemplate };
      sefinTransport({ method: opts.method, url, headers, body: payload, certificate, signal: requestOptions.signal }).then(
        (res) => {
          emitMetric({ ...base, status: res.status, success: res.status >= 200 && res.status < 300 });
          resolve({
            status: res.status,
            contentType: res.contentType ?? 'application/json',
            buffer: Buffer.isBuffer(res.body) ? res.body : Buffer.from(res.body ?? ''),
          });
        },
        (error: Error) => {
          emitMetric({ ...base, success: false, errorName: error.name, errorMessage: error.message });
          reject(error);
        },
      );
      return;
    }

    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const status = res.statusCode ?? 0;
        emitMetric({
          operation: metricOpts.operation,
          ambiente: metricOpts.ambiente,
          method: opts.method,
          pathTemplate: metricOpts.pathTemplate,
          status,
          success: status >= 200 && status < 300,
        });
        resolve({
          status,
          contentType: String(res.headers['content-type'] ?? ''),
          buffer: Buffer.concat(chunks),
        });
      });
    });
    req.on('error', (error) => {
      emitMetric({
        operation: metricOpts.operation,
        ambiente: metricOpts.ambiente,
        method: opts.method,
        pathTemplate: metricOpts.pathTemplate,
        success: false,
        errorName: error.name,
        errorMessage: error.message,
      });
      reject(error);
    });
    req.on('timeout', () => {
      req.destroy(new Error(`SEFIN request timed out after ${timeoutMs}ms`));
    });
    if (payload != null) req.write(payload);
    req.end();
  });
}

const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);

function retryDelayMs(attempt: number): number {
  const base = Math.min(4_000, 500 * 2 ** attempt);
  return base / 2 + Math.random() * (base / 2);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(signal.reason); return; }
    const timer = setTimeout(() => { signal?.removeEventListener('abort', onAbort); resolve(); }, ms);
    const onAbort = () => { clearTimeout(timer); reject(signal!.reason); };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Executes the request, retrying transient failures. Only GETs are retried:
 * emission and event POSTs are not idempotent and must never be resent blindly
 * (recover a timed-out emission with `consultarDps`).
 */
async function sefinRequestWithRetry(
  opts: RequestOpts,
  certificate: CertificateInput,
  metricOpts: RequestMetricOpts,
  baseOverride: string | undefined,
  requestOptions: SefinRequestOptions = {},
): Promise<SefinRespostaRaw> {
  const retries = opts.method === 'GET' ? Math.max(0, Math.floor(requestOptions.retries ?? 0)) : 0;
  for (let attempt = 0; ; attempt += 1) {
    try {
      const res = await sefinRequest(opts, certificate, metricOpts, baseOverride, requestOptions);
      if (attempt < retries && RETRYABLE_STATUS.has(res.status)) {
        await sleep(retryDelayMs(attempt), requestOptions.signal);
        continue;
      }
      return res;
    } catch (error) {
      if (attempt >= retries || requestOptions.signal?.aborted) throw error;
      await sleep(retryDelayMs(attempt), requestOptions.signal);
    }
  }
}

/** Parseia o corpo como JSON; mantém texto cru se não for JSON (ex.: 403 HTML). */
function parseJson(raw: SefinRespostaRaw): SefinResposta {
  const text = raw.buffer.toString('utf-8');
  try {
    return { status: raw.status, body: text ? JSON.parse(text) : null };
  } catch {
    return { status: raw.status, body: text };
  }
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeErro(value: any): SefinErro {
  const erro: SefinErro = {
    Codigo: String(value.Codigo ?? value.codigo ?? value.code ?? 'DESCONHECIDO'),
    Descricao: String(value.Descricao ?? value.descricao ?? value.mensagem ?? value.message ?? ''),
  };
  const complemento = value.Complemento ?? value.complemento;
  if (complemento != null) erro.Complemento = String(complemento);
  return erro;
}

function isSefinSuccessBody(body: Record<string, any>): boolean {
  return (
    body.sucesso === true ||
    typeof body.chaveAcesso === 'string' ||
    typeof body.nfseXmlGZipB64 === 'string' ||
    typeof body.idDps === 'string'
  );
}

/** Normaliza a lista de erros retornada pelo SEFIN em diferentes formatos. */
export function extrairErros(body: any): SefinErro[] {
  if (!body) return [];
  if (Array.isArray(body)) return body.map(normalizeErro);
  if (!isRecord(body)) {
    return [{ Codigo: 'DESCONHECIDO', Descricao: String(body) }];
  }
  if (isSefinSuccessBody(body)) return [];
  if (Array.isArray(body.erros)) return body.erros.map(normalizeErro);
  if (Array.isArray(body.Erros)) return body.Erros.map(normalizeErro);
  if (Array.isArray(body.erro)) return body.erro.map(normalizeErro);
  if (Array.isArray(body.Erro)) return body.Erro.map(normalizeErro);
  if (body.Codigo || body.codigo) {
    return [normalizeErro(body)];
  }
  return [
    { Codigo: 'DESCONHECIDO', Descricao: JSON.stringify(body) },
  ];
}

function sefinBase(ambiente?: Ambiente): string | undefined {
  return ambiente ? resolveSefinBaseUrl(ambiente) : undefined;
}

/** SefinNacional · POST /nfse — transporte baixo nivel de DPS ja compactada em GZip+Base64. Nunca repetido automaticamente. */
export async function transmitirDpsCompactada(
  dpsXmlGZipB64: string,
  pfx: CertificateInput,
  ambiente?: Ambiente,
  options?: SefinRequestOptions,
): Promise<SefinResposta> {
  return parseJson(await sefinRequestWithRetry(
    { method: 'POST', path: '/nfse', jsonBody: { dpsXmlGZipB64 } },
    pfx,
    { operation: 'transmitir_dps', ambiente, pathTemplate: '/nfse' },
    sefinBase(ambiente),
    options,
  ));
}

/** SefinNacional · GET /nfse/{chave} — consulta a NFS-e pela chave de acesso (50 dígitos). */
export async function consultarNfse(
  chave: string,
  pfx: CertificateInput,
  ambiente?: Ambiente,
  options?: SefinRequestOptions,
): Promise<SefinResposta> {
  assertChaveAcesso(chave);
  return parseJson(await sefinRequestWithRetry(
    { method: 'GET', path: `/nfse/${chave}` },
    pfx,
    { operation: 'consultar_nfse', ambiente, pathTemplate: '/nfse/{chave}' },
    sefinBase(ambiente),
    options,
  ));
}

/**
 * SefinNacional · GET /dps/{id} — recupera a chave de acesso da NFS-e gerada a
 * partir de uma DPS. Use para recuperar uma emissao que sofreu timeout em vez
 * de reenviar a DPS.
 */
export async function consultarDps(
  dpsId: string,
  pfx: CertificateInput,
  ambiente?: Ambiente,
  options?: SefinRequestOptions,
): Promise<SefinResposta> {
  assertDpsId(dpsId);
  return parseJson(await sefinRequestWithRetry(
    { method: 'GET', path: `/dps/${dpsId}` },
    pfx,
    { operation: 'consultar_dps', ambiente, pathTemplate: '/dps/{id}' },
    sefinBase(ambiente),
    options,
  ));
}

/**
 * SefinNacional · POST /nfse/{chave}/eventos — registra evento fiscal da NFS-e.
 * O corpo usa o campo oficial `pedidoRegistroEventoXmlGZipB64`. Nunca repetido automaticamente.
 */
export async function enviarEvento(
  pedidoRegistroEventoXmlGZipB64: string,
  pfx: CertificateInput,
  chaveAcesso: string,
  ambiente?: Ambiente,
  options?: SefinRequestOptions,
): Promise<SefinResposta> {
  assertChaveAcesso(chaveAcesso);
  return parseJson(await sefinRequestWithRetry(
    {
      method: 'POST',
      path: `/nfse/${chaveAcesso}/eventos`,
      jsonBody: { pedidoRegistroEventoXmlGZipB64 },
    },
    pfx,
    { operation: 'enviar_evento', ambiente, pathTemplate: '/nfse/{chave}/eventos' },
    sefinBase(ambiente),
    options,
  ));
}

export interface ConsultarEventoOptions extends SefinRequestOptions {
  /** Numero sequencial do evento. Default: 1. */
  nSeqEvento?: number | string;
}

/** SefinNacional · GET /nfse/{chave}/eventos/{tpEvento}/{nSeqEvento} — consulta um evento registrado. */
export async function consultarEvento(
  chaveAcesso: string,
  tpEvento: string,
  pfx: CertificateInput,
  ambiente?: Ambiente,
  options: ConsultarEventoOptions = {},
): Promise<SefinResposta> {
  assertChaveAcesso(chaveAcesso);
  const tipo = assertSegment('tpEvento', tpEvento, /^\d{6}$/, '6 digitos (ex.: 101101)');
  const seq = assertSegment('nSeqEvento', options.nSeqEvento ?? 1, /^\d{1,3}$/, '1 a 3 digitos');
  return parseJson(await sefinRequestWithRetry(
    { method: 'GET', path: `/nfse/${chaveAcesso}/eventos/${tipo}/${seq}` },
    pfx,
    { operation: 'consultar_evento', ambiente, pathTemplate: '/nfse/{chave}/eventos/{tpEvento}/{nSeqEvento}' },
    sefinBase(ambiente),
    options,
  ));
}

export interface DanfseResposta {
  status: number;
  contentType: string;
  /** PDF do DANFSe, presente quando a resposta e 2xx e o corpo e um PDF. */
  pdf?: Buffer;
  /** Corpo parseado quando a resposta nao e um PDF (ex.: JSON de erro). */
  body?: any;
}

/** ADN · GET /danfse/{chave} — baixa o PDF do DANFSe gerado pelo Ambiente de Dados Nacional. */
export async function baixarDanfse(
  chaveAcesso: string,
  pfx: CertificateInput,
  ambiente?: Ambiente,
  options?: SefinRequestOptions,
): Promise<DanfseResposta> {
  assertChaveAcesso(chaveAcesso);
  const raw = await sefinRequestWithRetry(
    { method: 'GET', path: `/danfse/${chaveAcesso}`, accept: 'application/pdf' },
    pfx,
    { operation: 'baixar_danfse', ambiente, pathTemplate: '/danfse/{chave}' },
    resolveAdnBaseUrl(ambiente),
    options,
  );
  const isPdf = raw.buffer.subarray(0, 5).toString('latin1') === '%PDF-';
  if (raw.status >= 200 && raw.status < 300 && isPdf) {
    return { status: raw.status, contentType: raw.contentType, pdf: raw.buffer };
  }
  return { status: raw.status, contentType: raw.contentType, body: parseJson(raw).body };
}

export interface DistribuicaoNsuOptions extends SefinRequestOptions {
  /** CNPJ consultado, quando diferente do titular do certificado. */
  cnpjConsulta?: string;
  /** true (default do ADN) retorna um lote de documentos a partir do NSU. */
  lote?: boolean;
}

/** ADN · GET /contribuintes/DFe/{nsu} — distribuicao de documentos fiscais (emitidos e recebidos) por NSU. */
export async function distribuirDfePorNsu(
  nsu: string | number,
  pfx: CertificateInput,
  ambiente?: Ambiente,
  options: DistribuicaoNsuOptions = {},
): Promise<SefinResposta> {
  const nsuText = assertSegment('nsu', nsu, /^\d{1,20}$/, 'ate 20 digitos');
  const query = new URLSearchParams();
  if (options.cnpjConsulta) {
    query.set('cnpjConsulta', assertSegment('cnpjConsulta', options.cnpjConsulta.replace(/\D/g, ''), /^\d{14}$/, '14 digitos'));
  }
  if (options.lote !== undefined) query.set('lote', String(options.lote));
  const queryString = query.size > 0 ? `?${query.toString()}` : '';
  return parseJson(await sefinRequestWithRetry(
    { method: 'GET', path: `/contribuintes/DFe/${nsuText}${queryString}` },
    pfx,
    { operation: 'adn_distribuicao_nsu', ambiente, pathTemplate: '/contribuintes/DFe/{nsu}' },
    resolveAdnBaseUrl(ambiente),
    options,
  ));
}

/** ADN · GET /contribuintes/NFSe/{chave}/Eventos — todos os eventos vinculados a NFS-e. */
export async function consultarEventosPorChaveAdn(
  chaveAcesso: string,
  pfx: CertificateInput,
  ambiente?: Ambiente,
  options?: SefinRequestOptions,
): Promise<SefinResposta> {
  assertChaveAcesso(chaveAcesso);
  return parseJson(await sefinRequestWithRetry(
    { method: 'GET', path: `/contribuintes/NFSe/${chaveAcesso}/Eventos` },
    pfx,
    { operation: 'adn_eventos_chave', ambiente, pathTemplate: '/contribuintes/NFSe/{chave}/Eventos' },
    resolveAdnBaseUrl(ambiente),
    options,
  ));
}

const COD_MUN = /^\d{7}$/;
const COD_SERVICO = /^[0-9.]{1,12}$/;
const COMPETENCIA = /^\d{4}-\d{2}-\d{2}(T[0-9:.+-]+)?$/;

async function consultarParametrosMunicipais(
  segments: string[],
  pathTemplate: string,
  pfx: CertificateInput,
  ambiente?: Ambiente,
  options?: SefinRequestOptions,
): Promise<SefinResposta> {
  const path = `/parametrizacao/${segments.map(encodeURIComponent).join('/')}`;
  return parseJson(await sefinRequestWithRetry(
    { method: 'GET', path },
    pfx,
    { operation: 'adn_parametros_municipais', ambiente, pathTemplate },
    resolveAdnBaseUrl(ambiente),
    options,
  ));
}

/** ADN · GET /parametrizacao/{codMun}/convenio — situacao do convenio do municipio com o Sistema Nacional. */
export async function consultarConvenio(
  codigoMunicipio: string,
  pfx: CertificateInput,
  ambiente?: Ambiente,
  options?: SefinRequestOptions,
): Promise<SefinResposta> {
  const mun = assertSegment('codigoMunicipio', codigoMunicipio, COD_MUN, '7 digitos IBGE');
  return consultarParametrosMunicipais([mun, 'convenio'], '/parametrizacao/{codMun}/convenio', pfx, ambiente, options);
}

/**
 * ADN · GET /parametrizacao/{codMun}/{codServico}/{competencia}/aliquota — aliquota
 * do ISSQN vigente para o servico na competencia (AAAA-MM-DD).
 */
export async function consultarAliquota(
  codigoMunicipio: string,
  codigoServico: string,
  competencia: string,
  pfx: CertificateInput,
  ambiente?: Ambiente,
  options?: SefinRequestOptions,
): Promise<SefinResposta> {
  return consultarParametrosMunicipais(
    [
      assertSegment('codigoMunicipio', codigoMunicipio, COD_MUN, '7 digitos IBGE'),
      assertSegment('codigoServico', codigoServico, COD_SERVICO, 'codigo de servico (ex.: 01.01.01)'),
      assertSegment('competencia', competencia, COMPETENCIA, 'data AAAA-MM-DD'),
      'aliquota',
    ],
    '/parametrizacao/{codMun}/{codServico}/{competencia}/aliquota',
    pfx,
    ambiente,
    options,
  );
}

/** ADN · GET /parametrizacao/{codMun}/{codServico}/historicoaliquotas — historico de aliquotas do servico. */
export async function consultarHistoricoAliquotas(
  codigoMunicipio: string,
  codigoServico: string,
  pfx: CertificateInput,
  ambiente?: Ambiente,
  options?: SefinRequestOptions,
): Promise<SefinResposta> {
  return consultarParametrosMunicipais(
    [
      assertSegment('codigoMunicipio', codigoMunicipio, COD_MUN, '7 digitos IBGE'),
      assertSegment('codigoServico', codigoServico, COD_SERVICO, 'codigo de servico (ex.: 01.01.01)'),
      'historicoaliquotas',
    ],
    '/parametrizacao/{codMun}/{codServico}/historicoaliquotas',
    pfx,
    ambiente,
    options,
  );
}

/** ADN · GET /parametrizacao/{codMun}/{codServico}/{competencia}/regimes_especiais — regimes especiais de tributacao. */
export async function consultarRegimesEspeciais(
  codigoMunicipio: string,
  codigoServico: string,
  competencia: string,
  pfx: CertificateInput,
  ambiente?: Ambiente,
  options?: SefinRequestOptions,
): Promise<SefinResposta> {
  return consultarParametrosMunicipais(
    [
      assertSegment('codigoMunicipio', codigoMunicipio, COD_MUN, '7 digitos IBGE'),
      assertSegment('codigoServico', codigoServico, COD_SERVICO, 'codigo de servico (ex.: 01.01.01)'),
      assertSegment('competencia', competencia, COMPETENCIA, 'data AAAA-MM-DD'),
      'regimes_especiais',
    ],
    '/parametrizacao/{codMun}/{codServico}/{competencia}/regimes_especiais',
    pfx,
    ambiente,
    options,
  );
}

/** ADN · GET /parametrizacao/{codMun}/{competencia}/retencoes — retencoes de ISSQN do municipio. */
export async function consultarRetencoes(
  codigoMunicipio: string,
  competencia: string,
  pfx: CertificateInput,
  ambiente?: Ambiente,
  options?: SefinRequestOptions,
): Promise<SefinResposta> {
  return consultarParametrosMunicipais(
    [
      assertSegment('codigoMunicipio', codigoMunicipio, COD_MUN, '7 digitos IBGE'),
      assertSegment('competencia', competencia, COMPETENCIA, 'data AAAA-MM-DD'),
      'retencoes',
    ],
    '/parametrizacao/{codMun}/{competencia}/retencoes',
    pfx,
    ambiente,
    options,
  );
}

/** ADN · GET /parametrizacao/{codMun}/{numeroBeneficio}/{competencia}/beneficio — beneficio municipal. */
export async function consultarBeneficio(
  codigoMunicipio: string,
  numeroBeneficio: string,
  competencia: string,
  pfx: CertificateInput,
  ambiente?: Ambiente,
  options?: SefinRequestOptions,
): Promise<SefinResposta> {
  return consultarParametrosMunicipais(
    [
      assertSegment('codigoMunicipio', codigoMunicipio, COD_MUN, '7 digitos IBGE'),
      assertSegment('numeroBeneficio', numeroBeneficio, /^[0-9A-Za-z]{1,20}$/, 'ate 20 caracteres alfanumericos'),
      assertSegment('competencia', competencia, COMPETENCIA, 'data AAAA-MM-DD'),
      'beneficio',
    ],
    '/parametrizacao/{codMun}/{numeroBeneficio}/{competencia}/beneficio',
    pfx,
    ambiente,
    options,
  );
}
