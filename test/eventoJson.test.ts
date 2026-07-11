import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCancelamentoFromJson,
  buildCancelamentoPorSubstituicaoFromJson,
  buildPedRegEventoId,
  TP_EVENTO,
  type CancelamentoNfseInput,
} from '../index.js';

const CHAVE = '1'.repeat(50);
const CHAVE_SUBSTITUTA = '2'.repeat(50);

const cancelamento: CancelamentoNfseInput = {
  ambiente: 'restrita',
  chaveAcesso: CHAVE,
  autor: { CNPJ: '11222333000181' },
  dhEvento: '2026-04-20T14:02:19-03:00',
  cMotivo: '1',
  xMotivo: 'Nota emitida com valor incorreto',
};

test('buildPedRegEventoId concatenates PRE + chave(50) + tpEvento(6)', () => {
  const id = buildPedRegEventoId(CHAVE, TP_EVENTO.cancelamento);

  assert.equal(id, `PRE${CHAVE}101101`);
  assert.equal(id.length, 59);
  assert.match(id, /^PRE[0-9]{56}$/);
});

test('buildPedRegEventoId rejects an access key without 50 digits', () => {
  assert.throws(() => buildPedRegEventoId('123', TP_EVENTO.cancelamento), /50 digitos/);
});

test('buildCancelamentoFromJson generates the e101101 pedRegEvento layout', () => {
  const built = buildCancelamentoFromJson(cancelamento);

  assert.equal(built.tpEvento, '101101');
  assert.equal(built.ambiente, 'restrita');
  assert.equal(built.chaveAcesso, CHAVE);
  assert.match(built.xml, /^<pedRegEvento versao="1\.01" xmlns="http:\/\/www\.sped\.fazenda\.gov\.br\/nfse">/);
  assert.match(built.xml, new RegExp(`<infPedReg Id="${built.id}">`));
  assert.match(built.xml, /<tpAmb>2<\/tpAmb>/);
  assert.match(built.xml, /<CNPJAutor>11222333000181<\/CNPJAutor>/);
  assert.match(built.xml, new RegExp(`<chNFSe>${CHAVE}</chNFSe>`));
  assert.match(built.xml, /<e101101><xDesc>Cancelamento de NFS-e<\/xDesc><cMotivo>1<\/cMotivo><xMotivo>Nota emitida com valor incorreto<\/xMotivo><\/e101101>/);
});

test('buildCancelamentoFromJson uses tpAmb=1 for producao', () => {
  const built = buildCancelamentoFromJson({ ...cancelamento, ambiente: 'producao' });
  assert.match(built.xml, /<tpAmb>1<\/tpAmb>/);
});

test('buildCancelamentoFromJson defaults dhEvento to now', () => {
  const built = buildCancelamentoFromJson({ ...cancelamento, dhEvento: undefined });
  assert.match(built.xml, /<dhEvento>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}<\/dhEvento>/);
});

test('buildCancelamentoFromJson validates cMotivo and xMotivo', () => {
  assert.throws(() => buildCancelamentoFromJson({ ...cancelamento, cMotivo: '5' as any }), /cMotivo/);
  assert.throws(() => buildCancelamentoFromJson({ ...cancelamento, xMotivo: 'curto' }), /15 e 255/);
  assert.throws(() => buildCancelamentoFromJson({ ...cancelamento, xMotivo: 'x'.repeat(256) }), /15 e 255/);
});

test('buildCancelamentoFromJson requires exactly one of CNPJ or CPF as author', () => {
  assert.throws(() => buildCancelamentoFromJson({ ...cancelamento, autor: {} }), /exatamente um/);
  assert.throws(
    () => buildCancelamentoFromJson({ ...cancelamento, autor: { CNPJ: '11222333000181', CPF: '39053344705' } }),
    /exatamente um/,
  );
  const built = buildCancelamentoFromJson({ ...cancelamento, autor: { CPF: '39053344705' } });
  assert.match(built.xml, /<CPFAutor>39053344705<\/CPFAutor>/);
});

test('buildCancelamentoPorSubstituicaoFromJson generates the e105102 layout', () => {
  const built = buildCancelamentoPorSubstituicaoFromJson({
    ambiente: 'restrita',
    chaveAcesso: CHAVE,
    autor: { CNPJ: '11222333000181' },
    dhEvento: '2026-04-20T14:02:19-03:00',
    cMotivo: '05',
    xMotivo: 'Rejeicao registrada pelo tomador do servico',
    chaveSubstituta: CHAVE_SUBSTITUTA,
  });

  assert.equal(built.tpEvento, '105102');
  assert.equal(built.id, `PRE${CHAVE}105102`);
  assert.match(built.xml, /<e105102><xDesc>Cancelamento de NFS-e por Substituição<\/xDesc><cMotivo>05<\/cMotivo><xMotivo>Rejeicao registrada pelo tomador do servico<\/xMotivo><chSubstituta>2{50}<\/chSubstituta><\/e105102>/);
});

test('buildCancelamentoPorSubstituicaoFromJson allows omitting xMotivo', () => {
  const built = buildCancelamentoPorSubstituicaoFromJson({
    chaveAcesso: CHAVE,
    autor: { CPF: '39053344705' },
    cMotivo: '01',
    chaveSubstituta: CHAVE_SUBSTITUTA,
  });

  assert.doesNotMatch(built.xml, /<xMotivo>/);
  assert.match(built.xml, new RegExp(`<chSubstituta>${CHAVE_SUBSTITUTA}</chSubstituta>`));
});
