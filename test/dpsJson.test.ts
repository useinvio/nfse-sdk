import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDpsFromJson, buildDpsId, TP_AMB, type DpsJsonRequest } from '../index.js';

const request: DpsJsonRequest = {
  ambiente: 'restrita',
  prestador: {
    cnpj: '38153016000107',
    tpInsc: '2',
    cLocEmi: '4106902',
    serie: '1608',
    opSimpNac: '1',
    regEspTrib: '0',
  },
  servico: {
    cTribNac: '010201',
    cNBS: '115022000',
    xDescServ: 'Desenvolvimento & manutencao <software>',
    cLocPrestacao: '4106902',
  },
  emissao: {
    nDPS: '4',
    dhEmi: '2026-04-20T14:02:19-03:00',
    dCompet: '2026-03-27',
    valores: {
      vServMoeda: '9000.00',
      cotacao: 5.210621,
    },
    comercioExterior: {
      mdPrestacao: '4',
      vincPrest: '0',
      tpMoeda: '220',
      vServMoeda: '9000.00',
      mecAFComexP: '01',
      mecAFComexT: '01',
      movTempBens: '1',
      mdic: '0',
    },
    tributacaoMunicipal: {
      tribISSQN: '3',
      cPaisResult: 'US',
      tpRetISSQN: '1',
    },
    tributacaoFederal: {
      piscofins: {
        CST: '00',
      },
    },
    totTrib: {
      pTotTribFed: '11.33',
      pTotTribEst: '0',
      pTotTribMun: '5',
    },
  },
};

test('buildDpsId follows the NFS-e Nacional concatenation rule', () => {
  assert.equal(
    buildDpsId(request.prestador, '4', '70000'),
    'DPS410690223815301600010770000000000000000004',
  );
});

test('buildDpsFromJson builds a DPS XML from an object payload', () => {
  const { id, xml } = buildDpsFromJson(request);

  assert.equal(id, 'DPS410690223815301600010701608000000000000004');
  assert.match(xml, /^<DPS versao="1.01" xmlns="http:\/\/www\.sped\.fazenda\.gov\.br\/nfse">/);
  assert.match(xml, /<tpAmb>2<\/tpAmb>/);
  assert.match(xml, /<serie>1608<\/serie>/);
  assert.match(xml, /<nDPS>4<\/nDPS>/);
  assert.match(xml, /<vServ>46895.59<\/vServ>/);
  assert.match(xml, /<xDescServ>Desenvolvimento &amp; manutencao &lt;software&gt;<\/xDescServ>/);
  assert.match(xml, /<pTotTribFed>11.33<\/pTotTribFed>/);
  assert.match(xml, /<pTotTribEst>0.00<\/pTotTribEst>/);
  assert.match(xml, /<pTotTribMun>5.00<\/pTotTribMun>/);
});

test('buildDpsFromJson accepts a JSON string payload', () => {
  const built = buildDpsFromJson(JSON.stringify(request));

  assert.equal(built.id, 'DPS410690223815301600010701608000000000000004');
  assert.match(built.xml, /<verAplic>@nfse-tools\/nfse-sdk<\/verAplic>/);
});

test('TP_AMB exposes the environment mapping used by JSON DPS builder', () => {
  assert.deepEqual(TP_AMB, { producao: '1', restrita: '2' });
});
