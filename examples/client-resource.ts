import { NfseClient } from '@useinvio/nfse-sdk';
import { nationalInvoice } from './payloads.js';

const client = new NfseClient({
  environment: 'sandbox',
  certificate: {
    content: process.env.NFSE_CERTIFICATE_BASE64!,
    password: process.env.NFSE_CERTIFICATE_PASSWORD!,
  },
  defaults: { prestador: nationalInvoice.prestador, servico: nationalInvoice.servico },
});

const invoice = await client.invoices.create({ emissao: nationalInvoice.emissao });
console.log(invoice.chaveAcesso);
// If create overrides ambiente, pass that same environment when querying:
// await client.invoices.get(invoice.chaveAcesso, { ambiente: 'restrita' });
