import { NfseCertificate, NfseClient } from '@useinvio/nfse-sdk';
import { nationalInvoice } from './payloads.js';

const client = new NfseClient({
  environment: 'sandbox',
  // NFSE_CERT_PATH or NFSE_CERT_BASE64, plus NFSE_CERT_PASSWORD or NFSE_CERT_PASSWORD_FILE
  certificate: NfseCertificate.fromEnv(),
  defaults: { prestador: nationalInvoice.prestador, servico: nationalInvoice.servico },
});

const invoice = await client.invoices.create({ emissao: nationalInvoice.emissao });
console.log(invoice.chaveAcesso);
// If create overrides ambiente, pass that same environment when querying:
// await client.invoices.get(invoice.chaveAcesso, { ambiente: 'restrita' });
