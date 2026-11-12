import assert from 'node:assert/strict';
import test from 'node:test';
import {
  baixarDanfse,
  buildDpsFromJson,
  cancelarNfse,
  consultarEvento,
  distribuirDfePorNsu,
  emitirNfse,
  EmitirNotaError,
  explicarErros,
  lerNfse,
  NfseCertificate,
  NfseClient,
  obterNfse,
  prepararNota,
  recuperarNfsePorDps,
  RegistrarEventoError,
  transmitirNotaPreparada,
} from '../index.js';
import { createTestCertificate, installMockSefin } from '../testing.js';
import { invoice } from './fixtures.js';

const { certificate, pfx, password } = createTestCertificate({ cnpj: '12345678000195' });

function nota(nDPS: string) {
  const request = invoice();
  request.emissao = { ...request.emissao, nDPS };
  return request;
}

test('createTestCertificate yields an ICP-Brasil-style holder and a loadable PFX', () => {
  assert.equal(certificate.cnpj, '12345678000195');
  assert.equal(NfseCertificate.fromPfx(pfx, password).cnpj, '12345678000195');
  assert.equal(createTestCertificate({ cpf: '39053344705' }).certificate.cpf, '39053344705');
  assert.equal(createTestCertificate({ validDays: -1 }).certificate.isValidAt(), false);
});

test('mock SEFIN runs emit, query, DANFSe, cancel and distribution end to end', async (t) => {
  const mock = installMockSefin();
  t.after(() => mock.restore());

  const emitted = await emitirNfse(nota('101'), certificate);
  assert.match(emitted.chaveAcesso, /^\d{50}$/);
  assert.equal(mock.notas.size, 1);
  assert.equal(lerNfse(emitted.nfseXml).chaveAcesso, emitted.chaveAcesso);

  const fetched = await obterNfse(emitted.chaveAcesso, certificate);
  assert.equal(fetched.resumo.emitente.CNPJ, '12345678000195');
  assert.equal(fetched.resumo.dps.id, emitted.dpsId);

  const danfse = await baixarDanfse(emitted.chaveAcesso, certificate);
  assert.ok(danfse.pdf?.subarray(0, 5).equals(Buffer.from('%PDF-')));

  const evento = await cancelarNfse({ chaveAcesso: emitted.chaveAcesso, cMotivo: '1', xMotivo: 'Teste de cancelamento no mock' }, certificate);
  assert.ok(evento.eventoXml?.includes(emitted.chaveAcesso));
  assert.ok(mock.notas.get(emitted.chaveAcesso)?.cancelada);
  assert.equal((await consultarEvento(emitted.chaveAcesso, '101101', certificate)).status, 200);

  await assert.rejects(
    cancelarNfse({ chaveAcesso: emitted.chaveAcesso, cMotivo: '1', xMotivo: 'Teste de cancelamento no mock' }, certificate),
    (e) => e instanceof RegistrarEventoError && e.erros[0].Codigo === 'E0840',
  );

  const lote = await distribuirDfePorNsu(0, certificate);
  assert.equal(lote.body.LoteDFe.length, 1);
});

test('mock SEFIN rejects duplicates with the official message, which explicarErros explains', async (t) => {
  const mock = installMockSefin();
  t.after(() => mock.restore());
  const prepared = prepararNota(nota('102'), certificate);
  await transmitirNotaPreparada(prepared, certificate);
  const error = await transmitirNotaPreparada(prepared, certificate).catch((e) => e);
  assert.ok(error instanceof EmitirNotaError);
  assert.equal(error.erros[0].Codigo, 'E0014');
  const [explained] = explicarErros(error.erros);
  assert.equal(explained.conhecida, true);
  assert.match(explained.campo ?? '', /serie$/);
});

test('a dropped response is recovered by DPS id instead of being resent', async (t) => {
  const mock = installMockSefin();
  t.after(() => mock.restore());
  const prepared = prepararNota(nota('103'), certificate);
  mock.dropResponseNext();
  await assert.rejects(transmitirNotaPreparada(prepared, certificate), /connection dropped/);
  assert.equal(mock.notas.size, 1, 'SEFIN processed the DPS before the connection dropped');

  const recovered = await recuperarNfsePorDps(prepared.dpsId, certificate);
  assert.equal(recovered?.resumo.dps.id, prepared.dpsId);

  mock.failNext();
  const lost = prepararNota(nota('104'), certificate);
  await assert.rejects(transmitirNotaPreparada(lost, certificate), /socket hang up/);
  assert.equal(await recuperarNfsePorDps(lost.dpsId, certificate), null, 'never reached SEFIN: safe to resend');
});

test('mock checks signatures, environment and scripted rejections', async (t) => {
  const mock = installMockSefin();
  t.after(() => mock.restore());

  const other = createTestCertificate({ cnpj: '12345678000195' }).certificate;
  const prepared = prepararNota(nota('105'), certificate);
  const wrongSigner = await transmitirNotaPreparada(prepared, other).catch((e) => e);
  assert.equal(wrongSigner.erros?.[0]?.Codigo, 'E0714');

  mock.rejectNext('E0312');
  const rejected = await emitirNfse(nota('106'), certificate).catch((e) => e);
  assert.equal(rejected.erros[0].Codigo, 'E0312');
  assert.match(rejected.erros[0].Descricao, /tributação nacional/);

  const { xml } = buildDpsFromJson({ ...nota('107'), ambiente: 'producao' });
  const wrongEnv = await emitirNfse(xml, certificate, { ambiente: 'producao' }).then(
    () => undefined,
    (e) => e,
  );
  assert.equal(wrongEnv, undefined, 'producao DPS sent to producao host is accepted');
  assert.equal(mock.requests.at(-1)?.host, 'sefin.nfse.gov.br');
});

test('NfseClient works against the mock with a test certificate', async (t) => {
  const mock = installMockSefin();
  t.after(() => mock.restore());
  const client = new NfseClient({ environment: 'sandbox', certificate });
  const created = await client.invoices.create(nota('108'));
  const retrieved = await client.invoices.retrieve(created.chaveAcesso);
  assert.equal(retrieved.chaveAcesso, created.chaveAcesso);
  assert.equal((await client.invoices.recover(created.dpsId))?.chaveAcesso, created.chaveAcesso);
});

test('verifyDps returns false for a wrong certificate or tampered XML instead of throwing', async () => {
  const { verifyDps } = await import('../index.js');
  const other = createTestCertificate();
  const { signedXml } = prepararNota(nota('109'), certificate);
  const { certPem } = createTestCertificate({ cnpj: '12345678000195' });
  assert.equal(verifyDps(signedXml, other.certPem), false);
  assert.equal(verifyDps(signedXml.replace('<nDPS>109</nDPS>', '<nDPS>999</nDPS>'), certPem), false);
});
