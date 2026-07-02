import { NfseClient } from '@useinvio/nfse-sdk';

const client = new NfseClient({
  environment: 'sandbox',
  certificate: {
    content: process.env.NFSE_CERTIFICATE_BASE64!,
    password: process.env.NFSE_CERTIFICATE_PASSWORD!,
  },
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
      xDescServ: 'Desenvolvimento de software',
      cLocPrestacao: '4106902',
      cNBS: '115022000',
    },
  },
});

const invoice = await client.invoices.create({
  emissao: {
    nDPS: '2',
    valores: { vServ: '1000.00' },
    tomador: {
      CPF: '00000000000',
      xNome: 'Cliente Exemplo',
    },
    tributacaoMunicipal: {
      tribISSQN: '3',
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
});

console.log(invoice.chaveAcesso);
