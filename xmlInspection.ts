import { DOMParser } from '@xmldom/xmldom';
import { execFileSync } from 'node:child_process';
import type { Ambiente } from './config.js';
import { XmllintUnavailableError } from './xsdValidation.js';

const NS = 'http://www.sped.fazenda.gov.br/nfse';

export function parseNfseXml(xml: string, rootName: 'DPS' | 'NFSe'): Element {
  const errors: string[] = [];
  const doc = new DOMParser({ errorHandler: (level, message) => errors.push(`${level}: ${message}`) }).parseFromString(xml, 'application/xml');
  const roots = Array.from(doc.childNodes).filter((node) => node.nodeType === 1);
  const strayText = Array.from(doc.childNodes).some((node) => node.nodeType === 3 && node.textContent?.trim());
  const root = doc.documentElement;
  if (errors.length || doc.doctype || strayText || roots.length !== 1 || root?.localName !== rootName || root.namespaceURI !== NS) {
    throw new Error(`XML ${rootName} invalido: documento malformado, raiz ou namespace inesperado.`);
  }
  // xmldom recovers silently from some malformed XML (e.g. unescaped '&').
  // Use the existing XML runtime for strict syntax checking, without fetching DTDs.
  try {
    execFileSync('xmllint', ['--noout', '--nonet', '-'], {
      input: xml, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (error) {
    const failure = error as { status?: number; code?: string };
    if (failure.status === 1) throw new Error(`XML ${rootName} invalido: documento malformado.`);
    throw new XmllintUnavailableError(`Falha ao verificar XML ${rootName} com xmllint (${failure.code ?? failure.status ?? 'desconhecida'}).`, error);
  }
  return root;
}

export function directChildren(element: Element, name: string): Element[] {
  return Array.from(element.childNodes).filter((node): node is Element =>
    node.nodeType === 1 && (node as Element).localName === name && (node as Element).namespaceURI === NS);
}

export function dpsEnvironment(xml: string): Ambiente {
  const root = parseNfseXml(xml, 'DPS');
  const info = directChildren(root, 'infDPS');
  const fields = info.length === 1 ? directChildren(info[0], 'tpAmb') : [];
  const value = fields.length === 1 ? fields[0].textContent : undefined;
  if (value !== '1' && value !== '2') throw new Error('XML da DPS deve informar um unico tpAmb valido (1 ou 2).');
  return value === '1' ? 'producao' : 'restrita';
}

export function assertEnvironment(actual: Ambiente, expected: Ambiente): void {
  if (actual !== expected) throw new Error('Ambiente do XML da DPS difere do ambiente de transmissao.');
}

export function authorizedAccessKey(xml: string, body: Record<string, unknown>): string {
  const root = parseNfseXml(xml, 'NFSe');
  const info = directChildren(root, 'infNFSe');
  if (info.length > 1) throw new Error('Resposta contem multiplos elementos infNFSe.');
  const id = info[0]?.getAttribute('Id') || undefined;
  if (id !== undefined && !/^NFS\d{50}$/.test(id)) throw new Error('Identificador da NFS-e invalido.');
  const candidates = [body.chaveAcesso, body.ChaveAcesso, id?.slice(3)].filter((value) => value !== undefined);
  if (!candidates.length || candidates.some((value) => typeof value !== 'string' || !/^\d{50}$/.test(value))) {
    throw new Error('Resposta de autorizacao sem chave de acesso valida de 50 digitos.');
  }
  if (new Set(candidates).size !== 1) throw new Error('Chaves de acesso divergentes no corpo e/ou XML da resposta.');
  return candidates[0] as string;
}
