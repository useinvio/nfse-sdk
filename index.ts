/**
 * NFS-e Nacional SDK.
 *
 * Handles the protocol layer only: mTLS, signing, gzip/base64, send, consult, events.
 * No database, no tenants, no business rules.
 */

export { SEFIN_BASE_URL, TP_AMB, DEFAULT_AMBIENTE, resolveSefinBaseUrl } from './config.js';
export type { Ambiente } from './config.js';

export {
  consultarNfse,
  createSefinLatencyTracker,
  enviarEvento,
  extrairErros,
  getSefinRequestObserver,
  setSefinRequestObserver,
} from './sefinClient.js';
export type {
  SefinErro,
  SefinLatencySeriesSnapshot,
  SefinLatencySnapshot,
  SefinLatencyTracker,
  SefinLatencyTrackerOptions,
  SefinOperation,
  SefinRequestMetric,
  SefinRequestObserver,
  SefinResposta,
} from './sefinClient.js';

export { buildDpsFromJson, buildDpsId } from './dpsJson.js';
export type {
  BuiltDps,
  ComExt,
  DpsJsonInput,
  DpsJsonRequest,
  EventoServico,
  Intermediario,
  Obra,
  PrestadorProfile,
  ServicoProfile,
  Tomador,
  TotTrib,
  TribFed,
  TribMun,
  TribNac,
  Valores,
} from './dpsJson.js';

export { DpsFiscalValidationError, validateDpsJsonRequest } from './fiscalValidation.js';

export { EmitirNotaError, emitirNfse } from './emissaoNota.js';
export type { EmitirNotaOptions, NotaInput, ResultadoEmissaoNota } from './emissaoNota.js';

export { NfseClient } from './client.js';
export type {
  CreateInvoiceInput,
  InvoiceResource,
  NfseCertificateInput,
  NfseClientDpsDefaults,
  NfseClientOptions,
  NfseEnvironment,
} from './client.js';

export { gzipBase64, gunzipBase64 } from './gzipB64.js';

export { signDps, signEnveloped, verifyDps, withUtf8XmlDeclaration } from './signXml.js';

export { loadPfxFromBuffer, loadPfx } from './loadPfx.js';
export type { PfxMaterial } from './loadPfx.js';
