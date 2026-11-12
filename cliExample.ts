import type { DpsJsonRequest } from './dpsJson.js';

/**
 * Illustrative payload for `nfse init` and `nfse doctor`. The values are
 * fictitious; real invoices need the issuer's own codes and tax choices.
 */
export function examplePayload(): DpsJsonRequest {
  return {
    ambiente: 'restrita',
    prestador: {
      cnpj: '12345678000195',
      cLocEmi: '4106902',
      serie: '1601',
      opSimpNac: '1',
      regEspTrib: '0',
    },
    servico: {
      cTribNac: '010201',
      xDescServ: 'Desenvolvimento de software',
      cLocPrestacao: '4106902',
    },
    emissao: {
      nDPS: '1',
      valores: { vServ: '10.00' },
      tributacaoMunicipal: { tribISSQN: '1', tpRetISSQN: '1' },
      tributacaoFederal: { piscofins: { CST: '07' } },
      totTrib: { pTotTribFed: '0.00', pTotTribEst: '0.00', pTotTribMun: '5.00' },
    },
  };
}
