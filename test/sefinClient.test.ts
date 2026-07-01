import assert from 'node:assert/strict';
import test from 'node:test';
import { extrairErros } from '../index.js';

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
