import { DEFAULT_AMBIENTE } from './config.js';
import { buildDpsFromJson } from './dpsJson.js';
import { extrairErros, transmitirDpsCompactada } from './sefinClient.js';
import { gzipBase64, gunzipBase64 } from './gzipB64.js';
import { signDps } from './signXml.js';
import { verifyDps } from './signXml.js';
import { validateDpsXmlAgainstXsd } from './xsdValidation.js';
import type { Ambiente } from './config.js';
import type { DpsJsonRequest } from './dpsJson.js';
import type { PfxMaterial } from './loadPfx.js';
import type { SefinErro } from './sefinClient.js';

export type NotaInput = DpsJsonRequest | string;

export interface EmitirNotaOptions {
  ambiente?: Ambiente;
  /** Obrigatorio quando o input for XML sem Id em <infDPS>. */
  dpsId?: string;
}

export interface ResultadoEmissaoNota {
  chaveAcesso: string;
  dpsId: string;
  nfseXml: string;
  status: number;
  body: any;
}

export class EmitirNotaError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly erros: SefinErro[],
    public readonly dpsId: string,
    public readonly body: any,
  ) {
    super(message);
    this.name = 'EmitirNotaError';
  }
}

export interface NotaPreparada {
  ambiente: Ambiente;
  dpsId: string;
  unsignedXml: string;
  signedXml: string;
}

function isXmlString(input: string): boolean {
  return input.trimStart().startsWith('<');
}

function extractDpsId(xml: string): string | undefined {
  return xml.match(/<[^:>\s]*:?infDPS\b[^>]*\bId=["']([^"']+)["']/)?.[1];
}

export function prepararNota(
  input: NotaInput,
  pfx: PfxMaterial,
  options: EmitirNotaOptions = {},
): NotaPreparada {
  let ambiente: Ambiente;
  let dpsId: string;
  let unsignedXml: string;
  if (typeof input === 'string' && isXmlString(input)) {
    dpsId = options.dpsId ?? extractDpsId(input) ?? '';
    if (!dpsId) {
      throw new Error('Informe options.dpsId ou um XML com Id em <infDPS>.');
    }
    ambiente = options.ambiente ?? DEFAULT_AMBIENTE;
    unsignedXml = input;
  } else {
    const request = typeof input === 'string' ? (JSON.parse(input) as DpsJsonRequest) : input;
    const built = buildDpsFromJson(request);
    ambiente = options.ambiente ?? request.ambiente ?? DEFAULT_AMBIENTE;
    dpsId = built.id;
    unsignedXml = built.xml;
  }

  validateDpsXmlAgainstXsd(unsignedXml);
  const signedXml = signDps(unsignedXml, dpsId, pfx);
  if (!verifyDps(signedXml, pfx.certPem)) {
    throw new Error('A assinatura XML da DPS nao pode ser verificada.');
  }
  return { ambiente, dpsId, unsignedXml, signedXml };
}

/** Sends an already validated, signed and persistable DPS. */
export async function transmitirNotaPreparada(
  nota: NotaPreparada,
  pfx: PfxMaterial,
): Promise<ResultadoEmissaoNota> {
  const dpsXmlGZipB64 = gzipBase64(nota.signedXml);
  const { status, body } = await transmitirDpsCompactada(dpsXmlGZipB64, pfx, nota.ambiente);
  const nfseB64 = body?.nfseXmlGZipB64 ?? body?.NfseXmlGZipB64;

  if (status >= 200 && status < 300 && nfseB64) {
    const nfseXml = gunzipBase64(nfseB64);
    const chaveAcesso = body?.chaveAcesso ?? body?.ChaveAcesso ?? nfseXml.match(/Id="NFS(\d{50})"/)?.[1] ?? '';
    return { chaveAcesso, dpsId: nota.dpsId, nfseXml, status, body };
  }

  throw new EmitirNotaError(`Emissao rejeitada (HTTP ${status})`, status, extrairErros(body), nota.dpsId, body);
}

/**
 * Emite uma NFS-e a partir de XML de DPS ou JSON declarativo.
 *
 * O metodo centraliza a burocracia do protocolo: monta XML quando recebe JSON,
 * assina, compacta em GZip/Base64, envia por mTLS e normaliza rejeicoes.
 */
export async function emitirNfse(
  input: NotaInput,
  pfx: PfxMaterial,
  options: EmitirNotaOptions = {},
): Promise<ResultadoEmissaoNota> {
  return transmitirNotaPreparada(prepararNota(input, pfx, options), pfx);
}
