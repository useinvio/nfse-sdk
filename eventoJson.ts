import { DEFAULT_AMBIENTE, TP_AMB } from './config.js';
import { el, nowSaoPauloOffset, onlyDigits, requiredTextEl, textEl } from './xmlBuild.js';
import type { Ambiente } from './config.js';

const NS = 'http://www.sped.fazenda.gov.br/nfse';
const VERSAO = '1.01';
const VER_APLIC = 'UseInvio';

/** Event types the builder supports (pedRegEvento layout v1.01). */
export const TP_EVENTO = {
  cancelamento: '101101',
  cancelamentoPorSubstituicao: '105102',
} as const;

export type TpEvento = (typeof TP_EVENTO)[keyof typeof TP_EVENTO];

/** Justificativas do cancelamento (TSCodJustCanc). */
export const MOTIVO_CANCELAMENTO = {
  erroNaEmissao: '1',
  servicoNaoPrestado: '2',
  outros: '9',
} as const;

/** Justificativas do cancelamento por substituicao (TSCodJustSubst). */
export const MOTIVO_SUBSTITUICAO = {
  desenquadramentoSimplesNacional: '01',
  enquadramentoSimplesNacional: '02',
  inclusaoRetroativaImunidadeIsencao: '03',
  exclusaoRetroativaImunidadeIsencao: '04',
  rejeicaoPeloTomadorOuIntermediario: '05',
  outros: '99',
} as const;

export type MotivoCancelamento = (typeof MOTIVO_CANCELAMENTO)[keyof typeof MOTIVO_CANCELAMENTO];
export type MotivoSubstituicao = (typeof MOTIVO_SUBSTITUICAO)[keyof typeof MOTIVO_SUBSTITUICAO];

export interface AutorEvento {
  /** CNPJ do autor do evento (14 digitos). Informe CNPJ ou CPF, nunca ambos. */
  CNPJ?: string;
  /** CPF do autor do evento (11 digitos). */
  CPF?: string;
}

export interface PedRegEventoBase {
  ambiente?: Ambiente;
  /** Chave de acesso da NFS-e (50 digitos). */
  chaveAcesso: string;
  autor: AutorEvento;
  /** Data/hora do evento (AAAA-MM-DDThh:mm:ssTZD). Default: agora, horario de Brasilia. */
  dhEvento?: string;
  verAplic?: string;
}

export interface CancelamentoNfseInput extends PedRegEventoBase {
  /** 1 = Erro na Emissao; 2 = Servico nao Prestado; 9 = Outros. */
  cMotivo: MotivoCancelamento;
  /** Justificativa com 15 a 255 caracteres. */
  xMotivo: string;
}

export interface CancelamentoPorSubstituicaoInput extends PedRegEventoBase {
  /** Veja {@link MOTIVO_SUBSTITUICAO}. */
  cMotivo: MotivoSubstituicao;
  /** Justificativa opcional com 15 a 255 caracteres. */
  xMotivo?: string;
  /** Chave de acesso da NFS-e substituta (50 digitos). */
  chaveSubstituta: string;
}

export interface BuiltPedRegEvento {
  /** Id do infPedReg: "PRE" + chave (50) + tpEvento (6). */
  id: string;
  xml: string;
  tpEvento: TpEvento;
  chaveAcesso: string;
  ambiente: Ambiente;
}

/** The event input is invalid; raised before signing or any network I/O. */
export class EventoInvalidoError extends Error {
  readonly code = 'EVENTO_INVALID';
  constructor(public readonly field: string, message: string) {
    super(message);
    this.name = 'EventoInvalidoError';
  }
}

function requireChave(value: unknown, field: string): string {
  if (typeof value !== 'string' || !/^\d{50}$/.test(value)) {
    throw new EventoInvalidoError(field, `${field} deve ter exatamente 50 digitos numericos.`);
  }
  return value;
}

function requireMotivo(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() !== value || value.length < 15 || value.length > 255) {
    throw new EventoInvalidoError(field, `${field} deve ter entre 15 e 255 caracteres, sem espacos nas pontas.`);
  }
  return value;
}

