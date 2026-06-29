import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_AMBIENTE, SEFIN_BASE_URL, resolveSefinBaseUrl } from '../index.js';

test('resolveSefinBaseUrl returns the restricted environment by default', () => {
  assert.equal(DEFAULT_AMBIENTE, 'restrita');
  assert.equal(resolveSefinBaseUrl(), SEFIN_BASE_URL.restrita);
});

test('resolveSefinBaseUrl returns production base URL', () => {
  assert.equal(resolveSefinBaseUrl('producao'), 'https://sefin.nfse.gov.br/SefinNacional');
});
