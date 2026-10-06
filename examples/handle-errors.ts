import { EmitirNotaError, emitirNfse, loadPfx, type DpsJsonRequest } from '@useinvio/nfse-sdk';
import { nationalInvoice } from './payloads.js';

async function emitWithStructuredErrors(nota: DpsJsonRequest) {
  const pfx = loadPfx('./certificado.pfx', process.env.PFX_PASSWORD!);

  try {
    return await emitirNfse(nota, pfx);
  } catch (error) {
    if (!(error instanceof EmitirNotaError)) throw error;

    return {
      failed: true, // Includes incomplete HTTP 2xx responses; reconcile before retrying.
      status: error.status,
      dpsId: error.dpsId,
      errors: error.erros.map((rejeicao) => ({
        code: rejeicao.Codigo,
        message: rejeicao.Descricao,
        detail: rejeicao.Complemento,
      })),
    };
  }
}

void emitWithStructuredErrors(nationalInvoice);
