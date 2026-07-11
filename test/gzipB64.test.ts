import assert from 'node:assert/strict';
import test from 'node:test';
import { gzipBase64, gunzipBase64, gunzipBase64Flexivel } from '../index.js';

test('gzipBase64 encodes XML as base64 gzip and gunzipBase64 decodes it', () => {
  const xml = '<DPS><infDPS Id="DPS1"><valor>123.45</valor></infDPS></DPS>';

  const encoded = gzipBase64(xml);

  assert.notEqual(encoded, xml);
  assert.match(encoded, /^[A-Za-z0-9+/]+={0,2}$/);
  assert.equal(gunzipBase64(encoded), xml);
});

test('gunzipBase64Flexivel decodes single and double base64 gzip payloads', () => {
  const xml = '<evento><infEvento Id="EVT1"/></evento>';
  const single = gzipBase64(xml);
  const double = Buffer.from(single, 'utf-8').toString('base64');

  assert.equal(gunzipBase64Flexivel(single), xml);
  assert.equal(gunzipBase64Flexivel(double), xml);
});
