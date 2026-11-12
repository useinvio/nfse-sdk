/**
 * NFS-e Nacional SDK.
 *
 * Handles the protocol layer only: mTLS, signing, gzip/base64, send, consult, events.
 * No database, no tenants, no business rules.
 */

export { ADN_BASE_URL, SEFIN_BASE_URL, TP_AMB, DEFAULT_AMBIENTE, resolveAdnBaseUrl, resolveSefinBaseUrl } from './config.js';
export type { Ambiente } from './config.js';

export {
  assertChaveAcesso,
  assertDpsId,
  baixarDanfse,
  ChaveAcessoInvalidaError,
  consultarAliquota,
  consultarBeneficio,
  consultarConvenio,
  consultarDps,
  consultarEvento,
  consultarEventosPorChaveAdn,
  consultarHistoricoAliquotas,
  consultarNfse,
  consultarRegimesEspeciais,
  consultarRetencoes,
  createSefinLatencyTracker,
  distribuirDfePorNsu,
  enviarEvento,
  SefinParametroInvalidoError,
  transmitirDpsCompactada,
  extrairErros,
  getSefinRequestObserver,
  isSefinLatencyMetricsEnabled,
  SEFIN_LATENCY_METRICS_ENV,
  setSefinRequestObserver,
} from './sefinClient.js';
export type {
  ConsultarEventoOptions,
  DanfseResposta,
  DistribuicaoNsuOptions,
  SefinErro,
  SefinRequestOptions,
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

export { DPS_JSON_REQUEST_SCHEMA } from './dpsJsonSchema.js';
export type { JsonSchema } from './dpsJsonSchema.js';

export {
  DPS_SCHEMA_VERSION,
  DpsFiscalValidationError,
  assertValidDpsJsonRequest,
  validateDpsJsonRequest,
  validationIssueFromMessage,
} from './fiscalValidation.js';
export type {
  DpsValidationIssue,
  DpsValidationReport,
  ValidationSeverity,
  ValidationSource,
} from './fiscalValidation.js';

export { EmitirNotaError, emitirNfse, prepararNota, transmitirNotaPreparada } from './emissaoNota.js';
export type { EmitirNotaOptions, NotaInput, NotaPreparada, ResultadoEmissaoNota, TransmissaoOptions } from './emissaoNota.js';

export { ConsultaNfseError, decodificarRespostaNfse, obterNfse, recuperarNfsePorDps } from './consultas.js';
export type { NfseConsultada } from './consultas.js';
export { lerNfse } from './nfseXml.js';

export { buscarRejeicao, explicarErros, explicarRejeicao, listarRejeicoes, REJEICOES_FONTES } from './rejeicoes.js';
export type { ExplicacaoRejeicao, RejeicaoOficial } from './rejeicoes.js';
export type { NfsePessoaResumo, NfseResumo } from './nfseXml.js';

export {
  buildCancelamentoFromJson,
  buildCancelamentoPorSubstituicaoFromJson,
  buildPedRegEventoId,
  EventoInvalidoError,
  MOTIVO_CANCELAMENTO,
  MOTIVO_SUBSTITUICAO,
  TP_EVENTO,
} from './eventoJson.js';
export type {
  AutorEvento,
  BuiltPedRegEvento,
  CancelamentoNfseInput,
  CancelamentoPorSubstituicaoInput,
  MotivoCancelamento,
  MotivoSubstituicao,
  PedRegEventoBase,
  TpEvento,
} from './eventoJson.js';
export { cancelarNfse, cancelarNfsePorSubstituicao, registrarEvento, RegistrarEventoError } from './eventosNfse.js';
export type { ComAutorOpcional, RegistrarEventoOptions, ResultadoEvento } from './eventosNfse.js';

export { NfseClient } from './client.js';
export type {
  CancelBySubstitutionInput,
  CancelInvoiceInput,
  CreateInvoiceInput,
  DistributionResource,
  EventResource,
  GetInvoiceOptions,
  InvoiceResource,
  MunicipalParametersResource,
  NfseCertificateInput,
  NfseClientDpsDefaults,
  NfseClientOptions,
  NfseEnvironment,
} from './client.js';

export { gzipBase64, gunzipBase64, gunzipBase64Flexivel } from './gzipB64.js';

export { signDps, signEnveloped, verifyDps, withUtf8XmlDeclaration } from './signXml.js';

export {
  DpsXsdValidationError,
  PedRegEventoXsdValidationError,
  validateDpsXmlAgainstXsd,
  validatePedRegEventoXmlAgainstXsd,
  XmllintUnavailableError,
  XsdEngineUnavailableError,
} from './xsdValidation.js';

export { loadPfxFromBuffer, loadPfx } from './loadPfx.js';
export type { PfxMaterial } from './loadPfx.js';

export { assertCertificateValidity, assertCertificateForProvider, CertificateValidationError } from './certificateValidation.js';
export type { CertificateValidationCode } from './certificateValidation.js';

export { NfseCertificate, NFSE_CERT_ENV } from './certificate.js';
export type { CertificateInput, NfseCertificateFromPemInput, NfseCertificateInfo } from './certificate.js';
