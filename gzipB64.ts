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
 * Decodifica documentos retornados pela consulta de eventos e pela distribuicao
 * do ADN, que ora chegam em Base64 simples (GZip direto), ora em Base64 duplo
 * (Base64 de um Base64 de GZip).
 */
export function gunzipBase64Flexivel(b64: string): string {
  try {
    return gunzipBase64(b64);
  } catch {
    return gunzipBase64(Buffer.from(b64, 'base64').toString('utf-8'));
  }
}
