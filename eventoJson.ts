import { DEFAULT_AMBIENTE, TP_AMB } from './config.js';
import { el, requiredTextEl, textEl, onlyDigits, nowOffset } from './xmlBuild.js';
import type { Ambiente } from './config.js';

const NS = 'http://www.sped.fazenda.gov.br/nfse';
const VERSAO = '1.01';
const VER_APLIC = 'UseInvio';

/** Tipos de evento suportados pelo builder (leiaute pedRegEvento v1.01). */
export const TP_EVENTO = {
  cancelamento: '101101',
  cancelamentoPorSubstituicao: '105102',
} as const;

export type TpEvento = (typeof TP_EVENTO)[keyof typeof TP_EVENTO];

export interface AutorEvento {
  /** CNPJ do autor do evento (14 digitos). Informe CNPJ ou CPF, nunca ambos. */
  CNPJ?: string;
  /** CPF do autor do evento (11 digitos). */
  CPF?: string;
}

interface PedRegEventoBase {
  ambiente?: Ambiente;
  /** Chave de acesso da NFS-e (50 digitos). */
  chaveAcesso: string;
  autor: AutorEvento;
  /** Data/hora do evento (AAAA-MM-DDThh:mm:ssTZD). Default: agora. */
  dhEvento?: string;
  verAplic?: string;
}

export interface CancelamentoNfseInput extends PedRegEventoBase {
  /** 1 = Erro na Emissao; 2 = Servico nao Prestado; 9 = Outros. */
  cMotivo: '1' | '2' | '9';
  /** Justificativa com 15 a 255 caracteres. */
  xMotivo: string;
}

export interface CancelamentoPorSubstituicaoInput extends PedRegEventoBase {
  /**
   * 01 = Desenquadramento do Simples Nacional; 02 = Enquadramento no Simples Nacional;
   * 03 = Inclusao Retroativa de Imunidade/Isencao; 04 = Exclusao Retroativa de Imunidade/Isencao;
   * 05 = Rejeicao pelo tomador/intermediario responsavel pelo recolhimento; 99 = Outros.
   */
  cMotivo: '01' | '02' | '03' | '04' | '05' | '99';
  /** Justificativa opcional com 15 a 255 caracteres. */
  xMotivo?: string;
  /** Chave de acesso da NFS-e substituta (50 digitos). */
  chaveSubstituta: string;
}

export interface BuiltPedRegEvento {
  id: string;
  xml: string;
  tpEvento: TpEvento;
  chaveAcesso: string;
  ambiente: Ambiente;
}

function requireChave(value: string, field: string): string {
  const digits = onlyDigits(value ?? '');
  if (digits.length !== 50) {
    throw new Error(`${field} deve ter 50 digitos (recebido ${digits.length})`);
  }
  return digits;
}

function requireMotivo(value: string, field: string): string {
  if (value.length < 15 || value.length > 255) {
    throw new Error(`${field} deve ter entre 15 e 255 caracteres (recebido ${value.length})`);
  }
  return value;
}

function buildAutor(autor: AutorEvento): string {
  const hasCnpj = autor?.CNPJ != null && autor.CNPJ !== '';
  const hasCpf = autor?.CPF != null && autor.CPF !== '';
  if (hasCnpj === hasCpf) {
    throw new Error('autor deve informar exatamente um de: CNPJ, CPF');
  }
  if (hasCnpj) {
    const cnpj = onlyDigits(autor.CNPJ!);
    if (cnpj.length !== 14) throw new Error(`autor.CNPJ deve ter 14 digitos (recebido ${cnpj.length})`);
    return textEl('CNPJAutor', cnpj);
  }
  const cpf = onlyDigits(autor.CPF!);
  if (cpf.length !== 11) throw new Error(`autor.CPF deve ter 11 digitos (recebido ${cpf.length})`);
  return textEl('CPFAutor', cpf);
}

/**
 * Id do pedido de registro de evento conforme o XSD v1.01 (TSIdPedRegEvt):
 * "PRE" + chave de acesso (50) + tipo do evento (6) = PRE[0-9]{56}.
 */
export function buildPedRegEventoId(chaveAcesso: string, tpEvento: TpEvento | string): string {
  const chave = requireChave(chaveAcesso, 'chaveAcesso');
  const tipo = onlyDigits(String(tpEvento)).padStart(6, '0');
  const id = `PRE${chave}${tipo}`;
  if (!/^PRE[0-9]{56}$/.test(id)) {
    throw new Error(`Id do pedido de registro de evento invalido: ${id}`);
  }
  return id;
}

function buildPedRegEvento(
  base: PedRegEventoBase,
  tpEvento: TpEvento,
  eventoXml: string,
): BuiltPedRegEvento {
  const ambiente = base.ambiente ?? DEFAULT_AMBIENTE;
  const chave = requireChave(base.chaveAcesso, 'chaveAcesso');
  const id = buildPedRegEventoId(chave, tpEvento);

  const infPedReg = el(
    'infPedReg',
    [
      requiredTextEl('tpAmb', TP_AMB[ambiente]),
      requiredTextEl('verAplic', base.verAplic ?? VER_APLIC),
      requiredTextEl('dhEvento', base.dhEvento ?? nowOffset()),
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

/** Monta o pedido de registro do evento e101101 (Cancelamento de NFS-e). */
export function buildCancelamentoFromJson(input: CancelamentoNfseInput): BuiltPedRegEvento {
  if (!['1', '2', '9'].includes(input.cMotivo)) {
    throw new Error('cMotivo do cancelamento deve ser 1 (Erro na Emissao), 2 (Servico nao Prestado) ou 9 (Outros)');
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

/** Monta o pedido de registro do evento e105102 (Cancelamento de NFS-e por Substituicao). */
export function buildCancelamentoPorSubstituicaoFromJson(
  input: CancelamentoPorSubstituicaoInput,
): BuiltPedRegEvento {
  if (!['01', '02', '03', '04', '05', '99'].includes(input.cMotivo)) {
    throw new Error('cMotivo do cancelamento por substituicao deve ser 01, 02, 03, 04, 05 ou 99');
  }
  const evento = el(
    'e105102',
    [
      requiredTextEl('xDesc', 'Cancelamento de NFS-e por Substituição'),
      requiredTextEl('cMotivo', input.cMotivo),
      input.xMotivo != null ? textEl('xMotivo', requireMotivo(input.xMotivo, 'xMotivo')) : '',
      requiredTextEl('chSubstituta', requireChave(input.chaveSubstituta, 'chaveSubstituta')),
    ].join(''),
  );
  return buildPedRegEvento(input, TP_EVENTO.cancelamentoPorSubstituicao, evento);
}
