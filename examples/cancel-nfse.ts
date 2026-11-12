import { writeFile } from 'node:fs/promises';
import { NfseCertificate, NfseClient, RegistrarEventoError } from '@useinvio/nfse-sdk';

async function archiveAndCancel(chaveAcesso: string) {
  const client = new NfseClient({
    environment: 'sandbox',
    certificate: NfseCertificate.fromEnv(), // NFSE_CERT_PATH + NFSE_CERT_PASSWORD
    request: { timeoutMs: 30_000, retries: 2 }, // retries apply to GETs only
  });

  // Keep the official DANFSe PDF before cancelling.
  const danfse = await client.invoices.danfse(chaveAcesso);
  if (danfse.pdf) await writeFile(`danfse-${chaveAcesso}.pdf`, danfse.pdf);

  try {
    // `autor` defaults to the certificate holder's CNPJ/CPF.
    const evento = await client.invoices.cancel({
      chaveAcesso,
      cMotivo: '1', // 1 = erro na emissao, 2 = servico nao prestado, 9 = outros
      xMotivo: 'Nota emitida com valor incorreto',
    });
    console.log('Evento registrado:', evento.pedRegEventoId);
  } catch (error) {
    if (!(error instanceof RegistrarEventoError)) throw error;
    console.error('Cancelamento rejeitado:', error.status, error.erros);
  }
}

void archiveAndCancel(process.argv[2] ?? '0'.repeat(50));
