import { directChildren, parseNfseXml } from './xmlInspection.js';
import type { Ambiente } from './config.js';

export interface NfsePessoaResumo {
  CNPJ?: string;
  CPF?: string;
  NIF?: string;
  IM?: string;
  xNome?: string;
}

/** Typed view of the authorized NFS-e fields most integrations need. Values are kept as XML strings. */
export interface NfseResumo {
  chaveAcesso: string;
  /** Numero da NFS-e. */
  nNFSe: string;
  /** Numero do documento fiscal no ADN. */
  nDFSe: string;
  /** Situacao (TStat), ex.: "100" = NFS-e gerada. */
  cStat: string;
  /** Data/hora de processamento (UTC). */
  dhProc: string;
  ambiente: Ambiente;
  xLocEmi: string;
  xLocPrestacao: string;
  cLocIncid?: string;
  xLocIncid?: string;
  xTribNac: string;
  emitente: NfsePessoaResumo;
  tomador?: NfsePessoaResumo;
  dps: {
    id: string;
    serie: string;
    nDPS: string;
    dhEmi: string;
    dCompet: string;
  };
  valores: {
    vServ?: string;
    vBC?: string;
    pAliqAplic?: string;
    vISSQN?: string;
    vTotalRet?: string;
    vLiq: string;
  };
}

function child(element: Element | undefined, ...path: string[]): Element | undefined {
  let current = element;
  for (const name of path) {
    if (!current) return undefined;
    current = directChildren(current, name)[0];
  }
  return current;
}

function text(element: Element | undefined, ...path: string[]): string | undefined {
  const value = child(element, ...path)?.textContent ?? undefined;
  return value === '' ? undefined : value;
}

function required(element: Element | undefined, ...path: string[]): string {
  const value = text(element, ...path);
  if (value === undefined) throw new Error(`XML da NFS-e sem o campo obrigatorio ${path.join('/')}.`);
  return value;
}

function pessoa(element: Element | undefined): NfsePessoaResumo | undefined {
  if (!element) return undefined;
  const result: NfsePessoaResumo = {};
  for (const field of ['CNPJ', 'CPF', 'NIF', 'IM', 'xNome'] as const) {
    const value = text(element, field);
    if (value !== undefined) result[field] = value;
  }
  return result;
}

/**
 * Reads an authorized NFS-e XML (layout v1.01) into a typed summary.
 * The XML is parsed without DTDs, external entities or network access.
 */
export function lerNfse(nfseXml: string): NfseResumo {
  const root = parseNfseXml(nfseXml, 'NFSe');
  const inf = child(root, 'infNFSe');
  const id = inf?.getAttribute('Id') ?? '';
  if (!/^NFS\d{50}$/.test(id)) throw new Error('XML da NFS-e sem Id valido em <infNFSe>.');
  const infDps = child(inf, 'DPS', 'infDPS');
  const tpAmb = required(infDps, 'tpAmb');
  const resumo: NfseResumo = {
    chaveAcesso: id.slice(3),
    nNFSe: required(inf, 'nNFSe'),
    nDFSe: required(inf, 'nDFSe'),
    cStat: required(inf, 'cStat'),
    dhProc: required(inf, 'dhProc'),
    ambiente: tpAmb === '1' ? 'producao' : 'restrita',
    xLocEmi: required(inf, 'xLocEmi'),
    xLocPrestacao: required(inf, 'xLocPrestacao'),
    xTribNac: required(inf, 'xTribNac'),
    emitente: pessoa(child(inf, 'emit'))!,
    dps: {
      id: infDps?.getAttribute('Id') ?? '',
      serie: required(infDps, 'serie'),
      nDPS: required(infDps, 'nDPS'),
      dhEmi: required(infDps, 'dhEmi'),
      dCompet: required(infDps, 'dCompet'),
    },
    valores: {
      vServ: text(infDps, 'valores', 'vServPrest', 'vServ'),
      vBC: text(inf, 'valores', 'vBC'),
      pAliqAplic: text(inf, 'valores', 'pAliqAplic'),
      vISSQN: text(inf, 'valores', 'vISSQN'),
      vTotalRet: text(inf, 'valores', 'vTotalRet'),
      vLiq: required(inf, 'valores', 'vLiq'),
    },
  };
  const cLocIncid = text(inf, 'cLocIncid');
  const xLocIncid = text(inf, 'xLocIncid');
  const tomador = pessoa(child(infDps, 'toma'));
  if (cLocIncid) resumo.cLocIncid = cLocIncid;
  if (xLocIncid) resumo.xLocIncid = xLocIncid;
  if (tomador) resumo.tomador = tomador;
  for (const key of Object.keys(resumo.valores) as Array<keyof NfseResumo['valores']>) {
    if (resumo.valores[key] === undefined) delete resumo.valores[key];
  }
  return resumo;
}
