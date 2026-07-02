import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDpsFromJson, buildDpsId, DpsFiscalValidationError, TP_AMB, type DpsJsonRequest } from '../index.js';

const request: DpsJsonRequest = {
  ambiente: 'restrita',
  prestador: {
    cnpj: '39999099000909',
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
    'DPS410690223999909900090970000000000000000004',
  );
});

test('buildDpsFromJson builds a DPS XML from an object payload', () => {
  const { id, xml } = buildDpsFromJson(request);

  assert.equal(id, 'DPS410690223999909900090901608000000000000004');
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

  assert.equal(built.id, 'DPS410690223999909900090901608000000000000004');
  assert.match(built.xml, /<verAplic>UseInvio<\/verAplic>/);
});

test('TP_AMB exposes the environment mapping used by JSON DPS builder', () => {
  assert.deepEqual(TP_AMB, { producao: '1', restrita: '2' });
});

test('buildDpsFromJson rejects missing fiscal blocks instead of assuming defaults', () => {
  const invalid: DpsJsonRequest = {
    ...request,
    emissao: {
      ...request.emissao,
      tributacaoMunicipal: undefined,
      totTrib: undefined,
    },
  };

  assert.throws(
    () => buildDpsFromJson(invalid),
    (error) =>
      error instanceof DpsFiscalValidationError &&
      error.issues.includes('emissao.tributacaoMunicipal e obrigatorio; a SDK nao assume tribISSQN/tpRetISSQN por default') &&
      error.issues.includes('emissao.totTrib e obrigatorio; informe vTotTrib(Fed/Est/Mun), pTotTrib(Fed/Est/Mun), pTotTribSN ou indTotTrib=0'),
  );
});

test('buildDpsFromJson accepts indTotTrib=0 for non-Simples providers', () => {
  const valid: DpsJsonRequest = {
    ...request,
    prestador: {
      ...request.prestador,
      opSimpNac: '1',
    },
    emissao: {
      ...request.emissao,
      totTrib: {
        indTotTrib: '0',
      },
    },
  };

  const { xml } = buildDpsFromJson(valid);

  assert.match(xml, /<indTotTrib>0<\/indTotTrib>/);
});

test('buildDpsFromJson rejects pTotTribSN for non-Simples providers', () => {
  const invalid: DpsJsonRequest = {
    ...request,
    prestador: {
      ...request.prestador,
      opSimpNac: '1',
    },
    emissao: {
      ...request.emissao,
      totTrib: {
        pTotTribSN: '5',
      },
    },
  };

  assert.throws(
    () => buildDpsFromJson(invalid),
    (error) =>
      error instanceof DpsFiscalValidationError &&
      error.issues.includes('emissao.totTrib.pTotTribSN nao deve ser informado para prestador.opSimpNac = 1'),
  );
});

test('buildDpsFromJson rejects invalid national domain values', () => {
  const invalid: DpsJsonRequest = {
    ...request,
    prestador: {
      ...request.prestador,
      opSimpNac: '9',
    },
    servico: {
      ...request.servico,
      cTribNac: '10201',
      cNBS: 'ABC',
    },
    emissao: {
      ...request.emissao,
      nDPS: '0',
      tributacaoMunicipal: {
        tribISSQN: '3',
        cPaisResult: 'USA',
        tpRetISSQN: '4',
      },
    },
  };

  assert.throws(
    () => buildDpsFromJson(invalid),
    (error) =>
      error instanceof DpsFiscalValidationError &&
      error.issues.includes('prestador.opSimpNac deve ser um de: 1, 2, 3') &&
      error.issues.includes('servico.cTribNac deve seguir 6 digitos numericos') &&
      error.issues.includes('servico.cNBS deve seguir 9 digitos numericos') &&
      error.issues.includes('emissao.nDPS deve seguir 1 a 15 digitos, sem zero inicial') &&
      error.issues.includes('emissao.tributacaoMunicipal.tpRetISSQN deve ser um de: 1, 2, 3') &&
      error.issues.includes('emissao.tributacaoMunicipal.cPaisResult deve seguir ISO-3166 alpha-2'),
  );
});

test('buildDpsFromJson rejects fiscal combinations that would generate unsafe XML', () => {
  const invalid: DpsJsonRequest = {
    ...request,
    emissao: {
      ...request.emissao,
      valores: {
        vServ: '1000.00',
        vDesc: '10.00',
      },
      tributacaoMunicipal: {
        tribISSQN: '2',
        cPaisResult: 'US',
        tpRetISSQN: '1',
        pAliq: '5',
      },
      tribNac: {
        CBS: { CST: '000' },
      },
    },
  };

  assert.throws(
    () => buildDpsFromJson(invalid),
    (error) =>
      error instanceof DpsFiscalValidationError &&
      error.issues.includes('emissao.tributacaoMunicipal.tpImunidade e obrigatorio') &&
      error.issues.includes('emissao.tributacaoMunicipal.cPaisResult so deve ser informado quando tribISSQN = 3') &&
      error.issues.includes('emissao.tributacaoMunicipal.pAliq nao deve ser informado quando prestador.opSimpNac = 1') &&
      error.issues.includes('emissao.tribNac ainda nao e suportado; IBS/CBS no layout v1.01 exige o bloco RTC IBSCBS oficial') &&
      error.issues.includes('emissao.valores.vDesc/vDedRed ainda nao sao suportados no shape correto do layout v1.01'),
  );
});
