import { DEFAULT_AMBIENTE } from './config.js';
import {
  type DpsJsonRequest,
  type PrestadorProfile,
  type ServicoProfile,
  type TotTrib,
  type TribFed,
  type TribMun,
  type TribNac,
} from './dpsJson.js';
import { emitirNfse, type ResultadoEmissaoNota } from './emissaoNota.js';
import { loadPfxFromBuffer, type PfxMaterial } from './loadPfx.js';
import { consultarNfse, type SefinResposta } from './sefinClient.js';
import type { Ambiente } from './config.js';

export type NfseEnvironment = 'sandbox' | 'production' | Ambiente;

export interface NfseCertificateInput {
  /** Conteudo bruto ou base64 do arquivo A1/PFX. */
  content: string | Buffer;
  password: string;
  encoding?: 'base64' | 'binary' | 'utf8';
}

export interface NfseClientProviderDefaults {
  document?: string;
  documentType?: '1' | '2' | string;
  cityCode?: string;
  series?: string;
  simpleNationalOption?: string;
  specialTaxRegime?: string;
}

export interface NfseClientServiceDefaults {
  nationalTaxCode?: string;
  cityCode?: string;
  nbsCode?: string;
}

export interface NfseClientOptions {
  environment?: NfseEnvironment;
  certificate: NfseCertificateInput | PfxMaterial;
  defaults?: {
    provider?: NfseClientProviderDefaults;
    service?: NfseClientServiceDefaults;
  };
}

export interface CreateInvoiceProvider {
  document?: string;
  documentType?: '1' | '2' | string;
  municipalRegistration?: string;
  cityCode?: string;
  series?: string;
  simpleNationalOption?: string;
  specialTaxRegime?: string;
}

export interface CreateInvoiceCustomer {
  document?: string;
  name?: string;
  email?: string;
  phone?: string;
  address?: Record<string, string>;
  foreignTaxId?: string;
  noForeignTaxIdReason?: string;
}

export interface CreateInvoiceService {
  /** Codigo nacional de tributacao. Alias amigavel de `nationalTaxCode`. */
  code?: string;
  nationalTaxCode?: string;
  description: string;
  amount: string | number;
  cityCode?: string;
  nbsCode?: string;
}

export interface CreateInvoiceTaxation {
  municipal?: TribMun;
  federal?: TribFed;
  national?: TribNac;
  total?: TotTrib;
}

export interface CreateInvoiceInput {
  provider?: CreateInvoiceProvider;
  customer?: CreateInvoiceCustomer;
  service: CreateInvoiceService;
  number?: string | number;
  series?: string;
  issuedAt?: string | Date;
  competenceDate?: string | Date;
  taxation?: CreateInvoiceTaxation;
}

export interface InvoiceResource {
  create(input: CreateInvoiceInput): Promise<ResultadoEmissaoNota>;
  buildDpsJson(input: CreateInvoiceInput): DpsJsonRequest;
  get(accessKey: string): Promise<SefinResposta>;
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

function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

function required(value: string | number | undefined | null, field: string): string {
  if (value === undefined || value === null || value === '') {
    throw new Error(`Campo obrigatorio ausente para criar NFS-e: ${field}`);
  }
  return String(value);
}

function dateToDpsDateTime(value: string | Date | undefined): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  return value.toISOString();
}

function dateToDpsDate(value: string | Date | undefined): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  return value.toISOString().slice(0, 10);
}

function buildCustomer(customer: CreateInvoiceCustomer | undefined): DpsJsonRequest['emissao']['tomador'] {
  if (!customer) return undefined;
  const document = customer.document ? onlyDigits(customer.document) : undefined;
  const isCnpj = document && document.length > 11;

  return {
    CNPJ: isCnpj ? document : undefined,
    CPF: document && !isCnpj ? document : undefined,
    NIF: customer.foreignTaxId,
    cNaoNIF: customer.noForeignTaxIdReason,
    xNome: customer.name,
    end: customer.address,
    fone: customer.phone,
    email: customer.email,
  };
}

export class NfseClient {
  public readonly invoices: InvoiceResource;

  private readonly ambiente: Ambiente;
  private readonly pfx: PfxMaterial;
  private readonly defaults: NfseClientOptions['defaults'];

  constructor(options: NfseClientOptions) {
    this.ambiente = resolveEnvironment(options.environment);
    this.pfx = isPfxMaterial(options.certificate)
      ? options.certificate
      : loadPfxFromBuffer(decodeCertificateContent(options.certificate), options.certificate.password);
    this.defaults = options.defaults;
    this.invoices = {
      create: (input) => this.createInvoice(input),
      buildDpsJson: (input) => this.buildInvoiceDpsJson(input),
      get: (accessKey) => this.getInvoice(accessKey),
    };
  }

  private buildInvoiceDpsJson(input: CreateInvoiceInput): DpsJsonRequest {
    const provider = { ...this.defaults?.provider, ...input.provider };
    const serviceDefaults = this.defaults?.service;
    const series = input.series ?? provider.series;
    const nationalTaxCode = input.service.nationalTaxCode ?? input.service.code ?? serviceDefaults?.nationalTaxCode;
    const serviceCityCode = input.service.cityCode ?? serviceDefaults?.cityCode;

    const prestador: PrestadorProfile = {
      cnpj: onlyDigits(required(provider.document, 'provider.document')),
      tpInsc: provider.documentType ?? '2',
      cLocEmi: required(provider.cityCode, 'provider.cityCode'),
      serie: required(series, 'series'),
      opSimpNac: required(provider.simpleNationalOption, 'provider.simpleNationalOption'),
      regEspTrib: required(provider.specialTaxRegime, 'provider.specialTaxRegime'),
    };

    const servico: ServicoProfile = {
      cTribNac: required(nationalTaxCode, 'service.code'),
      cNBS: input.service.nbsCode ?? serviceDefaults?.nbsCode,
      xDescServ: required(input.service.description, 'service.description'),
      cLocPrestacao: required(serviceCityCode, 'service.cityCode'),
    };

    return {
      ambiente: this.ambiente,
      prestador,
      servico,
      emissao: {
        serie: input.series,
        nDPS: required(input.number, 'number'),
        dhEmi: dateToDpsDateTime(input.issuedAt),
        dCompet: dateToDpsDate(input.competenceDate),
        valores: {
          vServ: required(input.service.amount, 'service.amount'),
        },
        tomador: buildCustomer(input.customer),
        tributacaoMunicipal: input.taxation?.municipal,
        tributacaoFederal: input.taxation?.federal,
        tribNac: input.taxation?.national,
        totTrib: input.taxation?.total,
      },
    };
  }

  private async createInvoice(input: CreateInvoiceInput): Promise<ResultadoEmissaoNota> {
    return emitirNfse(this.buildInvoiceDpsJson(input), this.pfx, { ambiente: this.ambiente });
  }

  private async getInvoice(accessKey: string): Promise<SefinResposta> {
    return consultarNfse(accessKey, this.pfx, this.ambiente);
  }
}
