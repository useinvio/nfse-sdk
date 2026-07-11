/**
 * NFS-e Nacional SDK.
 *
 * Handles the protocol layer only: mTLS, signing, gzip/base64, send, consult,
 * events, DANFSe, ADN distribution, and municipal parameter queries.
 * No database, no tenants, no business rules.
 */

export { ADN_BASE_URL, SEFIN_BASE_URL, TP_AMB, DEFAULT_AMBIENTE, resolveAdnBaseUrl, resolveSefinBaseUrl } from './config.js';
export type { Ambiente } from './config.js';

export {
  baixarDanfse,
  consultarAliquota,
  consultarBeneficio,
  consultarConvenio,
  consultarDps,
  consultarEvento,
  consultarEventosPorChaveAdn,
  consultarHistoricoAliquotas,
  consultarNfse,
  consultarRegimesEspeciais,
  createSefinLatencyTracker,
  distribuirDfePorNsu,
  enviarEvento,
  extrairErros,
  getSefinRequestObserver,
  isSefinLatencyMetricsEnabled,
  SEFIN_LATENCY_METRICS_ENV,
  setSefinRequestObserver,
} from './sefinClient.js';
export type {
  DanfseResposta,
  DistribuicaoNsuOptions,
  SefinErro,
  SefinLatencySeriesSnapshot,
  SefinLatencySnapshot,
  SefinLatencyTracker,
  SefinLatencyTrackerOptions,
  SefinOperation,
  SefinRequestMetric,
  SefinRequestObserver,
  SefinRequestOptions,
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

export {
  buildCancelamentoFromJson,
  buildCancelamentoPorSubstituicaoFromJson,
  buildPedRegEventoId,
  TP_EVENTO,
} from './eventoJson.js';
export type {
  AutorEvento,
  BuiltPedRegEvento,
  CancelamentoNfseInput,
  CancelamentoPorSubstituicaoInput,
  TpEvento,
} from './eventoJson.js';

export {
  cancelarNfse,
  cancelarNfsePorSubstituicao,
  registrarEvento,
  RegistrarEventoError,
} from './eventosNfse.js';
export type { ResultadoEvento } from './eventosNfse.js';

export { NfseClient } from './client.js';
export type {
  CreateInvoiceInput,
  DistributionResource,
  EventResource,
  InvoiceResource,
  MunicipalParametersResource,
  NfseCertificateInput,
  NfseClientDpsDefaults,
  NfseClientOptions,
  NfseEnvironment,
} from './client.js';

export { gzipBase64, gunzipBase64, gunzipBase64Flexivel } from './gzipB64.js';

export { signDps, signEnveloped, verifyDps, withUtf8XmlDeclaration } from './signXml.js';

export { loadPfxFromBuffer, loadPfx } from './loadPfx.js';
export type { PfxMaterial } from './loadPfx.js';
