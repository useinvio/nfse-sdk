import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertCertificateValidity, assertCertificateForProvider, CertificateValidationError,
  buildDpsFromJson, prepararNota, transmitirNotaPreparada, emitirNfse, EmitirNotaError,
  gzipBase64, gunzipBase64, NfseClient, verifyDps,
} from '../index.js';
import { invoice, certificate } from './fixtures.js';
import { mockHttps } from './httpsMock.js';

const ns = 'http://www.sped.fazenda.gov.br/nfse';
const key = '1'.repeat(50);
const nfseXml = `<NFSe xmlns="${ns}"><infNFSe Id="NFS${key}"/></NFSe>`;
const success = { chaveAcesso: key, nfseXmlGZipB64: gzipBase64(nfseXml) };
const pfx = certificate();

test('certificate validity boundaries and explicit holder validation', () => {
  const start = new Date('2026-01-01T00:00:00Z');
  const end = new Date('2027-01-01T00:00:00Z');
  const material = certificate(start, end);
  for (const [now, code] of [[new Date(start.getTime() - 1), 'CERTIFICATE_NOT_YET_VALID'], [end, 'CERTIFICATE_EXPIRED']] as const) {
    assert.throws(() => assertCertificateValidity(material, now), e => e instanceof CertificateValidationError && e.code === code);
  }
  assert.doesNotThrow(() => assertCertificateValidity(material, start));
  assert.doesNotThrow(() => assertCertificateValidity(material, new Date(end.getTime() - 1)));
  assert.doesNotThrow(() => assertCertificateForProvider(material, '12345678000195', start));
  assert.throws(() => assertCertificateForProvider(material, '99999999000199', start), e => e instanceof CertificateValidationError && e.code === 'CERTIFICATE_HOLDER_MISMATCH');
});

test('preparation rejects expired and future certificates but does not enforce holder equality', () => {
  assert.throws(() => prepararNota(invoice(), certificate(new Date('2000-01-01'), new Date('2001-01-01'))), CertificateValidationError);
  assert.throws(() => prepararNota(invoice(), certificate(new Date('2090-01-01'), new Date('2091-01-01'))), CertificateValidationError);
  const request = invoice(); request.prestador.cnpj = '99999999000199';
  assert.doesNotThrow(() => prepararNota(request, pfx));
});

test('certificate expiration between preparation and transmission prevents network I/O', async t => {
  const now = Date.now();
  t.mock.timers.enable({ apis: ['Date'], now });
  const material = certificate(new Date(now - 1000), new Date(now + 60_000));
  const prepared = prepararNota(invoice(), material);
  const calls = mockHttps(t, success);
  t.mock.timers.tick(120_000);
  await assert.rejects(() => transmitirNotaPreparada(prepared, material), e => e instanceof CertificateValidationError && e.code === 'CERTIFICATE_EXPIRED');
  assert.equal(calls.length, 0);
});

test('JSON object and string options override XML and transport consistently', async t => {
  const request = invoice();
  const before = structuredClone(request);
  const calls = mockHttps(t, success);
  for (const input of [request, JSON.stringify(request)]) {
    const result = await emitirNfse(input, pfx, { ambiente: 'producao' });
    assert.equal(result.chaveAcesso, key);
  }
  assert.deepEqual(request, before);
  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.equal(call.options.hostname, 'sefin.nfse.gov.br');
    const signedXml = gunzipBase64(JSON.parse(call.payload).dpsXmlGZipB64);
    assert.match(signedXml, /<tpAmb>1<\/tpAmb>/);
    assert.equal(verifyDps(signedXml, pfx.certPem), true);
  }
});

test('external XML derives environment and rejects explicit mismatch', () => {
  const request = invoice(); request.ambiente = 'producao';
  const { xml } = buildDpsFromJson(request);
  assert.equal(prepararNota(xml, pfx).ambiente, 'producao');
  assert.throws(() => prepararNota(xml, pfx, { ambiente: 'restrita' }), /Ambiente/);
  for (const invalid of [xml.replace('<tpAmb>1</tpAmb>', ''), xml.replace('<tpAmb>1</tpAmb>', '<tpAmb>9</tpAmb>'), xml.replace('<tpAmb>1</tpAmb>', '<tpAmb>1</tpAmb><tpAmb>2</tpAmb>')]) {
    assert.throws(() => prepararNota(invalid, pfx), /tpAmb/);
  }
});

test('prepared XML environment mismatch and local fiscal errors prevent transmission', async t => {
  const calls = mockHttps(t, success);
  const prepared = prepararNota(invoice(), pfx);
  prepared.ambiente = 'producao';
  await assert.rejects(() => transmitirNotaPreparada(prepared, pfx), /Ambiente/);
  const invalid = invoice(); invalid.emissao.valores!.vServ = '0.001';
  await assert.rejects(() => emitirNfse(invalid, pfx));
  assert.equal(calls.length, 0);
});

