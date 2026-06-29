import { DEFAULT_AMBIENTE } from './config.js';
import type { Ambiente } from './config.js';
import type { DpsJsonInput, DpsJsonRequest, PrestadorProfile, ServicoProfile } from './dpsJson.js';
import { emitirNfse, type ResultadoEmissaoNota } from './emissaoNota.js';
import { loadPfxFromBuffer, type PfxMaterial } from './loadPfx.js';
import { consultarNfse, type SefinResposta } from './sefinClient.js';

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
}

export interface InvoiceResource {
  create(input: CreateInvoiceInput): Promise<ResultadoEmissaoNota>;
  buildDpsJson(input: CreateInvoiceInput): DpsJsonRequest;
  get(chaveAcesso: string): Promise<SefinResposta>;
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

  private readonly ambiente: Ambiente;
  private readonly pfx: PfxMaterial;
  private readonly defaults: NfseClientDpsDefaults;

  constructor(options: NfseClientOptions) {
    this.ambiente = resolveEnvironment(options.environment);
    this.pfx = isPfxMaterial(options.certificate)
      ? options.certificate
      : loadPfxFromBuffer(decodeCertificateContent(options.certificate), options.certificate.password);
    this.defaults = options.defaults ?? {};
    this.invoices = {
      create: (input) => this.createInvoice(input),
      buildDpsJson: (input) => this.buildInvoiceDpsJson(input),
      get: (chaveAcesso) => this.getInvoice(chaveAcesso),
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
    return emitirNfse(dpsJson, this.pfx, { ambiente: dpsJson.ambiente });
  }

  private async getInvoice(chaveAcesso: string): Promise<SefinResposta> {
    return consultarNfse(chaveAcesso, this.pfx, this.ambiente);
  }
}
