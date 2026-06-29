import assert from 'node:assert/strict';
import test from 'node:test';
import { NfseClient, type PfxMaterial } from '../index.js';

const pfx: PfxMaterial = {
  privateKeyPem: '',
  certPem: '',
  certDerBase64: '',
  pfxBuffer: Buffer.alloc(0),
};

test('NfseClient translates the friendly invoice input to DpsJsonRequest', () => {
  const client = new NfseClient({
    environment: 'sandbox',
    certificate: pfx,
    defaults: {
      provider: {
        cityCode: '4106902',
        series: '1601',
        simpleNationalOption: '1',
        specialTaxRegime: '0',
      },
      service: {
        cityCode: '4106902',
        nbsCode: '115022000',
      },
    },
  });

  const dps = client.invoices.buildDpsJson({
    number: 1,
    provider: {
      document: '12.345.678/0001-95',
      municipalRegistration: '123456',
    },
    customer: {
      document: '000.000.000-00',
      name: 'Example Customer',
    },
    service: {
      code: '010201',
      description: 'Software development services',
      amount: 1000,
    },
    taxation: {
      municipal: {
        tribISSQN: '3',
      },
      federal: {
        piscofins: { CST: '07' },
      },
      total: {
        pTotTribMun: '5.00',
      },
    },
  });

  assert.equal(dps.ambiente, 'restrita');
  assert.equal(dps.prestador.cnpj, '12345678000195');
  assert.equal(dps.prestador.cLocEmi, '4106902');
  assert.equal(dps.prestador.serie, '1601');
  assert.equal(dps.servico.cTribNac, '010201');
  assert.equal(dps.servico.cNBS, '115022000');
  assert.equal(dps.servico.cLocPrestacao, '4106902');
  assert.equal(dps.emissao.nDPS, '1');
  assert.equal(dps.emissao.valores?.vServ, '1000');
  assert.equal(dps.emissao.tomador?.CPF, '00000000000');
  assert.equal(dps.emissao.tomador?.xNome, 'Example Customer');
  assert.equal(dps.emissao.tributacaoMunicipal?.tribISSQN, '3');
  assert.equal(dps.emissao.tributacaoFederal?.piscofins?.CST, '07');
  assert.equal(dps.emissao.totTrib?.pTotTribMun, '5.00');
});

test('NfseClient maps production environment alias', () => {
  const client = new NfseClient({
    environment: 'production',
    certificate: pfx,
    defaults: {
      provider: {
        document: '12345678000195',
        cityCode: '4106902',
        series: '1601',
        simpleNationalOption: '1',
        specialTaxRegime: '0',
      },
      service: {
        nationalTaxCode: '010201',
        cityCode: '4106902',
      },
    },
  });

  const dps = client.invoices.buildDpsJson({
    number: '2',
    service: {
      description: 'Software development services',
      amount: '1000.00',
    },
  });

  assert.equal(dps.ambiente, 'producao');
  assert.equal(dps.servico.cTribNac, '010201');
});

test('NfseClient reports missing required friendly fields', () => {
  const client = new NfseClient({
    certificate: pfx,
    defaults: {
      provider: {
        cityCode: '4106902',
        series: '1601',
        simpleNationalOption: '1',
        specialTaxRegime: '0',
      },
      service: {
        cityCode: '4106902',
      },
    },
  });

  assert.throws(
    () =>
      client.invoices.buildDpsJson({
        number: '1',
        service: {
          code: '010201',
          description: 'Software development services',
          amount: 1000,
        },
      }),
    /provider\.document/,
  );
});
