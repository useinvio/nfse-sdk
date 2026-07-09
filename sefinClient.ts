import https from 'node:https';
import { performance } from 'node:perf_hooks';
import { resolveSefinBaseUrl } from './config.js';
import type { PfxMaterial } from './loadPfx.js';
import type { Ambiente } from './config.js';

/** Evita que uma conexao travada com o SEFIN prenda um worker indefinidamente. */
const SEFIN_REQUEST_TIMEOUT_MS = 60_000;

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

export type SefinOperation = 'transmitir_dps' | 'consultar_nfse' | 'enviar_evento';

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
   * series. P99 is calculated over this rolling window.
   */
  maxSamplesPerSeries?: number;
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
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
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
}

interface RequestMetricOpts {
  operation: SefinOperation;
  ambiente?: Ambiente;
  pathTemplate: string;
}

let sefinRequestObserver: SefinRequestObserver | undefined;

export function setSefinRequestObserver(observer: SefinRequestObserver | undefined): void {
  sefinRequestObserver = observer;
}

export function getSefinRequestObserver(): SefinRequestObserver | undefined {
  return sefinRequestObserver;
}

function notifySefinRequestObserver(metric: SefinRequestMetric): void {
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

          return {
            operation: bucket.operation,
            ambiente: bucket.ambiente,
            count: bucket.count,
            successCount: bucket.successCount,
            errorCount: bucket.errorCount,
            sampleCount: sortedDurations.length,
            minMs: sortedDurations[0] ?? 0,
            maxMs: sortedDurations.at(-1) ?? 0,
            avgMs: sortedDurations.length ? total / sortedDurations.length : 0,
            p50Ms: percentile(sortedDurations, 0.50),
            p95Ms: percentile(sortedDurations, 0.95),
            p99Ms: percentile(sortedDurations, 0.99),
          };
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
): Promise<SefinRespostaRaw> {
  const url = new URL(`${baseOverride ?? resolveSefinBaseUrl()}${opts.path}`);
  const payload = opts.jsonBody != null ? JSON.stringify(opts.jsonBody) : undefined;

  const headers: Record<string, string | number> = {
    Accept: 'application/json',
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
    timeout: SEFIN_REQUEST_TIMEOUT_MS,
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
      req.destroy(new Error(`SEFIN request timed out after ${SEFIN_REQUEST_TIMEOUT_MS}ms`));
    });
    if (payload != null) req.write(payload);
    req.end();
  });
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
): Promise<SefinResposta> {
  const base = ambiente ? resolveSefinBaseUrl(ambiente) : undefined;
  return parseJson(await sefinRequest(
    { method: 'POST', path: '/nfse', jsonBody: { dpsXmlGZipB64 } },
    pfx,
    { operation: 'transmitir_dps', ambiente, pathTemplate: '/nfse' },
    base,
  ));
}

/** SefinNacional · GET /nfse/{chave} — consulta a NFS-e pela chave de acesso (50 dígitos). */
export async function consultarNfse(chave: string, pfx: PfxMaterial, ambiente?: Ambiente): Promise<SefinResposta> {
  const base = ambiente ? resolveSefinBaseUrl(ambiente) : undefined;
  return parseJson(await sefinRequest(
    { method: 'GET', path: `/nfse/${chave}` },
    pfx,
    { operation: 'consultar_nfse', ambiente, pathTemplate: '/nfse/{chave}' },
    base,
  ));
}

/** SefinNacional · POST /nfse/{chave}/eventos — registra evento fiscal da NFS-e. */
export async function enviarEvento(
  pedRegXmlGZipB64: string,
  pfx: PfxMaterial,
  chaveAcesso: string,
  ambiente?: Ambiente,
): Promise<SefinResposta> {
  const base = ambiente ? resolveSefinBaseUrl(ambiente) : undefined;
  return parseJson(
    await sefinRequest(
      {
        method: 'POST',
        path: `/nfse/${chaveAcesso}/eventos`,
        jsonBody: { pedRegXmlGZipB64 },
      },
      pfx,
      { operation: 'enviar_evento', ambiente, pathTemplate: '/nfse/{chave}/eventos' },
      base,
    ),
  );
}
