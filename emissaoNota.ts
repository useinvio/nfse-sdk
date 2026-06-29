import { DEFAULT_AMBIENTE } from './config.js';
import { buildDpsFromJson } from './dpsJson.js';
import { extrairErros, transmitirDpsCompactada } from './sefinClient.js';
import { gzipBase64, gunzipBase64 } from './gzipB64.js';
import { signDps } from './signXml.js';
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

interface NotaPreparada {
  ambiente: Ambiente;
  dpsId: string;
  xml: string;
}

function isXmlString(input: string): boolean {
  return input.trimStart().startsWith('<');
}

function extractDpsId(xml: string): string | undefined {
  return xml.match(/<[^:>\s]*:?infDPS\b[^>]*\bId=["']([^"']+)["']/)?.[1];
}

function prepararNota(input: NotaInput, options: EmitirNotaOptions = {}): NotaPreparada {
  if (typeof input === 'string' && isXmlString(input)) {
    const dpsId = options.dpsId ?? extractDpsId(input);
    if (!dpsId) {
      throw new Error('Informe options.dpsId ou um XML com Id em <infDPS>.');
    }
    return {
      ambiente: options.ambiente ?? DEFAULT_AMBIENTE,
      dpsId,
      xml: input,
    };
  }

  const request = typeof input === 'string' ? (JSON.parse(input) as DpsJsonRequest) : input;
  const { id, xml } = buildDpsFromJson(request);
  return {
    ambiente: options.ambiente ?? request.ambiente ?? DEFAULT_AMBIENTE,
    dpsId: id,
    xml,
  };
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
  const nota = prepararNota(input, options);
  const signedXml = signDps(nota.xml, nota.dpsId, pfx);
  const dpsXmlGZipB64 = gzipBase64(signedXml);
  const { status, body } = await transmitirDpsCompactada(dpsXmlGZipB64, pfx, nota.ambiente);
  const nfseB64 = body?.nfseXmlGZipB64 ?? body?.NfseXmlGZipB64;

  if (status >= 200 && status < 300 && nfseB64) {
    const nfseXml = gunzipBase64(nfseB64);
    const chaveAcesso = body?.chaveAcesso ?? body?.ChaveAcesso ?? nfseXml.match(/Id="NFS(\d{50})"/)?.[1] ?? '';
    return { chaveAcesso, dpsId: nota.dpsId, nfseXml, status, body };
  }

  throw new EmitirNotaError(`Emissao rejeitada (HTTP ${status})`, status, extrairErros(body), nota.dpsId, body);
}
