import https from 'node:https';
import { performance } from 'node:perf_hooks';
import { resolveAdnBaseUrl, resolveSefinBaseUrl } from './config.js';
import type { PfxMaterial } from './loadPfx.js';
import type { Ambiente } from './config.js';

/** Evita que uma conexao travada com o SEFIN prenda um worker indefinidamente. */
const SEFIN_REQUEST_TIMEOUT_MS = 60_000;
export const SEFIN_LATENCY_METRICS_ENV = 'NFSE_SEFIN_LATENCY_METRICS';

export interface SefinRequestOptions {
  /** Timeout por requisicao em ms. Default: 60000. */
  timeoutMs?: number;
  /**
   * Numero de novas tentativas com backoff exponencial para falhas transitorias
   * (erro de rede ou HTTP 502/503/504). Aplicado apenas a operacoes GET,
   * que sao idempotentes. Default: 0.
   */
  retries?: number;
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
  /** Valor do header Accept. Default: application/json. */
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

/**
 * Requisição mTLS de baixo nível ao SefinNacional, retornando o corpo bruto (Buffer).
 * Usa key+cert PEM no handshake (o .pfx legado ICP-Brasil é rejeitado pelo TLS do Node).
 */
function sefinRequest(
  opts: RequestOpts,
  pfx: PfxMaterial,
  metricOpts: RequestMetricOpts,
  baseOverride?: string,
  requestOptions?: SefinRequestOptions,
): Promise<SefinRespostaRaw> {
  const url = new URL(`${baseOverride ?? resolveSefinBaseUrl()}${opts.path}`);
  const payload = opts.jsonBody != null ? JSON.stringify(opts.jsonBody) : undefined;
  const timeoutMs = requestOptions?.timeoutMs ?? SEFIN_REQUEST_TIMEOUT_MS;

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
    key: pfx.privateKeyPem,
    cert: pfx.certPem,
    rejectUnauthorized: true,
    timeout: timeoutMs,
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

const RETRYABLE_STATUS = new Set([502, 503, 504]);

function retryDelayMs(attempt: number): number {
  return Math.min(4_000, 500 * 2 ** attempt);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Executa a requisicao com novas tentativas para falhas transitorias.
 * Apenas GETs sao repetidos: POSTs de emissao/evento nao sao idempotentes.
 */
async function sefinRequestWithRetry(
  opts: RequestOpts,
  pfx: PfxMaterial,
  metricOpts: RequestMetricOpts,
  baseOverride?: string,
  requestOptions?: SefinRequestOptions,
): Promise<SefinRespostaRaw> {
  const retries = opts.method === 'GET' ? Math.max(0, Math.floor(requestOptions?.retries ?? 0)) : 0;

  for (let attempt = 0; ; attempt += 1) {
    try {
      const res = await sefinRequest(opts, pfx, metricOpts, baseOverride, requestOptions);
      if (attempt < retries && RETRYABLE_STATUS.has(res.status)) {
        await sleep(retryDelayMs(attempt));
        continue;
      }
      return res;
    } catch (error) {
      if (attempt < retries) {
        await sleep(retryDelayMs(attempt));
        continue;
      }
      throw error;
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

/** SefinNacional · POST /nfse — transporte baixo nivel de DPS ja compactada em GZip+Base64. */
export async function transmitirDpsCompactada(
  dpsXmlGZipB64: string,
  pfx: PfxMaterial,
  ambiente?: Ambiente,
  options?: SefinRequestOptions,
): Promise<SefinResposta> {
  const base = ambiente ? resolveSefinBaseUrl(ambiente) : undefined;
  return parseJson(await sefinRequestWithRetry(
    { method: 'POST', path: '/nfse', jsonBody: { dpsXmlGZipB64 } },
    pfx,
    { operation: 'transmitir_dps', ambiente, pathTemplate: '/nfse' },
    base,
    options,
  ));
}

/** SefinNacional · GET /nfse/{chave} — consulta a NFS-e pela chave de acesso (50 dígitos). */
export async function consultarNfse(
  chave: string,
  pfx: PfxMaterial,
  ambiente?: Ambiente,
  options?: SefinRequestOptions,
): Promise<SefinResposta> {
  const base = ambiente ? resolveSefinBaseUrl(ambiente) : undefined;
  return parseJson(await sefinRequestWithRetry(
    { method: 'GET', path: `/nfse/${chave}` },
    pfx,
    { operation: 'consultar_nfse', ambiente, pathTemplate: '/nfse/{chave}' },
    base,
    options,
  ));
}

/**
 * SefinNacional · GET /dps/{id} — consulta a NFS-e pelo Id da DPS (45 caracteres).
 * Util para idempotencia: recuperar a chave de acesso quando a emissao sofreu timeout.
 */
export async function consultarDps(
  dpsId: string,
  pfx: PfxMaterial,
  ambiente?: Ambiente,
  options?: SefinRequestOptions,
): Promise<SefinResposta> {
  const base = ambiente ? resolveSefinBaseUrl(ambiente) : undefined;
  return parseJson(await sefinRequestWithRetry(
    { method: 'GET', path: `/dps/${dpsId}` },
    pfx,
    { operation: 'consultar_dps', ambiente, pathTemplate: '/dps/{id}' },
    base,
    options,
  ));
}

/** SefinNacional · POST /nfse/{chave}/eventos — registra evento fiscal da NFS-e. */
export async function enviarEvento(
  pedRegXmlGZipB64: string,
  pfx: PfxMaterial,
  chaveAcesso: string,
  ambiente?: Ambiente,
  options?: SefinRequestOptions,
): Promise<SefinResposta> {
  const base = ambiente ? resolveSefinBaseUrl(ambiente) : undefined;
  return parseJson(
    await sefinRequestWithRetry(
      {
        method: 'POST',
        path: `/nfse/${chaveAcesso}/eventos`,
        jsonBody: { pedRegXmlGZipB64 },
      },
      pfx,
      { operation: 'enviar_evento', ambiente, pathTemplate: '/nfse/{chave}/eventos' },
      base,
      options,
    ),
  );
}

/**
 * SefinNacional · GET /nfse/{chave}/eventos/{tpEvento}[/{nSeqEvento}] — consulta
 * eventos registrados para a NFS-e. Sem nSeqEvento retorna todos do tipo.
 */
export async function consultarEvento(
  chaveAcesso: string,
  tpEvento: string,
  nSeqEvento: string | number | undefined,
  pfx: PfxMaterial,
  ambiente?: Ambiente,
  options?: SefinRequestOptions,
): Promise<SefinResposta> {
  const base = ambiente ? resolveSefinBaseUrl(ambiente) : undefined;
  const seqPath = nSeqEvento != null ? `/${nSeqEvento}` : '';
  return parseJson(await sefinRequestWithRetry(
    { method: 'GET', path: `/nfse/${chaveAcesso}/eventos/${tpEvento}${seqPath}` },
    pfx,
    {
      operation: 'consultar_evento',
      ambiente,
      pathTemplate: nSeqEvento != null ? '/nfse/{chave}/eventos/{tpEvento}/{nSeqEvento}' : '/nfse/{chave}/eventos/{tpEvento}',
    },
    base,
    options,
  ));
}

export interface DanfseResposta {
  status: number;
  contentType: string;
  /** Presente quando a resposta e um PDF valido. */
  pdf?: Buffer;
  /** Corpo parseado quando a resposta nao e um PDF (ex.: JSON de erro). */
  body?: any;
}

/** SefinNacional · GET /danfse/{chave} — baixa o PDF do DANFSe da NFS-e. */
export async function baixarDanfse(
  chaveAcesso: string,
  pfx: PfxMaterial,
  ambiente?: Ambiente,
  options?: SefinRequestOptions,
): Promise<DanfseResposta> {
  const base = ambiente ? resolveSefinBaseUrl(ambiente) : undefined;
  const raw = await sefinRequestWithRetry(
    { method: 'GET', path: `/danfse/${chaveAcesso}`, accept: 'application/pdf' },
    pfx,
    { operation: 'baixar_danfse', ambiente, pathTemplate: '/danfse/{chave}' },
    base,
    options,
  );

  const isPdf = raw.contentType.includes('pdf') || raw.buffer.subarray(0, 5).toString('latin1') === '%PDF-';
  if (raw.status >= 200 && raw.status < 300 && isPdf) {
    return { status: raw.status, contentType: raw.contentType, pdf: raw.buffer };
  }
  const { body } = parseJson(raw);
  return { status: raw.status, contentType: raw.contentType, body };
}

export interface DistribuicaoNsuOptions extends SefinRequestOptions {
  /** CNPJ/CPF consultante, quando diferente do titular do certificado. */
  cnpjConsulta?: string;
  /** Quando true, retorna um lote de documentos a partir do NSU informado. */
  lote?: boolean;
}

/** ADN · GET /contribuintes/DFe/{nsu} — distribuicao de documentos fiscais por NSU. */
export async function distribuirDfePorNsu(
  nsu: string | number,
  pfx: PfxMaterial,
  ambiente?: Ambiente,
  options?: DistribuicaoNsuOptions,
): Promise<SefinResposta> {
  const query = new URLSearchParams();
  if (options?.cnpjConsulta) query.set('cnpjConsulta', options.cnpjConsulta);
  if (options?.lote !== undefined) query.set('lote', String(options.lote));
  const queryString = query.size > 0 ? `?${query.toString()}` : '';

  return parseJson(await sefinRequestWithRetry(
    { method: 'GET', path: `/contribuintes/DFe/${nsu}${queryString}` },
    pfx,
    { operation: 'adn_distribuicao_nsu', ambiente, pathTemplate: '/contribuintes/DFe/{nsu}' },
    resolveAdnBaseUrl(ambiente),
    options,
  ));
}

/** ADN · GET /contribuintes/NFSe/{chave}/Eventos — todos os eventos vinculados a chave. */
export async function consultarEventosPorChaveAdn(
  chaveAcesso: string,
  pfx: PfxMaterial,
  ambiente?: Ambiente,
  options?: SefinRequestOptions,
): Promise<SefinResposta> {
  return parseJson(await sefinRequestWithRetry(
    { method: 'GET', path: `/contribuintes/NFSe/${chaveAcesso}/Eventos` },
    pfx,
    { operation: 'adn_eventos_chave', ambiente, pathTemplate: '/contribuintes/NFSe/{chave}/Eventos' },
    resolveAdnBaseUrl(ambiente),
    options,
  ));
}

async function consultarParametrosMunicipais(
  path: string,
  pathTemplate: string,
  pfx: PfxMaterial,
  ambiente?: Ambiente,
  options?: SefinRequestOptions,
): Promise<SefinResposta> {
  return parseJson(await sefinRequestWithRetry(
    { method: 'GET', path },
    pfx,
    { operation: 'adn_parametros_municipais', ambiente, pathTemplate },
    resolveAdnBaseUrl(ambiente),
    options,
  ));
}

/** ADN · GET /parametrizacao/{codMun}/convenio — situacao do convenio do municipio. */
export function consultarConvenio(
  codigoMunicipio: string,
  pfx: PfxMaterial,
  ambiente?: Ambiente,
  options?: SefinRequestOptions,
): Promise<SefinResposta> {
  return consultarParametrosMunicipais(
    `/parametrizacao/${codigoMunicipio}/convenio`,
    '/parametrizacao/{codMun}/convenio',
    pfx,
    ambiente,
    options,
  );
}

/** ADN · GET /parametrizacao/{codMun}/{codServico}/{competencia}/aliquota — aliquota do servico. */
export function consultarAliquota(
  codigoMunicipio: string,
  codigoServico: string,
  competencia: string,
  pfx: PfxMaterial,
  ambiente?: Ambiente,
  options?: SefinRequestOptions,
): Promise<SefinResposta> {
  return consultarParametrosMunicipais(
    `/parametrizacao/${codigoMunicipio}/${codigoServico}/${competencia}/aliquota`,
    '/parametrizacao/{codMun}/{codServico}/{competencia}/aliquota',
    pfx,
    ambiente,
    options,
  );
}

/** ADN · GET /parametrizacao/{codMun}/{codServico}/historicoaliquotas — historico de aliquotas. */
export function consultarHistoricoAliquotas(
  codigoMunicipio: string,
  codigoServico: string,
  pfx: PfxMaterial,
  ambiente?: Ambiente,
  options?: SefinRequestOptions,
): Promise<SefinResposta> {
  return consultarParametrosMunicipais(
    `/parametrizacao/${codigoMunicipio}/${codigoServico}/historicoaliquotas`,
    '/parametrizacao/{codMun}/{codServico}/historicoaliquotas',
    pfx,
    ambiente,
    options,
  );
}

/** ADN · GET /parametrizacao/{codMun}/{codServico}/{competencia}/regimes_especiais — regimes especiais. */
export function consultarRegimesEspeciais(
  codigoMunicipio: string,
  codigoServico: string,
  competencia: string,
  pfx: PfxMaterial,
  ambiente?: Ambiente,
  options?: SefinRequestOptions,
): Promise<SefinResposta> {
  return consultarParametrosMunicipais(
    `/parametrizacao/${codigoMunicipio}/${codigoServico}/${competencia}/regimes_especiais`,
    '/parametrizacao/{codMun}/{codServico}/{competencia}/regimes_especiais',
    pfx,
    ambiente,
    options,
  );
}

/** ADN · GET /parametrizacao/{codMun}/{numeroBeneficio}/{competencia}/beneficio — beneficio municipal. */
export function consultarBeneficio(
  codigoMunicipio: string,
  numeroBeneficio: string,
  competencia: string,
  pfx: PfxMaterial,
  ambiente?: Ambiente,
  options?: SefinRequestOptions,
): Promise<SefinResposta> {
  return consultarParametrosMunicipais(
    `/parametrizacao/${codigoMunicipio}/${numeroBeneficio}/${competencia}/beneficio`,
    '/parametrizacao/{codMun}/{numeroBeneficio}/{competencia}/beneficio',
    pfx,
    ambiente,
    options,
  );
}
