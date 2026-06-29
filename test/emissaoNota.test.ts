import assert from 'node:assert/strict';
import test from 'node:test';
import { emitirNota, type PfxMaterial } from '../index.js';

const fakePfx = {} as PfxMaterial;

test('emitirNota requires a DPS id when XML input does not include infDPS Id', async () => {
  await assert.rejects(
    () => emitirNota('<DPS><infDPS /></DPS>', fakePfx),
    /Informe options\.dpsId ou um XML com Id em <infDPS>/,
  );
});
