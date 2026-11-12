import { DEFAULT_AMBIENTE } from './config.js';
import type { Ambiente } from './config.js';
import type { DpsJsonInput, DpsJsonRequest, PrestadorProfile, ServicoProfile } from './dpsJson.js';
import { emitirNfse, type ResultadoEmissaoNota } from './emissaoNota.js';
import { NfseCertificate, type CertificateInput } from './certificate.js';
import type { PfxMaterial } from './loadPfx.js';
import { obterNfse, recuperarNfsePorDps, type NfseConsultada } from './consultas.js';
import {
  cancelarNfse,
  cancelarNfsePorSubstituicao,
  type ComAutorOpcional,
  type ResultadoEvento,
} from './eventosNfse.js';
import type { CancelamentoNfseInput, CancelamentoPorSubstituicaoInput } from './eventoJson.js';
import {
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
  consultarRetencoes,
  distribuirDfePorNsu,
  type DanfseResposta,
  type SefinRequestOptions,
  type SefinResposta,
} from './sefinClient.js';

export type NfseEnvironment = 'sandbox' | 'production' | Ambiente;

export interface NfseCertificateInput {
  /** Conteudo bruto ou base64 do arquivo A1/PFX. */
  content: string | Buffer;
  password: string;
  encoding?: 'base64' | 'binary' | 'utf8';
}

export interface NfseClientDpsDefaults {
  ambiente?: Ambiente;
  prestador?: Partial<PrestadorProfile>;
  servico?: Partial<ServicoProfile>;
  emissao?: Partial<DpsJsonInput>;
}

export type CreateInvoiceInput = NfseClientDpsDefaults;

export interface GetInvoiceOptions {
  ambiente?: Ambiente;
}

export type CancelInvoiceInput = ComAutorOpcional<CancelamentoNfseInput>;
export type CancelBySubstitutionInput = ComAutorOpcional<CancelamentoPorSubstituicaoInput>;

export interface NfseClientOptions {
  environment?: NfseEnvironment;
  /** Prefer `NfseCertificate.fromEnv()` / `fromFile()`; raw PFX content and legacy `PfxMaterial` are also accepted. */
  certificate: NfseCertificateInput | NfseCertificate | PfxMaterial;
  defaults?: NfseClientDpsDefaults;
  /** Transport options for every call. `retries` only applies to GETs; emission and events are never retried. */
  request?: SefinRequestOptions;
}

export interface InvoiceResource {
  create(input: CreateInvoiceInput): Promise<ResultadoEmissaoNota>;
  buildDpsJson(input: CreateInvoiceInput): DpsJsonRequest;
  /** GET /nfse/{chave}: raw status/body. Prefer `retrieve` for the decoded XML and typed summary. */
  get(chaveAcesso: string, options?: GetInvoiceOptions): Promise<SefinResposta>;
  /** GET /nfse/{chave}: decompressed XML plus typed summary; throws `ConsultaNfseError` on non-2xx. */
  retrieve(chaveAcesso: string, options?: GetInvoiceOptions): Promise<NfseConsultada>;
  /** GET /dps/{id}: raw status/body with the access key generated from a DPS. */
  getByDpsId(dpsId: string, options?: GetInvoiceOptions): Promise<SefinResposta>;
  /** Recovers an emission with unknown outcome by DPS Id; `null` means no NFS-e exists for it. */
  recover(dpsId: string, options?: GetInvoiceOptions): Promise<NfseConsultada | null>;
  /** Event e101101. `autor` defaults to the certificate holder. */
  cancel(input: CancelInvoiceInput): Promise<ResultadoEvento>;
  /** Event e105102. Issue the replacement NFS-e first. */
  cancelBySubstitution(input: CancelBySubstitutionInput): Promise<ResultadoEvento>;
  /** ADN GET /danfse/{chave}: the official DANFSe PDF. */
  danfse(chaveAcesso: string, options?: GetInvoiceOptions): Promise<DanfseResposta>;
}

export interface EventResource {
  /** SEFIN GET /nfse/{chave}/eventos/{tpEvento}/{nSeqEvento}. */
  get(chaveAcesso: string, tpEvento: string, nSeqEvento?: number | string): Promise<SefinResposta>;
  /** ADN GET /contribuintes/NFSe/{chave}/Eventos. */
  listByAccessKey(chaveAcesso: string): Promise<SefinResposta>;
}

export interface DistributionResource {
  /** ADN GET /contribuintes/DFe/{nsu}: documents issued to or by the certificate holder. */
  byNsu(nsu: string | number, options?: { cnpjConsulta?: string; lote?: boolean }): Promise<SefinResposta>;
}

export interface MunicipalParametersResource {
  agreement(codigoMunicipio: string): Promise<SefinResposta>;
  rate(codigoMunicipio: string, codigoServico: string, competencia: string): Promise<SefinResposta>;
  rateHistory(codigoMunicipio: string, codigoServico: string): Promise<SefinResposta>;
  specialRegimes(codigoMunicipio: string, codigoServico: string, competencia: string): Promise<SefinResposta>;
  withholdings(codigoMunicipio: string, competencia: string): Promise<SefinResposta>;
  benefit(codigoMunicipio: string, numeroBeneficio: string, competencia: string): Promise<SefinResposta>;
}

function resolveEnvironment(environment: NfseEnvironment | undefined): Ambiente {
  if (!environment || environment === 'sandbox') return DEFAULT_AMBIENTE;
  if (environment === 'production') return 'producao';
  return environment;
}

