import { gzipSync, gunzipSync } from 'node:zlib';

// Limite defensivo contra descompactacao descontrolada; uma NFS-e real fica na
// casa dos KB. 50MB e generoso o bastante para nunca rejeitar uma resposta legitima.
const MAX_GUNZIP_OUTPUT_BYTES = 50 * 1024 * 1024;

/** Compacta (GZip) e codifica em Base64 — formato exigido por dpsXmlGZipB64. */
export function gzipBase64(xml: string): string {
  return gzipSync(Buffer.from(xml, 'utf-8')).toString('base64');
}

/** Inverso: decodifica Base64 e descompacta GZip (resposta nfseXmlGZipB64). */
export function gunzipBase64(b64: string): string {
  return gunzipSync(Buffer.from(b64, 'base64'), { maxOutputLength: MAX_GUNZIP_OUTPUT_BYTES }).toString('utf-8');
}

/**
 * Decodes documents returned by event queries and ADN distribution, which arrive
 * either as Base64(GZip) or as Base64(Base64(GZip)).
 */
export function gunzipBase64Flexivel(b64: string): string {
  try {
    return gunzipBase64(b64);
  } catch {
    return gunzipBase64(Buffer.from(b64, 'base64').toString('utf-8'));
  }
}
