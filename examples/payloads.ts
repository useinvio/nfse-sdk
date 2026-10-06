import type { DpsJsonRequest } from '@useinvio/nfse-sdk';

/** Illustrative declarations; the integrator chooses the actual tax treatment. */
export const nationalInvoice: DpsJsonRequest = {
  ambiente: 'restrita',
  prestador: { cnpj: '12345678000195', cLocEmi: '4106902', serie: '1601', opSimpNac: '1', regEspTrib: '0' },
  servico: { cTribNac: '010201', xDescServ: 'Desenvolvimento de software', cLocPrestacao: '4106902', cNBS: '115022000' },
  emissao: {
    nDPS: '1', dhEmi: '2026-06-15T10:30:00-03:00', dCompet: '2026-06-01',
    valores: { vServ: '1500.00' },
    tomador: {
      CPF: '12345678901', xNome: 'Cliente Exemplo',
      end: { endNac: { cMun: '4106902', CEP: '80010000' }, xLgr: 'Rua Exemplo', nro: '100', xBairro: 'Centro' },
    },
    tributacaoMunicipal: { tribISSQN: '1', tpRetISSQN: '1' },
    tributacaoFederal: { piscofins: { CST: '07' } },
    totTrib: { pTotTribFed: '0.00', pTotTribEst: '0.00', pTotTribMun: '5.00' },
  },
};

export const exportInvoice: DpsJsonRequest = {
  ...nationalInvoice,
  emissao: {
    ...nationalInvoice.emissao,
    valores: { vServMoeda: '9000.00', cotacao: 5.210621 },
    tomador: {
      NIF: 'FOREIGN123', xNome: 'Cliente Exterior',
      end: {
        endExt: { cPais: 'US', cEndPost: '10001', xCidade: 'New York', xEstProvReg: 'NY' },
        xLgr: 'Example Street', nro: '100', xBairro: 'Manhattan',
      },
    },
    comercioExterior: { mdPrestacao: '1', vincPrest: '0', tpMoeda: '220', mecAFComexP: '01', mecAFComexT: '01', movTempBens: '1', mdic: '0' },
    tributacaoMunicipal: { tribISSQN: '3', cPaisResult: 'US', tpRetISSQN: '1' },
  },
};
