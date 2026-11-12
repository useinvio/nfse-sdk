import {
  NfseCertificate,
  prepararNota,
  recuperarNfsePorDps,
  transmitirNotaPreparada,
  type DpsJsonRequest,
} from '@useinvio/nfse-sdk';
import { nationalInvoice } from './payloads.js';

/**
 * Safe emission: persist the signed DPS before sending, and after a timeout ask
 * SEFIN whether the DPS was processed instead of sending it again.
 */
async function emitIdempotently(nota: DpsJsonRequest) {
  const certificate = NfseCertificate.fromEnv();
  const prepared = prepararNota(nota, certificate);
  // await db.save(prepared.dpsId, prepared.signedXml);

  try {
    return await transmitirNotaPreparada(prepared, certificate, { timeoutMs: 30_000 });
  } catch (error) {
    if (error instanceof Error && error.name === 'EmitirNotaError') throw error; // SEFIN answered: a real rejection
    const existing = await recuperarNfsePorDps(prepared.dpsId, certificate, prepared.ambiente, { retries: 3 });
    if (existing) return existing; // authorized before the connection dropped
    return transmitirNotaPreparada(prepared, certificate); // never reached SEFIN: same DPS, same Id
  }
}

void emitIdempotently(nationalInvoice);
