import https from 'node:https';
import { resolveSefinBaseUrl } from './config.js';
import type { PfxMaterial } from './loadPfx.js';
import type { Ambiente } from './config.js';

export interface SefinErro {
  Codigo: string;
  Descricao: string;
  Complemento?: string;
}

export interface SefinResposta {
  status: number;
  /** Corpo bruto parseado (JSON) */
  body: any;
}

interface SefinRespostaRaw {
  status: number;
  contentType: string;
  buffer: Buffer;
}

interface RequestOpts {
  method: 'GET' | 'POST';
  /** Caminho relativo à base do SefinNacional, ex.: "/nfse" ou "/nfse/<chave>" */
  path: string;
  jsonBody?: unknown;
}

/**
 * Requisição mTLS de baixo nível ao SefinNacional, retornando o corpo bruto (Buffer).
 * Usa key+cert PEM no handshake (o .pfx legado ICP-Brasil é rejeitado pelo TLS do Node).
 */
function sefinRequest(opts: RequestOpts, pfx: PfxMaterial, baseOverride?: string): Promise<SefinRespostaRaw> {
  const url = new URL(`${baseOverride ?? resolveSefinBaseUrl()}${opts.path}`);
  const payload = opts.jsonBody != null ? JSON.stringify(opts.jsonBody) : undefined;

  const headers: Record<string, string | number> = {
    Accept: 'application/json',
  };
  if (payload != null) {
    headers['Content-Type'] = 'application/json';
    headers['Content-Length'] = Buffer.byteLength(payload);
  }

  const options: https.RequestOptions = {
    method: opts.method,
    hostname: url.hostname,
    port: url.port || 443,
    path: url.pathname + url.search,
    headers,
    key: pfx.privateKeyPem,
    cert: pfx.certPem,
    rejectUnauthorized: true,
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () =>
        resolve({
          status: res.statusCode ?? 0,
          contentType: String(res.headers['content-type'] ?? ''),
          buffer: Buffer.concat(chunks),
        }),
      );
    });
    req.on('error', reject);
    if (payload != null) req.write(payload);
    req.end();
  });
}

/** Parseia o corpo como JSON; mantém texto cru se não for JSON (ex.: 403 HTML). */
function parseJson(raw: SefinRespostaRaw): SefinResposta {
  const text = raw.buffer.toString('utf-8');
  try {
    return { status: raw.status, body: text ? JSON.parse(text) : null };
  } catch {
    return { status: raw.status, body: text };
  }
}

/** Normaliza a lista de erros retornada pelo SEFIN em diferentes formatos. */
export function extrairErros(body: any): SefinErro[] {
  if (!body) return [];
  if (Array.isArray(body)) return body;
  if (Array.isArray(body.erros)) return body.erros;
  if (Array.isArray(body.Erros)) return body.Erros;
  if (body.Codigo || body.codigo) {
    return [
      {
        Codigo: body.Codigo ?? body.codigo,
        Descricao: body.Descricao ?? body.descricao ?? body.mensagem ?? '',
      },
    ];
  }
  return [
    { Codigo: 'DESCONHECIDO', Descricao: typeof body === 'string' ? body : JSON.stringify(body) },
  ];
}

/** SefinNacional · POST /nfse — envia a DPS (GZip+Base64). */
export async function enviarDps(dpsXmlGZipB64: string, pfx: PfxMaterial, ambiente?: Ambiente): Promise<SefinResposta> {
  const base = ambiente ? resolveSefinBaseUrl(ambiente) : undefined;
  return parseJson(await sefinRequest({ method: 'POST', path: '/nfse', jsonBody: { dpsXmlGZipB64 } }, pfx, base));
}

/** SefinNacional · GET /nfse/{chave} — consulta a NFS-e pela chave de acesso (50 dígitos). */
export async function consultarNfse(chave: string, pfx: PfxMaterial, ambiente?: Ambiente): Promise<SefinResposta> {
  const base = ambiente ? resolveSefinBaseUrl(ambiente) : undefined;
  return parseJson(await sefinRequest({ method: 'GET', path: `/nfse/${chave}` }, pfx, base));
}

/** SefinNacional · POST /nfse/{chave}/eventos — registra evento fiscal da NFS-e. */
export async function enviarEvento(
  pedRegXmlGZipB64: string,
  pfx: PfxMaterial,
  chaveAcesso: string,
  ambiente?: Ambiente,
): Promise<SefinResposta> {
  const base = ambiente ? resolveSefinBaseUrl(ambiente) : undefined;
  return parseJson(
    await sefinRequest(
      {
        method: 'POST',
        path: `/nfse/${chaveAcesso}/eventos`,
        jsonBody: { pedRegXmlGZipB64 },
      },
      pfx,
      base,
    ),
  );
}
