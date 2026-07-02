import { buildDpsFromJson, type DpsJsonRequest } from '@useinvio/nfse-sdk';

const nota: DpsJsonRequest = {
  ambiente: 'restrita',
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
    xDescServ: 'Desenvolvimento de software',
    cLocPrestacao: '4106902',
    cNBS: '115022000',
  },
  emissao: {
    nDPS: '1',
    dhEmi: '2026-06-15T10:30:00-03:00',
    dCompet: '2026-06-01',
    valores: { vServ: '1500.00' },
    tributacaoMunicipal: {
      tribISSQN: '3',
      cPaisResult: 'BR',
      tpRetISSQN: '1',
    },
    tributacaoFederal: {
      piscofins: { CST: '07' },
    },
    totTrib: {
      pTotTribFed: '0.00',
      pTotTribEst: '0.00',
      pTotTribMun: '5.00',
    },
  },
};

const { id, xml } = buildDpsFromJson(nota);

console.log(id);
console.log(xml);