function buildAutor(autor: AutorEvento | undefined): string {
  const hasCnpj = autor?.CNPJ != null && autor.CNPJ !== '';
  const hasCpf = autor?.CPF != null && autor.CPF !== '';
  if (hasCnpj === hasCpf) {
    throw new EventoInvalidoError('autor', 'autor deve informar exatamente um de: CNPJ, CPF.');
  }
  if (hasCnpj) {
    const cnpj = onlyDigits(autor!.CNPJ!);
    if (cnpj.length !== 14) throw new EventoInvalidoError('autor.CNPJ', `autor.CNPJ deve ter 14 digitos (recebido ${cnpj.length}).`);
    return textEl('CNPJAutor', cnpj);
  }
  const cpf = onlyDigits(autor!.CPF!);
  if (cpf.length !== 11) throw new EventoInvalidoError('autor.CPF', `autor.CPF deve ter 11 digitos (recebido ${cpf.length}).`);
  return textEl('CPFAutor', cpf);
}

/**
 * Id do pedido de registro de evento (TSIdPedRegEvt):
 * "PRE" + chave de acesso (50) + tipo do evento (6) = PRE[0-9]{56}.
 */
export function buildPedRegEventoId(chaveAcesso: string, tpEvento: TpEvento | string): string {
  const chave = requireChave(chaveAcesso, 'chaveAcesso');
  if (!/^\d{6}$/.test(String(tpEvento))) {
    throw new EventoInvalidoError('tpEvento', 'tpEvento deve ter 6 digitos (ex.: 101101).');
  }
  return `PRE${chave}${tpEvento}`;
}

function buildPedRegEvento(base: PedRegEventoBase, tpEvento: TpEvento, eventoXml: string): BuiltPedRegEvento {
  const ambiente = base.ambiente ?? DEFAULT_AMBIENTE;
  if (!(ambiente in TP_AMB)) throw new EventoInvalidoError('ambiente', 'ambiente deve ser "restrita" ou "producao".');
  const chave = requireChave(base.chaveAcesso, 'chaveAcesso');
  const id = buildPedRegEventoId(chave, tpEvento);

  const infPedReg = el(
    'infPedReg',
    [
      requiredTextEl('tpAmb', TP_AMB[ambiente]),
      requiredTextEl('verAplic', base.verAplic ?? VER_APLIC),
      requiredTextEl('dhEvento', base.dhEvento ?? nowSaoPauloOffset()),
      buildAutor(base.autor),
      requiredTextEl('chNFSe', chave),
      eventoXml,
    ].join(''),
    { Id: id },
  );

  return {
    id,
    xml: el('pedRegEvento', infPedReg, { versao: VERSAO, xmlns: NS }),
    tpEvento,
    chaveAcesso: chave,
    ambiente,
  };
}

/** Monta o pedido de registro do evento e101101 (Cancelamento de NFS-e). Nao assina. */
export function buildCancelamentoFromJson(input: CancelamentoNfseInput): BuiltPedRegEvento {
  if (!Object.values(MOTIVO_CANCELAMENTO).includes(input.cMotivo)) {
    throw new EventoInvalidoError('cMotivo', 'cMotivo do cancelamento deve ser 1 (Erro na Emissao), 2 (Servico nao Prestado) ou 9 (Outros).');
  }
  const evento = el(
    'e101101',
    [
      requiredTextEl('xDesc', 'Cancelamento de NFS-e'),
      requiredTextEl('cMotivo', input.cMotivo),
      requiredTextEl('xMotivo', requireMotivo(input.xMotivo, 'xMotivo')),
    ].join(''),
  );
  return buildPedRegEvento(input, TP_EVENTO.cancelamento, evento);
}

/** Monta o pedido de registro do evento e105102 (Cancelamento de NFS-e por Substituicao). Nao assina. */
export function buildCancelamentoPorSubstituicaoFromJson(input: CancelamentoPorSubstituicaoInput): BuiltPedRegEvento {
  if (!Object.values(MOTIVO_SUBSTITUICAO).includes(input.cMotivo)) {
    throw new EventoInvalidoError('cMotivo', 'cMotivo do cancelamento por substituicao deve ser 01, 02, 03, 04, 05 ou 99.');
  }
  const chave = requireChave(input.chaveAcesso, 'chaveAcesso');
  const substituta = requireChave(input.chaveSubstituta, 'chaveSubstituta');
  if (substituta === chave) {
    throw new EventoInvalidoError('chaveSubstituta', 'chaveSubstituta deve ser diferente da chave da NFS-e cancelada.');
  }
  const evento = el(
    'e105102',
    [
      requiredTextEl('xDesc', 'Cancelamento de NFS-e por Substituição'),
      requiredTextEl('cMotivo', input.cMotivo),
      input.xMotivo != null ? textEl('xMotivo', requireMotivo(input.xMotivo, 'xMotivo')) : '',
      requiredTextEl('chSubstituta', substituta),
    ].join(''),
  );
  return buildPedRegEvento(input, TP_EVENTO.cancelamentoPorSubstituicao, evento);
}
