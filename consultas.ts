import { gunzipBase64 } from './gzipB64.js';
import { lerNfse, type NfseResumo } from './nfseXml.js';
import { consultarDps, consultarNfse, extrairErros, type SefinErro, type SefinRequestOptions } from './sefinClient.js';
import type { CertificateInput } from './certificate.js';
import type { Ambiente } from './config.js';

export interface NfseConsultada {
  chaveAcesso: string;
  /** Authorized NFS-e XML, decompressed. */
  nfseXml: string;
  resumo: NfseResumo;
  status: number;
  body: any;
}

export class ConsultaNfseError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly erros: SefinErro[],
    public readonly body: any,
  ) {
    super(message);
    this.name = 'ConsultaNfseError';
  }

  /** True when SEFIN answered 404: the NFS-e (or DPS) does not exist in this environment. */
  get notFound(): boolean {
    return this.status === 404;
  }
}

/** Decodes a GET /nfse/{chave} response body into XML + typed summary. */
export function decodificarRespostaNfse(status: number, body: any): NfseConsultada {
  const b64 = body?.nfseXmlGZipB64 ?? body?.NfseXmlGZipB64;
  if (status < 200 || status >= 300) {
    throw new ConsultaNfseError(`Consulta da NFS-e falhou (HTTP ${status})`, status, extrairErros(body), body);
  }
  if (typeof b64 !== 'string' || !b64) {
    throw new ConsultaNfseError(`Resposta da consulta sem nfseXmlGZipB64 (HTTP ${status})`, status,
      [{ Codigo: 'INVALID_QUERY_RESPONSE', Descricao: 'XML da NFS-e ausente' }], body);
  }
  const nfseXml = gunzipBase64(b64);
  const resumo = lerNfse(nfseXml);
  return { chaveAcesso: resumo.chaveAcesso, nfseXml, resumo, status, body };
}

/**
 * GET /nfse/{chave} returning the decompressed XML and a typed summary.
 * Throws {@link ConsultaNfseError} on non-2xx (`error.notFound` for 404).
 */
export async function obterNfse(
  chaveAcesso: string,
  certificate: CertificateInput,
  ambiente?: Ambiente,
  options?: SefinRequestOptions,
): Promise<NfseConsultada> {
  const { status, body } = await consultarNfse(chaveAcesso, certificate, ambiente, options);
  const result = decodificarRespostaNfse(status, body);
  if (result.chaveAcesso !== chaveAcesso) {
    throw new ConsultaNfseError('Chave de acesso da resposta difere da consultada', status,
      [{ Codigo: 'INVALID_QUERY_RESPONSE', Descricao: 'Chave divergente' }], body);
  }
  return result;
}

/**
 * Recovers an emission whose POST /nfse outcome is unknown (timeout, dropped
 * connection) without resending the DPS: GET /dps/{id} for the access key, then
 * GET /nfse/{chave}. Resolves to `null` when SEFIN has no NFS-e for that DPS,
 * in which case it is safe to transmit the same signed DPS again.
 */
export async function recuperarNfsePorDps(
  dpsId: string,
  certificate: CertificateInput,
  ambiente?: Ambiente,
  options?: SefinRequestOptions,
): Promise<NfseConsultada | null> {
  const { status, body } = await consultarDps(dpsId, certificate, ambiente, options);
  if (status === 404) return null;
  const chave = body?.chaveAcesso ?? body?.ChaveAcesso;
  if (status < 200 || status >= 300 || typeof chave !== 'string' || !/^\d{50}$/.test(chave)) {
    throw new ConsultaNfseError(`Consulta da DPS falhou (HTTP ${status})`, status, extrairErros(body), body);
  }
  return obterNfse(chave, certificate, ambiente, options);
}
