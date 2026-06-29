import assert from 'node:assert/strict';
import test from 'node:test';
import { gzipBase64, gunzipBase64 } from '../index.js';

test('gzipBase64 encodes XML as base64 gzip and gunzipBase64 decodes it', () => {
  const xml = '<DPS><infDPS Id="DPS1"><valor>123.45</valor></infDPS></DPS>';

  const encoded = gzipBase64(xml);

  assert.notEqual(encoded, xml);
  assert.match(encoded, /^[A-Za-z0-9+/]+={0,2}$/);
  assert.equal(gunzipBase64(encoded), xml);
});
