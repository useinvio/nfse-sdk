/**
 * NFS-e Nacional SDK.
 *
 * Handles the protocol layer only: mTLS, signing, gzip/base64, send, consult, events.
 * No database, no tenants, no business rules.
 */

export { SEFIN_BASE_URL, DEFAULT_AMBIENTE, resolveSefinBaseUrl } from './config.js';
export type { Ambiente } from './config.js';

export { enviarDps, consultarNfse, enviarEvento, extrairErros } from './sefinClient.js';
export type { SefinErro, SefinResposta } from './sefinClient.js';

export { gzipBase64, gunzipBase64 } from './gzipB64.js';

export { signDps, signEnveloped, verifyDps } from './signXml.js';

export { loadPfxFromBuffer, loadPfx } from './loadPfx.js';
export type { PfxMaterial } from './loadPfx.js';
