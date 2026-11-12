import { REJEICOES_FONTES, REJEICOES_OFICIAIS } from './rejeicoesCatalog.js';
import type { SefinErro } from './sefinClient.js';

export { REJEICOES_FONTES } from './rejeicoesCatalog.js';

/** One business rule from the official SEFIN/ADN annexes. Text is kept verbatim. */
export interface RejeicaoOficial {
  /** Error code, e.g. "E0014". */
  codigo: string;
  /** Official error message returned by SEFIN. */
  mensagem: string;
  /** Business rule that triggers the rejection. */
  regra: string;
  /** XML path of the field the rule checks, when the annex names one. */
  campo?: string;
  /** 1 = layout consistency, 2 = national rules, 3 = municipal rules. */
  nivel?: number;
  /** Index into {@link REJEICOES_FONTES}. */
  fonte: number;
  /** Annex sheet the rule comes from. */
  planilha: string;
}

export interface ExplicacaoRejeicao {
  codigo: string;
  /** False when the code is not in the bundled catalog (e.g. a newer rule or an SDK-side code). */
  conhecida: boolean;
  /** What SEFIN said, when explaining a received error. */
  descricaoRecebida?: string;
  complemento?: string;
  mensagemOficial?: string;
  regra?: string;
  campo?: string;
  nivel?: number;
  /** Where to look: official annex and, when known, the SDK documentation. */
  fonte?: { documento: string; url: string };
  /** Short, code-independent hint about what usually fixes this class of rule. */
  dica?: string;
}

const BY_CODE = new Map(REJEICOES_OFICIAIS.map((entry) => [entry.codigo, entry]));

const NIVEL_DICA: Record<number, string> = {
  1: 'Regra de leiaute: corrija o formato ou a consistencia do campo indicado na DPS ou no evento.',
  2: 'Regra nacional: confira o dado com o cadastro e a situacao do contribuinte no Sistema Nacional NFS-e.',
  3: 'Regra municipal: confira os parametros do municipio (convenio, aliquota, regimes) com consultarConvenio/consultarAliquota.',
};

const SDK_CODES: Record<string, string> = {
  INVALID_AUTHORIZATION_RESPONSE: 'A SEFIN respondeu 2xx sem XML autorizado valido. O resultado e incerto: use recuperarNfsePorDps antes de reenviar.',
  INVALID_QUERY_RESPONSE: 'A consulta respondeu sem o XML esperado. Tente novamente; se persistir, registre o corpo da resposta.',
  DESCONHECIDO: 'A SEFIN respondeu sem um codigo de erro reconhecivel. Veja o corpo bruto da resposta.',
};

function normalizeCode(codigo: string): string {
  const trimmed = codigo.trim().toUpperCase();
  return /^\d{4}$/.test(trimmed) ? `E${trimmed}` : trimmed;
}

/** Looks up an official rule by code ("E0014", "e0014" or "0014"). */
export function buscarRejeicao(codigo: string): RejeicaoOficial | undefined {
  return BY_CODE.get(normalizeCode(codigo));
}

/**
 * Explains a SEFIN error code or a received `SefinErro` with the official
 * message, rule and field from the published annexes. Never invents a cause:
 * unknown codes come back with `conhecida: false`.
 */
export function explicarRejeicao(erro: string | SefinErro): ExplicacaoRejeicao {
  const received = typeof erro === 'string' ? undefined : erro;
  const codigo = normalizeCode(typeof erro === 'string' ? erro : erro.Codigo);
  const entry = BY_CODE.get(codigo);
  const result: ExplicacaoRejeicao = { codigo, conhecida: Boolean(entry) };
  if (received?.Descricao) result.descricaoRecebida = received.Descricao;
  if (received?.Complemento) result.complemento = received.Complemento;
  if (entry) {
    result.mensagemOficial = entry.mensagem;
    if (entry.regra) result.regra = entry.regra;
    if (entry.campo) result.campo = entry.campo;
    if (entry.nivel) result.nivel = entry.nivel;
    result.fonte = { ...REJEICOES_FONTES[entry.fonte] };
    const dica = entry.nivel ? NIVEL_DICA[entry.nivel] : undefined;
    if (dica) result.dica = dica;
  } else if (SDK_CODES[codigo]) {
    result.dica = SDK_CODES[codigo];
  }
  return result;
}

/** Explains every error of a rejection (`EmitirNotaError.erros`, `RegistrarEventoError.erros`). */
export function explicarErros(erros: readonly SefinErro[]): ExplicacaoRejeicao[] {
  return erros.map((erro) => explicarRejeicao(erro));
}

/** All bundled official rules, sorted by code. */
export function listarRejeicoes(): readonly RejeicaoOficial[] {
  return REJEICOES_OFICIAIS;
}
