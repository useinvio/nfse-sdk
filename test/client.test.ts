import assert from 'node:assert/strict';
import test from 'node:test';
import { NfseClient, type PfxMaterial } from '../index.js';

const pfx: PfxMaterial = {
  privateKeyPem: '',
  certPem: '',
  certDerBase64: '',
  pfxBuffer: Buffer.alloc(0),
};

test('NfseClient builds DpsJsonRequest using the same JSON fields', () => {
  const client = new NfseClient({
    environment: 'sandbox',
    certificate: pfx,
    defaults: {
      prestador: {
        cnpj: '12345678000195',
        tpInsc: '2',
        cLocEmi: '4106902',
        serie: '1601',
        opSimpNac: '1',
        regEspTrib: '0',
      },
      servico: {
        cTribNac: '010201',
        cNBS: '115022000',
        xDescServ: 'Servico padrao',
        cLocPrestacao: '4106902',
      },
    },
  });

  const dps = client.invoices.buildDpsJson({
    emissao: {
      nDPS: '1',
      valores: { vServ: '1000.00' },
      tomador: {
        CPF: '00000000000',
        xNome: 'Cliente Exemplo',
      },
      tributacaoMunicipal: {
        tribISSQN: '3',
      },
      tributacaoFederal: {
        piscofins: { CST: '07' },
      },
      totTrib: {
        pTotTribMun: '5.00',
      },
    },
  });

  assert.equal(dps.ambiente, 'restrita');
  assert.equal(dps.prestador.cnpj, '12345678000195');
  assert.equal(dps.servico.cTribNac, '010201');
  assert.equal(dps.emissao.nDPS, '1');
  assert.equal(dps.emissao.valores?.vServ, '1000.00');
  assert.equal(dps.emissao.tomador?.CPF, '00000000000');
  assert.equal(dps.emissao.tributacaoMunicipal?.tribISSQN, '3');
  assert.equal(dps.emissao.tributacaoFederal?.piscofins?.CST, '07');
  assert.equal(dps.emissao.totTrib?.pTotTribMun, '5.00');
});

test('NfseClient invoice input overrides JSON defaults with the same fields', () => {
  const client = new NfseClient({
    environment: 'production',
    certificate: pfx,
    defaults: {
      prestador: {
        cnpj: '12345678000195',
        tpInsc: '2',
        cLocEmi: '4106902',
        serie: '1601',
        opSimpNac: '1',
        regEspTrib: '0',
      },
      servico: {
        cTribNac: '010201',
        xDescServ: 'Servico padrao',
        cLocPrestacao: '4106902',
      },
      emissao: {
        nDPS: '1',
        valores: { vServ: '1000.00' },
      },
    },
  });

  const dps = client.invoices.buildDpsJson({
    ambiente: 'restrita',
    prestador: {
      serie: '1701',
    },
    servico: {
      cTribNac: '010202',
      xDescServ: 'Servico especifico',
    },
    emissao: {
      nDPS: '2',
      valores: { vServ: '2500.00' },
    },
  });

  assert.equal(dps.ambiente, 'restrita');
  assert.equal(dps.prestador.cnpj, '12345678000195');
  assert.equal(dps.prestador.serie, '1701');
  assert.equal(dps.servico.cTribNac, '010202');
  assert.equal(dps.servico.xDescServ, 'Servico especifico');
  assert.equal(dps.servico.cLocPrestacao, '4106902');
  assert.equal(dps.emissao.nDPS, '2');
  assert.equal(dps.emissao.valores?.vServ, '2500.00');
});

test('NfseClient maps production environment alias when invoice does not override ambiente', () => {
  const client = new NfseClient({
    environment: 'production',
    certificate: pfx,
    defaults: {
      prestador: {
        cnpj: '12345678000195',
        tpInsc: '2',
        cLocEmi: '4106902',
        serie: '1601',
        opSimpNac: '1',
        regEspTrib: '0',
      },
      servico: {
        cTribNac: '010201',
        xDescServ: 'Servico padrao',
        cLocPrestacao: '4106902',
      },
      emissao: {
        nDPS: '1',
        valores: { vServ: '1000.00' },
      },
    },
  });

  const dps = client.invoices.buildDpsJson({});

  assert.equal(dps.ambiente, 'producao');
});

test('NfseClient reports missing JSON blocks when defaults do not provide them', () => {
  const client = new NfseClient({
    certificate: pfx,
  });

  assert.throws(() => client.invoices.buildDpsJson({}), /prestador/);
});

test('NfseClient exposes event, distribution, and municipal parameter resources', () => {
  const client = new NfseClient({ certificate: pfx });

  assert.equal(typeof client.invoices.getByDpsId, 'function');
  assert.equal(typeof client.invoices.cancel, 'function');
  assert.equal(typeof client.invoices.cancelBySubstitution, 'function');
  assert.equal(typeof client.invoices.danfsePdf, 'function');
  assert.equal(typeof client.events.get, 'function');
  assert.equal(typeof client.events.listByChave, 'function');
  assert.equal(typeof client.distribution.byNsu, 'function');
  assert.equal(typeof client.municipalParameters.aliquota, 'function');
  assert.equal(typeof client.municipalParameters.convenio, 'function');
  assert.equal(typeof client.municipalParameters.historicoAliquotas, 'function');
  assert.equal(typeof client.municipalParameters.regimesEspeciais, 'function');
  assert.equal(typeof client.municipalParameters.beneficio, 'function');
});

test('NfseClient cancel validates the event input before touching the network', async () => {
  const client = new NfseClient({ certificate: pfx });

  await assert.rejects(
    client.invoices.cancel({
      chaveAcesso: '123',
      autor: { CNPJ: '11222333000181' },
      cMotivo: '1',
      xMotivo: 'Nota emitida com valor incorreto',
    }),
    /50 digitos/,
  );
});
