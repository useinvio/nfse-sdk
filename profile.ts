/**
 * Local issuer profile: the provider's data, its usual services (with the tax
 * treatment the user or their accountant chose) and saved clients. With a
 * profile, an emission only needs a client, a service and an amount.
 *
 * Fiscal neutrality: every code in the profile comes from the user. This
 * module never fills a missing tax field; incomplete profiles fail validation
 * like any other request.
 */
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { expandHomePath } from './certificate.js';
import { DEFAULT_AMBIENTE, type Ambiente } from './config.js';
import type { DpsJsonRequest, PrestadorProfile, Tomador, TotTrib, TribFed, TribMun } from './dpsJson.js';

/** Where the MCP server and CLI look for the profile unless told otherwise. */
export const DEFAULT_NFSE_PROFILE_PATH = '~/.config/nfse/perfil.json';

/** A service the provider usually invoices, with the tax treatment chosen for it. */
export interface NfseProfileServico {
  cTribNac: string;
  xDescServ: string;
  cLocPrestacao: string;
  cNBS?: string;
  tributacaoMunicipal?: TribMun;
  tributacaoFederal?: TribFed;
  totTrib?: TotTrib;
}

export interface NfseProfile {
  prestador?: PrestadorProfile;
  /** Services by short name, e.g. `consultoria`. */
  servicos?: Record<string, NfseProfileServico>;
  /** Clients (tomadores) by short name, e.g. `acme`. */
  clientes?: Record<string, Tomador>;
  /** Last DPS number used in production. The next emission uses this plus one. */
  ultimoNDPS?: number;
  /** Same counter for produção restrita, which SEFIN numbers separately. */
  ultimoNDPSRestrita?: number;
}

/** Profile field that holds the DPS counter for an environment. */
export function ultimoNDPSField(ambiente: Ambiente = DEFAULT_AMBIENTE): 'ultimoNDPS' | 'ultimoNDPSRestrita' {
  return ambiente === 'producao' ? 'ultimoNDPS' : 'ultimoNDPSRestrita';
}

export interface NfseProfileInvoiceInput {
  /** Client name in `clientes`. Omit only for invoices without a tomador. */
  cliente?: string;
  /** Service name in `servicos`. Optional when the profile has exactly one service. */
  servico?: string;
  /** Service amount, e.g. `1500.00`. `1500` and `1500,5` are normalized. */
  valor: string;
  /** Competence date `YYYY-MM-DD`. Defaults to the emission date, like `buildDpsFromJson`. */
  competencia?: string;
  /** Replaces the service description for this invoice only. */
  descricao?: string;
  /** DPS number. Defaults to the environment's counter plus one (`ultimoNDPS` or `ultimoNDPSRestrita`). */
  nDPS?: string;
}

export class NfseProfileError extends Error {
  readonly name = 'NfseProfileError';
  constructor(readonly code: 'PROFILE_INVALID' | 'PROFILE_INCOMPLETE' | 'PROFILE_ITEM_NOT_FOUND', message: string, readonly path = '$') {
    super(message);
  }
}

export function resolveNfseProfilePath(path = DEFAULT_NFSE_PROFILE_PATH): string {
  return expandHomePath(path.trim());
}

/** Reads the profile; a missing file is an empty profile. */
export function readNfseProfile(path = DEFAULT_NFSE_PROFILE_PATH): NfseProfile {
  const file = resolveNfseProfilePath(path);
  if (!existsSync(file)) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new NfseProfileError('PROFILE_INVALID', `Perfil em ${file} nao e um JSON valido: ${error instanceof Error ? error.message : String(error)}`);
  }
  return checkProfile(parsed);
}

/**
 * Writes the profile atomically, readable only by the owner (0600, folder 0700).
 * The profile holds client data, not secrets, but it has no business being shared.
 */
export function writeNfseProfile(profile: NfseProfile, path = DEFAULT_NFSE_PROFILE_PATH): void {
  const file = resolveNfseProfilePath(path);
  const dir = dirname(file);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
  const temp = join(dir, `.perfil-${process.pid}-${Date.now()}.tmp`);
  writeFileSync(temp, `${JSON.stringify(checkProfile(profile), null, 2)}\n`, { mode: 0o600 });
  renameSync(temp, file);
  try { chmodSync(file, 0o600); } catch { /* best effort on filesystems without POSIX modes */ }
}