test('client queries honor options, defaults and constructor without remembering the last emission', async t => {
  const calls = mockHttps(t, success);
  const client = new NfseClient({ environment: 'production', certificate: pfx, defaults: invoice() });
  await client.invoices.get(key);
  await client.invoices.get(key, { ambiente: 'producao' });
  await client.invoices.create({ ambiente: 'producao' });
  await client.invoices.get(key);
  const other = new NfseClient({ environment: 'production', certificate: pfx });
  await other.invoices.get(key);
  assert.deepEqual(calls.map(c => c.options.hostname), [
    'sefin.producaorestrita.nfse.gov.br', 'sefin.nfse.gov.br', 'sefin.nfse.gov.br', 'sefin.producaorestrita.nfse.gov.br', 'sefin.nfse.gov.br',
  ]);
});

for (const [name, body] of Object.entries({
  lowercase: success,
  uppercase: { ChaveAcesso: key, NfseXmlGZipB64: success.nfseXmlGZipB64 },
  xmlOnly: { nfseXmlGZipB64: success.nfseXmlGZipB64 },
  bodyOnly: { chaveAcesso: key, nfseXmlGZipB64: gzipBase64(`<NFSe xmlns="${ns}"><infNFSe/></NFSe>`) },
  prefixed: { nfseXmlGZipB64: gzipBase64(`<n:NFSe xmlns:n='${ns}'><n:infNFSe Id='NFS${key}'/></n:NFSe>`) },
})) test(`authorization accepts ${name}`, async t => {
  const calls = mockHttps(t, body);
  const result = await emitirNfse(invoice(), pfx);
  assert.equal(result.chaveAcesso, key);
  assert.equal(result.status, 200);
  assert.equal(calls.length, 1);
});

for (const [name, body] of Object.entries({
  missingXml: { chaveAcesso: key },
  invalidGzip: { nfseXmlGZipB64: 'invalid' },
  wrongRoot: { chaveAcesso: key, nfseXmlGZipB64: gzipBase64('<error/>') },
  malformed: { chaveAcesso: key, nfseXmlGZipB64: gzipBase64(`<NFSe xmlns="${ns}"><infNFSe></NFSe>`) },
  noKey: { nfseXmlGZipB64: gzipBase64(`<NFSe xmlns="${ns}"/>`) },
  invalidBodyKey: { ...success, chaveAcesso: '123' },
  emptyBodyKey: { ...success, chaveAcesso: '' },
  invalidXmlId: { chaveAcesso: key, nfseXmlGZipB64: gzipBase64(`<NFSe xmlns="${ns}"><infNFSe Id="NFS123"/></NFSe>`) },
  conflictingKey: { ...success, chaveAcesso: '2'.repeat(50) },
  conflictingAliases: { ...success, ChaveAcesso: '2'.repeat(50) },
  multipleRoots: { chaveAcesso: key, nfseXmlGZipB64: gzipBase64(nfseXml + nfseXml) },
  unescapedAmpersand: { chaveAcesso: key, nfseXmlGZipB64: gzipBase64(`<NFSe xmlns="${ns}"><x>a & b</x></NFSe>`) },
  illegalXmlCharacter: { chaveAcesso: key, nfseXmlGZipB64: gzipBase64(`<NFSe xmlns="${ns}"><x>\u0000</x></NFSe>`) },
  invalidAttribute: { chaveAcesso: key, nfseXmlGZipB64: gzipBase64(`<NFSe xmlns="${ns}"><x attr="a < b"/></NFSe>`) },
  invalidComment: { chaveAcesso: key, nfseXmlGZipB64: gzipBase64(`<NFSe xmlns="${ns}"><!-- bad -- comment --></NFSe>`) },
})) test(`authorization rejects ${name} with diagnostic context and no retry`, async t => {
  const calls = mockHttps(t, body);
  const prepared = prepararNota(invoice(), pfx);
  await assert.rejects(() => transmitirNotaPreparada(prepared, pfx), e => {
    assert.ok(e instanceof EmitirNotaError);
    assert.equal(e.status, 200);
    assert.equal(e.dpsId, prepared.dpsId);
    assert.deepEqual(e.body, body);
    assert.ok(e.erros.some(i => i.Codigo === 'INVALID_AUTHORIZATION_RESPONSE'));
    return true;
  });
  assert.equal(calls.length, 1);
});

test('SEFIN rejection preserves official code, description and complement', async t => {
  const body = { erros: [{ Codigo: 'E123', Descricao: 'Rejeicao de teste', Complemento: 'Detalhe' }] };
  mockHttps(t, body, 400);
  await assert.rejects(() => emitirNfse(invoice(), pfx), e => {
    assert.ok(e instanceof EmitirNotaError);
    assert.equal(e.status, 400); assert.deepEqual(e.erros, body.erros); assert.deepEqual(e.body, body);
    return true;
  });
});

test('network error is propagated without retry', async t => {
  const error = new Error('ECONNRESET');
  const calls = mockHttps(t, {}, 200, error);
  await assert.rejects(() => emitirNfse(invoice(), pfx), e => e === error);
  assert.equal(calls.length, 1);
});
