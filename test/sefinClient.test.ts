import assert from 'node:assert/strict';
import test from 'node:test';
import { createSefinLatencyTracker, extrairErros, isSefinLatencyMetricsEnabled } from '../index.js';
import type { SefinRequestMetric } from '../index.js';

test('extrairErros returns an empty list for empty bodies', () => {
  assert.deepEqual(extrairErros(null), []);
  assert.deepEqual(extrairErros(undefined), []);
});

test('extrairErros preserves array responses', () => {
  const erros = [{ Codigo: 'E001', Descricao: 'Erro oficial' }];

  assert.deepEqual(extrairErros(erros), erros);
});

test('extrairErros reads lowercase and uppercase error lists', () => {
  assert.deepEqual(extrairErros({ erros: [{ Codigo: 'E001', Descricao: 'erro' }] }), [
    { Codigo: 'E001', Descricao: 'erro' },
  ]);
  assert.deepEqual(extrairErros({ Erros: [{ Codigo: 'E002', Descricao: 'erro' }] }), [
    { Codigo: 'E002', Descricao: 'erro' },
  ]);
});

test('extrairErros normalizes single error objects', () => {
  assert.deepEqual(extrairErros({ codigo: 'E003', mensagem: 'Mensagem de erro' }), [
    { Codigo: 'E003', Descricao: 'Mensagem de erro' },
  ]);
});

test('extrairErros returns no errors for successful authorization bodies', () => {
  assert.deepEqual(
    extrairErros({
      tipoAmbiente: 2,
      versaoAplicativo: 'SefinNacional_1.6.0',
      dataHoraProcessamento: '2026-06-29T13:52:13.3513292-03:00',
      idDps: 'NFS41069022239999099000909000000000000226043180360794',
      chaveAcesso: '41069022239999099000909000000000000226043180360794',
      nfseXmlGZipB64: 'H4sIA...',
      alertas: null,
    }),
    [],
  );
});

test('extrairErros keeps unknown responses inspectable', () => {
  assert.deepEqual(extrairErros('Forbidden'), [{ Codigo: 'DESCONHECIDO', Descricao: 'Forbidden' }]);
  assert.deepEqual(extrairErros({ detalhe: 'sem formato oficial' }), [
    { Codigo: 'DESCONHECIDO', Descricao: '{"detalhe":"sem formato oficial"}' },
  ]);
});

function sefinMetric(durationMs: number, overrides: Partial<SefinRequestMetric> = {}): SefinRequestMetric {
  return {
    operation: 'consultar_nfse',
    ambiente: 'restrita',
    method: 'GET',
    pathTemplate: '/nfse/{chave}',
    durationMs,
    status: 200,
    success: true,
    ...overrides,
  };
}

test('isSefinLatencyMetricsEnabled only enables metrics for explicit truthy values', () => {
  assert.equal(isSefinLatencyMetricsEnabled({}), false);
  assert.equal(isSefinLatencyMetricsEnabled({ NFSE_SEFIN_LATENCY_METRICS: '0' }), false);
  assert.equal(isSefinLatencyMetricsEnabled({ NFSE_SEFIN_LATENCY_METRICS: 'false' }), false);
  assert.equal(isSefinLatencyMetricsEnabled({ NFSE_SEFIN_LATENCY_METRICS: '1' }), true);
  assert.equal(isSefinLatencyMetricsEnabled({ NFSE_SEFIN_LATENCY_METRICS: 'true' }), true);
  assert.equal(isSefinLatencyMetricsEnabled({ NFSE_SEFIN_LATENCY_METRICS: 'ON' }), true);
});

test('createSefinLatencyTracker summarizes latency without percentiles by default', () => {
  const tracker = createSefinLatencyTracker();

  for (let durationMs = 1; durationMs <= 100; durationMs += 1) {
    tracker.observe(sefinMetric(durationMs));
  }
  tracker.observe(sefinMetric(250, { success: false, status: 503 }));

  const snapshot = tracker.snapshot();

  assert.equal(snapshot.series.length, 1);
  assert.deepEqual(snapshot.series[0], {
    operation: 'consultar_nfse',
    ambiente: 'restrita',
    count: 101,
    successCount: 100,
    errorCount: 1,
    sampleCount: 101,
    minMs: 1,
    maxMs: 250,
    avgMs: 5300 / 101,
  });
});

test('createSefinLatencyTracker includes percentile metrics when explicitly enabled', () => {
  const tracker = createSefinLatencyTracker({ includePercentiles: true });

  for (let durationMs = 1; durationMs <= 100; durationMs += 1) {
    tracker.observe(sefinMetric(durationMs));
  }
  tracker.observe(sefinMetric(250, { success: false, status: 503 }));

  assert.deepEqual(tracker.snapshot().series[0], {
    operation: 'consultar_nfse',
    ambiente: 'restrita',
    count: 101,
    successCount: 100,
    errorCount: 1,
    sampleCount: 101,
    minMs: 1,
    maxMs: 250,
    avgMs: 5300 / 101,
    p50Ms: 51,
    p95Ms: 96,
    p99Ms: 100,
  });
});

test('createSefinLatencyTracker keeps a rolling sample window per series', () => {
  const tracker = createSefinLatencyTracker({ maxSamplesPerSeries: 3 });

  tracker.observe(sefinMetric(10));
  tracker.observe(sefinMetric(20));
  tracker.observe(sefinMetric(30));
  tracker.observe(sefinMetric(40));

  assert.deepEqual(tracker.snapshot().series[0], {
    operation: 'consultar_nfse',
    ambiente: 'restrita',
    count: 4,
    successCount: 4,
    errorCount: 0,
    sampleCount: 3,
    minMs: 20,
    maxMs: 40,
    avgMs: 30,
  });

  tracker.reset();
  assert.deepEqual(tracker.snapshot().series, []);
});