/**
 * Merges a partial update. `prestador` fields are merged, services and clients
 * are replaced by name, and `null` under `servicos` or `clientes` removes one.
 */
export function mergeNfseProfile(base: NfseProfile, patch: NfseProfileUpdate): NfseProfile {
  const merged: NfseProfile = structuredClone(base);
  if (patch.prestador) merged.prestador = { ...merged.prestador, ...patch.prestador } as PrestadorProfile;
  for (const key of ['servicos', 'clientes'] as const) {
    const changes = patch[key];
    if (!changes) continue;
    const current: Record<string, unknown> = { ...merged[key] };
    for (const [name, value] of Object.entries(changes)) {
      const clean = normalizeName(name);
      if (!clean) throw new NfseProfileError('PROFILE_INVALID', `Nome vazio em ${key}.`, key);
      if (value === null) delete current[findKey(current, clean) ?? clean];
      else current[findKey(current, clean) ?? clean] = value;
    }
    (merged as Record<string, unknown>)[key] = current;
  }
  if (patch.ultimoNDPS !== undefined) merged.ultimoNDPS = patch.ultimoNDPS;
  if (patch.ultimoNDPSRestrita !== undefined) merged.ultimoNDPSRestrita = patch.ultimoNDPSRestrita;
  return checkProfile(merged);
}

export interface NfseProfileUpdate {
  prestador?: Partial<PrestadorProfile>;
  servicos?: Record<string, NfseProfileServico | null>;
  clientes?: Record<string, Tomador | null>;
  ultimoNDPS?: number;
  ultimoNDPSRestrita?: number;
}

/**
 * Builds a full `DpsJsonRequest` from the profile. `ambiente` picks the DPS
 * counter and is set on the request. Validate the result before sending.
 */
export function buildDpsRequestFromProfile(profile: NfseProfile, input: NfseProfileInvoiceInput, ambiente: Ambiente = DEFAULT_AMBIENTE): DpsJsonRequest {
  if (!profile.prestador) {
    throw new NfseProfileError('PROFILE_INCOMPLETE', 'O perfil ainda nao tem os dados do prestador.', 'prestador');
  }
  const servicos = profile.servicos ?? {};
  const servicoNome = input.servico ?? (Object.keys(servicos).length === 1 ? Object.keys(servicos)[0] : undefined);
  if (!servicoNome) {
    const nomes = Object.keys(servicos);
    throw new NfseProfileError(
      nomes.length ? 'PROFILE_ITEM_NOT_FOUND' : 'PROFILE_INCOMPLETE',
      nomes.length ? `Informe o servico. Disponiveis: ${nomes.join(', ')}.` : 'O perfil ainda nao tem nenhum servico.',
      'servico',
    );
  }
  const servico = lookup(servicos, servicoNome, 'servico');
  const tomador = input.cliente === undefined ? undefined : lookup(profile.clientes ?? {}, input.cliente, 'cliente');

  let nDPS = input.nDPS?.trim();
  if (!nDPS) {
    const field = ultimoNDPSField(ambiente);
    const ultimo = profile[field];
    if (typeof ultimo !== 'number') {
      throw new NfseProfileError(
        'PROFILE_INCOMPLETE',
        `Informe nDPS ou configure ${field} no perfil: o numero da ultima DPS emitida nessa serie em ${ambiente === 'producao' ? 'producao' : 'producao restrita'} (0 se nunca emitiu).`,
        field,
      );
    }
    nDPS = String(ultimo + 1);
  }

  const { tributacaoMunicipal, tributacaoFederal, totTrib, ...servicoProfile } = servico;
  return {
    ambiente,
    prestador: structuredClone(profile.prestador),
    servico: { ...servicoProfile, ...(input.descricao ? { xDescServ: input.descricao } : {}) },
    emissao: {
      nDPS,
      ...(input.competencia ? { dCompet: input.competencia } : {}),
      valores: { vServ: normalizeValor(input.valor) },
      ...(tomador ? { tomador: structuredClone(tomador) } : {}),
      ...(tributacaoMunicipal ? { tributacaoMunicipal: structuredClone(tributacaoMunicipal) } : {}),
      ...(tributacaoFederal ? { tributacaoFederal: structuredClone(tributacaoFederal) } : {}),
      ...(totTrib ? { totTrib: structuredClone(totTrib) } : {}),
    },
  };
}