function isPfxMaterial(value: NfseClientOptions['certificate']): value is PfxMaterial {
  return 'privateKeyPem' in value && 'certPem' in value && 'pfxBuffer' in value;
}

function decodeCertificateContent(certificate: NfseCertificateInput): Buffer {
  if (Buffer.isBuffer(certificate.content)) return certificate.content;

  const content = certificate.content.trim();
  const encoding = certificate.encoding ?? 'base64';
  if (encoding === 'base64') {
    const base64 = content.includes(',') ? content.slice(content.indexOf(',') + 1) : content;
    return Buffer.from(base64.replace(/\s/g, ''), 'base64');
  }

  return Buffer.from(content, encoding);
}

function ensureObject<T extends object>(value: T | undefined, field: string): T {
  if (!value || Object.keys(value).length === 0) {
    throw new Error(`Campo obrigatorio ausente para criar NFS-e: ${field}`);
  }
  return value;
}

export class NfseClient {
  public readonly invoices: InvoiceResource;
  public readonly events: EventResource;
  public readonly distribution: DistributionResource;
  public readonly municipalParameters: MunicipalParametersResource;

  private readonly ambiente: Ambiente;
  private readonly pfx: CertificateInput;
  private readonly defaults: NfseClientDpsDefaults;
  private readonly request: SefinRequestOptions;

  constructor(options: NfseClientOptions) {
    this.ambiente = resolveEnvironment(options.environment);
    const { certificate } = options;
    this.pfx = certificate instanceof NfseCertificate || isPfxMaterial(certificate)
      ? certificate
      : NfseCertificate.fromPfx(decodeCertificateContent(certificate), certificate.password);
    this.defaults = options.defaults ?? {};
    this.request = options.request ?? {};
    const req = this.request;
    const amb = (options?: GetInvoiceOptions) => this.resolveAmbiente(options?.ambiente);
    this.invoices = {
      create: (input) => this.createInvoice(input),
      buildDpsJson: (input) => this.buildInvoiceDpsJson(input),
      get: (chaveAcesso, options) => consultarNfse(chaveAcesso, this.pfx, amb(options), req),
      retrieve: (chaveAcesso, options) => obterNfse(chaveAcesso, this.pfx, amb(options), req),
      getByDpsId: (dpsId, options) => consultarDps(dpsId, this.pfx, amb(options), req),
      recover: (dpsId, options) => recuperarNfsePorDps(dpsId, this.pfx, amb(options), req),
      cancel: (input) => cancelarNfse({ ...input, ambiente: amb(input) }, this.pfx, req),
      cancelBySubstitution: (input) => cancelarNfsePorSubstituicao({ ...input, ambiente: amb(input) }, this.pfx, req),
      danfse: (chaveAcesso, options) => baixarDanfse(chaveAcesso, this.pfx, amb(options), req),
    };
    this.events = {
      get: (chaveAcesso, tpEvento, nSeqEvento) =>
        consultarEvento(chaveAcesso, tpEvento, this.pfx, amb(), { ...req, nSeqEvento }),
      listByAccessKey: (chaveAcesso) => consultarEventosPorChaveAdn(chaveAcesso, this.pfx, amb(), req),
    };
    this.distribution = {
      byNsu: (nsu, options) => distribuirDfePorNsu(nsu, this.pfx, amb(), { ...req, ...options }),
    };
    this.municipalParameters = {
      agreement: (mun) => consultarConvenio(mun, this.pfx, amb(), req),
      rate: (mun, servico, competencia) => consultarAliquota(mun, servico, competencia, this.pfx, amb(), req),
      rateHistory: (mun, servico) => consultarHistoricoAliquotas(mun, servico, this.pfx, amb(), req),
      specialRegimes: (mun, servico, competencia) => consultarRegimesEspeciais(mun, servico, competencia, this.pfx, amb(), req),
      withholdings: (mun, competencia) => consultarRetencoes(mun, competencia, this.pfx, amb(), req),
      benefit: (mun, beneficio, competencia) => consultarBeneficio(mun, beneficio, competencia, this.pfx, amb(), req),
    };
  }

  private resolveAmbiente(ambiente?: Ambiente): Ambiente {
    return ambiente ?? this.defaults.ambiente ?? this.ambiente;
  }

  private buildInvoiceDpsJson(input: CreateInvoiceInput): DpsJsonRequest {
    const prestador = {
      ...this.defaults.prestador,
      ...input.prestador,
    };
    const servico = {
      ...this.defaults.servico,
      ...input.servico,
    };
    const emissao = {
      ...this.defaults.emissao,
      ...input.emissao,
    };

    return {
      ambiente: input.ambiente ?? this.defaults.ambiente ?? this.ambiente,
      prestador: ensureObject(prestador, 'prestador') as PrestadorProfile,
      servico: ensureObject(servico, 'servico') as ServicoProfile,
      emissao: ensureObject(emissao, 'emissao') as DpsJsonInput,
    };
  }

  private async createInvoice(input: CreateInvoiceInput): Promise<ResultadoEmissaoNota> {
    const dpsJson = this.buildInvoiceDpsJson(input);
    return emitirNfse(dpsJson, this.pfx, { ambiente: dpsJson.ambiente, timeoutMs: this.request.timeoutMs, signal: this.request.signal });
  }
}
