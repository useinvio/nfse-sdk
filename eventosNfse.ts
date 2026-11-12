import { assertCertificateValidity } from './certificateValidation.js';
import { NfseCertificate, type CertificateInput } from './certificate.js';
import {
  buildCancelamentoFromJson,
  buildCancelamentoPorSubstituicaoFromJson,
  EventoInvalidoError,
} from './eventoJson.js';
import { gunzipBase64Flexivel, gzipBase64 } from './gzipB64.js';
import { enviarEvento, extrairErros } from './sefinClient.js';
import { signEnveloped } from './signXml.js';
import { validatePedRegEventoXmlAgainstXsd } from './xsdValidation.js';
import type {
  AutorEvento,
  BuiltPedRegEvento,
  CancelamentoNfseInput,
  CancelamentoPorSubstituicaoInput,
} from './eventoJson.js';
import type { SefinErro, SefinRequestOptions } from './sefinClient.js';

/** Event request options. Events are POSTs and are never retried automatically. */
export type RegistrarEventoOptions = Omit<SefinRequestOptions, 'retries'>;

export interface ResultadoEvento {
  pedRegEventoId: string;
  tpEvento: string;
  chaveAcesso: string;
  /** Signed pedRegEvento that was sent. Persist it with the result. */
  pedRegEventoXml: string;
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

/** Input for the high-level helpers: `autor` defaults to the certificate holder's CNPJ/CPF. */
export type ComAutorOpcional<T extends { autor: AutorEvento }> = Omit<T, 'autor'> & { autor?: AutorEvento };

function autorDoCertificado(certificate: CertificateInput): AutorEvento {
  if (certificate instanceof NfseCertificate) {
    if (certificate.cnpj) return { CNPJ: certificate.cnpj };
    if (certificate.cpf) return { CPF: certificate.cpf };
  }
  throw new EventoInvalidoError('autor', 'Informe autor.CNPJ ou autor.CPF: o certificado nao expoe o documento do titular.');
}

/**
 * Validates the pedRegEvento against the official XSD, signs `infPedReg`,
 * compresses and sends it to POST /nfse/{chave}/eventos, normalizing rejections.
 */
export async function registrarEvento(
  built: BuiltPedRegEvento,
  certificate: CertificateInput,
  options?: RegistrarEventoOptions,
): Promise<ResultadoEvento> {
  validatePedRegEventoXmlAgainstXsd(built.xml);
  assertCertificateValidity(certificate);
  const pedRegEventoXml = signEnveloped(built.xml, built.id, 'infPedReg', certificate);
  const { status, body } = await enviarEvento(
    gzipBase64(pedRegEventoXml),
    certificate,
    built.chaveAcesso,
    built.ambiente,
    { ...options, retries: 0 },
  );

  if (status >= 200 && status < 300) {
    const eventoB64 = body?.eventoXmlGZipB64 ?? body?.EventoXmlGZipB64;
    let eventoXml: string | undefined;
    if (typeof eventoB64 === 'string' && eventoB64) {
      try {
        eventoXml = gunzipBase64Flexivel(eventoB64);
      } catch {
        // Unexpected payload: the raw body stays available to the caller.
      }
    }
    return {
      pedRegEventoId: built.id,
      tpEvento: built.tpEvento,
      chaveAcesso: built.chaveAcesso,
      pedRegEventoXml,
      eventoXml,
      status,
      body,
    };
  }

  throw new RegistrarEventoError(`Registro de evento rejeitado (HTTP ${status})`, status, extrairErros(body), built.id, body);
}

/** Cancela uma NFS-e (evento e101101): monta, valida, assina, compacta e envia o pedido. */
export async function cancelarNfse(
  input: ComAutorOpcional<CancelamentoNfseInput>,
  certificate: CertificateInput,
  options?: RegistrarEventoOptions,
): Promise<ResultadoEvento> {
  const built = buildCancelamentoFromJson({ ...input, autor: input.autor ?? autorDoCertificado(certificate) });
  return registrarEvento(built, certificate, options);
}

/** Cancela uma NFS-e por substituicao (evento e105102). A NFS-e substituta deve ter sido emitida antes. */
export async function cancelarNfsePorSubstituicao(
  input: ComAutorOpcional<CancelamentoPorSubstituicaoInput>,
  certificate: CertificateInput,
  options?: RegistrarEventoOptions,
): Promise<ResultadoEvento> {
  const built = buildCancelamentoPorSubstituicaoFromJson({ ...input, autor: input.autor ?? autorDoCertificado(certificate) });
  return registrarEvento(built, certificate, options);
}
