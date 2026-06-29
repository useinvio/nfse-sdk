import assert from 'node:assert/strict';
import test from 'node:test';
import { emitirNfse, type PfxMaterial } from '../index.js';

const fakePfx = {} as PfxMaterial;

test('emitirNfse requires a DPS id when XML input does not include infDPS Id', async () => {
  await assert.rejects(
    () => emitirNfse('<DPS><infDPS /></DPS>', fakePfx),
    /Informe options\.dpsId ou um XML com Id em <infDPS>/,
  );
});