/** Short view for an agent: names and identifiers, not full addresses. */
export function summarizeNfseProfile(profile: NfseProfile) {
  const p = profile.prestador;
  return {
    prestador: p ? { documento: p.cnpj ?? p.cpf, serie: p.serie, municipio: p.cLocEmi } : null,
    servicos: Object.entries(profile.servicos ?? {}).map(([nome, s]) => ({ nome, descricao: s.xDescServ, cTribNac: s.cTribNac })),
    clientes: Object.entries(profile.clientes ?? {}).map(([nome, c]) => ({ nome, razaoSocial: c.xNome, documento: c.CNPJ ?? c.CPF ?? c.NIF })),
    ultimoNDPS: profile.ultimoNDPS ?? null,
    ultimoNDPSRestrita: profile.ultimoNDPSRestrita ?? null,
  };
}

function normalizeValor(valor: string): string {
  const text = String(valor).trim().replace(/^R\$\s*/i, '');
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(text);
  if (!match) return text; // left as is, fiscal validation reports it
  return `${match[1]}.${(match[2] ?? '').padEnd(2, '0')}`;
}

function normalizeName(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
}

function findKey(record: Record<string, unknown>, name: string): string | undefined {
  const wanted = normalizeName(name);
  return Object.keys(record).find((key) => normalizeName(key) === wanted);
}

function lookup<T>(record: Record<string, T>, name: string, kind: 'servico' | 'cliente'): T {
  const key = findKey(record, name);
  if (key === undefined) {
    const nomes = Object.keys(record);
    throw new NfseProfileError(
      'PROFILE_ITEM_NOT_FOUND',
      `${kind === 'servico' ? 'Servico' : 'Cliente'} "${name}" nao esta no perfil.${nomes.length ? ` Disponiveis: ${nomes.join(', ')}.` : ''}`,
      kind,
    );
  }
  return record[key];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function checkProfile(value: unknown): NfseProfile {
  if (!isPlainObject(value)) throw new NfseProfileError('PROFILE_INVALID', 'O perfil deve ser um objeto JSON.');
  const allowed = new Set(['prestador', 'servicos', 'clientes', 'ultimoNDPS', 'ultimoNDPSRestrita']);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new NfseProfileError('PROFILE_INVALID', `Campo desconhecido no perfil: ${key}.`, key);
  }
  if (value.prestador !== undefined && !isPlainObject(value.prestador)) {
    throw new NfseProfileError('PROFILE_INVALID', 'prestador deve ser um objeto.', 'prestador');
  }
  for (const key of ['servicos', 'clientes'] as const) {
    const group = value[key];
    if (group === undefined) continue;
    if (!isPlainObject(group)) throw new NfseProfileError('PROFILE_INVALID', `${key} deve ser um objeto com nomes.`, key);
    for (const [name, item] of Object.entries(group)) {
      if (!isPlainObject(item)) throw new NfseProfileError('PROFILE_INVALID', `${key}.${name} deve ser um objeto.`, `${key}.${name}`);
    }
  }
  for (const [name, item] of Object.entries((value.servicos ?? {}) as Record<string, Record<string, unknown>>)) {
    for (const field of ['cTribNac', 'xDescServ', 'cLocPrestacao']) {
      if (typeof item[field] !== 'string' || !item[field]) {
        throw new NfseProfileError('PROFILE_INVALID', `servicos.${name}.${field} e obrigatorio.`, `servicos.${name}.${field}`);
      }
    }
  }
  for (const field of ['ultimoNDPS', 'ultimoNDPSRestrita'] as const) {
    const n = value[field];
    if (n !== undefined && (!Number.isSafeInteger(n) || (n as number) < 0)) {
      throw new NfseProfileError('PROFILE_INVALID', `${field} deve ser um inteiro maior ou igual a zero.`, field);
    }
  }
  return value as NfseProfile;
}

