import {
  buildCancelamentoFromJson,
  buildCancelamentoPorSubstituicaoFromJson,
} from './eventoJson.js';
import { enviarEvento, extrairErros } from './sefinClient.js';
import { gzipBase64, gunzipBase64Flexivel } from './gzipB64.js';
import { signEnveloped } from './signXml.js';
import type {
  BuiltPedRegEvento,
  CancelamentoNfseInput,
  CancelamentoPorSubstituicaoInput,
} from './eventoJson.js';
import type { PfxMaterial } from './loadPfx.js';
import type { SefinErro, SefinRequestOptions } from './sefinClient.js';

export interface ResultadoEvento {
  pedRegEventoId: string;
  tpEvento: string;
  chaveAcesso: string;
  /** XML do evento registrado, quando devolvido pela SEFIN. */
  eventoXml?: string;
  status: number;
  body: any;
}

export class RegistrarEventoError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly erros: SefinErro[],
    public readonly pedRegEventoId: string,
    public readonly body: any,
  ) {
    super(message);
    this.name = 'RegistrarEventoError';
  }
}

/**
 * Assina o pedido de registro de evento (infPedReg), compacta e envia
 * para POST /nfse/{chave}/eventos, normalizando rejeicoes.
 */
export async function registrarEvento(
  built: BuiltPedRegEvento,
  pfx: PfxMaterial,
  options?: SefinRequestOptions,
): Promise<ResultadoEvento> {
  const signedXml = signEnveloped(built.xml, built.id, 'infPedReg', pfx);
  const pedRegXmlGZipB64 = gzipBase64(signedXml);
  const { status, body } = await enviarEvento(pedRegXmlGZipB64, pfx, built.chaveAcesso, built.ambiente, options);

  if (status >= 200 && status < 300) {
    const eventoB64 = body?.eventoXmlGZipB64 ?? body?.EventoXmlGZipB64;
    let eventoXml: string | undefined;
    if (typeof eventoB64 === 'string' && eventoB64) {
      try {
        eventoXml = gunzipBase64Flexivel(eventoB64);
      } catch {
        // Corpo inesperado: mantem o body bruto para inspecao do chamador.
      }
    }
    return {
      pedRegEventoId: built.id,
      tpEvento: built.tpEvento,
      chaveAcesso: built.chaveAcesso,
      eventoXml,
      status,
      body,
    };
  }

  throw new RegistrarEventoError(
    `Registro de evento rejeitado (HTTP ${status})`,
    status,
    extrairErros(body),
    built.id,
    body,
  );
}

/** Cancela uma NFS-e (evento e101101): monta, assina, compacta e envia o pedido. */
export async function cancelarNfse(
  input: CancelamentoNfseInput,
  pfx: PfxMaterial,
  options?: SefinRequestOptions,
): Promise<ResultadoEvento> {
  return registrarEvento(buildCancelamentoFromJson(input), pfx, options);
}

/** Cancela uma NFS-e por substituicao (evento e105102). */
export async function cancelarNfsePorSubstituicao(
  input: CancelamentoPorSubstituicaoInput,
  pfx: PfxMaterial,
  options?: SefinRequestOptions,
): Promise<ResultadoEvento> {
  return registrarEvento(buildCancelamentoPorSubstituicaoFromJson(input), pfx, options);
}
