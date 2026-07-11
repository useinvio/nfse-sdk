import { DEFAULT_AMBIENTE } from './config.js';
import type { Ambiente } from './config.js';
import type { DpsJsonInput, DpsJsonRequest, PrestadorProfile, ServicoProfile } from './dpsJson.js';
import { emitirNfse, type ResultadoEmissaoNota } from './emissaoNota.js';
import { cancelarNfse, cancelarNfsePorSubstituicao, type ResultadoEvento } from './eventosNfse.js';
import { loadPfxFromBuffer, type PfxMaterial } from './loadPfx.js';
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
  distribuirDfePorNsu,
  type DanfseResposta,
  type DistribuicaoNsuOptions,
  type SefinRequestOptions,
  type SefinResposta,
} from './sefinClient.js';
import type { CancelamentoNfseInput, CancelamentoPorSubstituicaoInput } from './eventoJson.js';

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

export interface NfseClientOptions {
  environment?: NfseEnvironment;
  certificate: NfseCertificateInput | PfxMaterial;
  defaults?: NfseClientDpsDefaults;
  /** Opcoes de transporte (timeout/retries) aplicadas a todas as chamadas. */
  request?: SefinRequestOptions;
}

export interface InvoiceResource {
  create(input: CreateInvoiceInput): Promise<ResultadoEmissaoNota>;
  buildDpsJson(input: CreateInvoiceInput): DpsJsonRequest;
  get(chaveAcesso: string): Promise<SefinResposta>;
  /** GET /dps/{id} — recupera a NFS-e pelo Id da DPS (util apos timeout na emissao). */
  getByDpsId(dpsId: string): Promise<SefinResposta>;
  /** Registra o evento e101101 (Cancelamento de NFS-e). */
  cancel(input: Omit<CancelamentoNfseInput, 'ambiente'>): Promise<ResultadoEvento>;
  /** Registra o evento e105102 (Cancelamento de NFS-e por Substituicao). */
  cancelBySubstitution(input: Omit<CancelamentoPorSubstituicaoInput, 'ambiente'>): Promise<ResultadoEvento>;
  /** GET /danfse/{chave} — baixa o PDF do DANFSe. */
  danfsePdf(chaveAcesso: string): Promise<DanfseResposta>;
}

export interface EventResource {
  /** GET /nfse/{chave}/eventos/{tpEvento}[/{nSeqEvento}] na SEFIN. */
  get(chaveAcesso: string, tpEvento: string, nSeqEvento?: string | number): Promise<SefinResposta>;
  /** GET /contribuintes/NFSe/{chave}/Eventos no ADN. */
  listByChave(chaveAcesso: string): Promise<SefinResposta>;
}

export interface DistributionResource {
  /** GET /contribuintes/DFe/{nsu} no ADN. */
  byNsu(nsu: string | number, options?: Pick<DistribuicaoNsuOptions, 'cnpjConsulta' | 'lote'>): Promise<SefinResposta>;
}

export interface MunicipalParametersResource {
  convenio(codigoMunicipio: string): Promise<SefinResposta>;
  aliquota(codigoMunicipio: string, codigoServico: string, competencia: string): Promise<SefinResposta>;
  historicoAliquotas(codigoMunicipio: string, codigoServico: string): Promise<SefinResposta>;
  regimesEspeciais(codigoMunicipio: string, codigoServico: string, competencia: string): Promise<SefinResposta>;
  beneficio(codigoMunicipio: string, numeroBeneficio: string, competencia: string): Promise<SefinResposta>;
}

function resolveEnvironment(environment: NfseEnvironment | undefined): Ambiente {
  if (!environment || environment === 'sandbox') return DEFAULT_AMBIENTE;
  if (environment === 'production') return 'producao';
  return environment;
}

function isPfxMaterial(value: NfseCertificateInput | PfxMaterial): value is PfxMaterial {
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
  private readonly pfx: PfxMaterial;
  private readonly defaults: NfseClientDpsDefaults;
  private readonly request?: SefinRequestOptions;

  constructor(options: NfseClientOptions) {
    this.ambiente = resolveEnvironment(options.environment);
    this.pfx = isPfxMaterial(options.certificate)
      ? options.certificate
      : loadPfxFromBuffer(decodeCertificateContent(options.certificate), options.certificate.password);
    this.defaults = options.defaults ?? {};
    this.request = options.request;
    this.invoices = {
      create: (input) => this.createInvoice(input),
      buildDpsJson: (input) => this.buildInvoiceDpsJson(input),
      get: (chaveAcesso) => this.getInvoice(chaveAcesso),
      getByDpsId: (dpsId) => consultarDps(dpsId, this.pfx, this.ambiente, this.request),
      cancel: (input) => cancelarNfse({ ...input, ambiente: this.ambiente }, this.pfx, this.request),
      cancelBySubstitution: (input) =>
        cancelarNfsePorSubstituicao({ ...input, ambiente: this.ambiente }, this.pfx, this.request),
      danfsePdf: (chaveAcesso) => baixarDanfse(chaveAcesso, this.pfx, this.ambiente, this.request),
    };
    this.events = {
      get: (chaveAcesso, tpEvento, nSeqEvento) =>
        consultarEvento(chaveAcesso, tpEvento, nSeqEvento, this.pfx, this.ambiente, this.request),
      listByChave: (chaveAcesso) => consultarEventosPorChaveAdn(chaveAcesso, this.pfx, this.ambiente, this.request),
    };
    this.distribution = {
      byNsu: (nsu, opts) => distribuirDfePorNsu(nsu, this.pfx, this.ambiente, { ...this.request, ...opts }),
    };
    this.municipalParameters = {
      convenio: (codMun) => consultarConvenio(codMun, this.pfx, this.ambiente, this.request),
      aliquota: (codMun, codServ, competencia) =>
        consultarAliquota(codMun, codServ, competencia, this.pfx, this.ambiente, this.request),
      historicoAliquotas: (codMun, codServ) =>
        consultarHistoricoAliquotas(codMun, codServ, this.pfx, this.ambiente, this.request),
      regimesEspeciais: (codMun, codServ, competencia) =>
        consultarRegimesEspeciais(codMun, codServ, competencia, this.pfx, this.ambiente, this.request),
      beneficio: (codMun, numBenef, competencia) =>
        consultarBeneficio(codMun, numBenef, competencia, this.pfx, this.ambiente, this.request),
    };
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
    return emitirNfse(dpsJson, this.pfx, { ambiente: dpsJson.ambiente, ...this.request });
  }

  private async getInvoice(chaveAcesso: string): Promise<SefinResposta> {
    return consultarNfse(chaveAcesso, this.pfx, this.ambiente, this.request);
  }
}
