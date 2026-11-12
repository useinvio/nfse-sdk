/**
 * Model Context Protocol server for the NFS-e Nacional, over stdio.
 *
 * A tools-only MCP server needs nothing beyond JSON-RPC 2.0 over newline-delimited
 * stdin/stdout, so this module has no dependencies besides the SDK itself.
 * Run it with `npx -y @useinvio/nfse-mcp` (or `npx -y -p @useinvio/nfse-sdk nfse-mcp`).
 *
 * Configuration comes from the host environment, never from the model:
 *   NFSE_CERT_PATH / NFSE_CERT_BASE64 + NFSE_CERT_PASSWORD / NFSE_CERT_PASSWORD_FILE
 *   NFSE_AMBIENTE=restrita|producao      (default: restrita)
 *   NFSE_MCP_ALLOW_WRITE=1               (enables prepare/confirm emission and cancellation)
 *   NFSE_MCP_MOCK=1                      (in-process mock SEFIN and a test certificate; no real calls)
 */
import { createInterface } from 'node:readline';
import { createNfseAgentToolkit, type NfseAgentContext, type NfseAgentTool } from './agent.js';
import { NfseCertificate, type CertificateInput } from './certificate.js';
import type { Ambiente } from './config.js';

export const NFSE_MCP_ENV = {
  ambiente: 'NFSE_AMBIENTE',
  allowWrite: 'NFSE_MCP_ALLOW_WRITE',
  mock: 'NFSE_MCP_MOCK',
} as const;

const SUPPORTED_PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'] as const;
const SERVER_INFO = { name: 'nfse-nacional', title: 'NFS-e Nacional (SEFIN)', version: '0.1.0' };

export interface NfseMcpServerOptions {
  certificate?: CertificateInput;
  ambiente?: Ambiente;
  allowWrite?: boolean;
  /** Written to stderr by the stdio runner; defaults to no logging. */
  log?: (message: string) => void;
}

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, any>;
}

type JsonRpcResponse =
  | { jsonrpc: '2.0'; id: string | number | null; result: unknown }
  | { jsonrpc: '2.0'; id: string | number | null; error: { code: number; message: string } };

const INSTRUCTIONS = [
  'Ferramentas para a NFS-e Nacional (SEFIN). O ambiente e o certificado sao definidos pelo host.',
  'Antes de emitir, use validate_dps ate valid=true. Nao invente codigos fiscais (cTribNac, regime, tributacao): pergunte ao usuario.',
  'Emissao e cancelamento tem duas etapas: prepare_* devolve um resumo; mostre-o e so chame confirm_* apos aprovacao explicita do usuario.',
  'Depois de uma rejeicao, use explain_rejection com os codigos para explicar a regra oficial ao usuario.',
  'Depois de timeout na emissao, nunca prepare uma nova DPS: repita confirm_nfse_emission ou use recover_nfse_by_dps.',
].join('\n');

function toolDescriptor(tool: NfseAgentTool, protocolVersion: string) {
  const modern = protocolVersion >= '2025-06-18';
  return {
    name: tool.name,
    ...(modern ? { title: tool.title } : {}),
    description: tool.description,
    inputSchema: tool.inputSchema,
    ...(modern ? { outputSchema: tool.outputSchema } : {}),
    annotations: { title: tool.title, ...tool.annotations },
  };
}

/**
 * Transport-independent MCP server. `handle` takes one parsed JSON-RPC message
 * and returns the response, or `undefined` for notifications.
 */
export function createNfseMcpServer(options: NfseMcpServerOptions = {}) {
  const { tools } = createNfseAgentToolkit({ allowWrite: options.allowWrite });
  const context: NfseAgentContext = { pfx: options.certificate, ambiente: options.ambiente ?? 'restrita' };
  let protocolVersion: string = SUPPORTED_PROTOCOL_VERSIONS[0];

  async function callTool(params: Record<string, any> | undefined) {
    const tool = tools.find((t) => t.name === params?.name);
    if (!tool) {
      return { content: [{ type: 'text', text: `Ferramenta desconhecida: ${String(params?.name)}` }], isError: true };
    }
    try {
      const output = await tool.run(params?.arguments ?? {}, context);
      const failed = (output as { ok?: unknown })?.ok === false;
      return {
        content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
        ...(protocolVersion >= '2025-06-18' ? { structuredContent: output } : {}),
        ...(failed ? { isError: true } : {}),
      };
    } catch (error) {
      options.log?.(`tool ${tool.name} failed: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
      return {
        content: [{ type: 'text', text: `Falha de infraestrutura em ${tool.name}: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  }

  async function handle(message: JsonRpcRequest): Promise<JsonRpcResponse | undefined> {
    const isRequest = message.id !== undefined && message.id !== null;
    const reply = (result: unknown): JsonRpcResponse => ({ jsonrpc: '2.0', id: message.id ?? null, result });
    const fail = (code: number, text: string): JsonRpcResponse => ({ jsonrpc: '2.0', id: message.id ?? null, error: { code, message: text } });

    switch (message.method) {
      case 'initialize': {
        const requested = String(message.params?.protocolVersion ?? '');
        protocolVersion = (SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(requested) ? requested : SUPPORTED_PROTOCOL_VERSIONS[0];
        return reply({
          protocolVersion,
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions: INSTRUCTIONS,
        });
      }
      case 'ping':
        return reply({});
      case 'tools/list':
        return reply({ tools: tools.map((tool) => toolDescriptor(tool, protocolVersion)) });
      case 'tools/call':
        return reply(await callTool(message.params));
      default:
        if (!isRequest) return undefined; // notifications/initialized, notifications/cancelled, ...
        return fail(-32601, `Method not found: ${message.method}`);
    }
  }

  return { handle, tools, context };
}

function truthy(value: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase());
}

/** Reads server options from environment variables; see the module comment. */
export async function nfseMcpOptionsFromEnv(env: NodeJS.ProcessEnv = process.env): Promise<NfseMcpServerOptions & { mock: boolean }> {
  const mock = truthy(env[NFSE_MCP_ENV.mock]);
  const ambiente = (env[NFSE_MCP_ENV.ambiente] ?? 'restrita').trim().toLowerCase();
  if (ambiente !== 'restrita' && ambiente !== 'producao') {
    throw new Error(`${NFSE_MCP_ENV.ambiente} deve ser "restrita" ou "producao" (recebido "${ambiente}").`);
  }
  if (mock && ambiente === 'producao') throw new Error(`${NFSE_MCP_ENV.mock}=1 nao pode ser usado com ${NFSE_MCP_ENV.ambiente}=producao.`);
  const hasCertificate = Boolean(env.NFSE_CERT_PATH || env.NFSE_CERT_BASE64);
  let certificate: CertificateInput | undefined = hasCertificate ? NfseCertificate.fromEnv(env) : undefined;
  if (mock) {
    const { createTestCertificate, installMockSefin } = await import('./testing.js');
    installMockSefin();
    certificate ??= createTestCertificate().certificate;
  }
  return { certificate, ambiente, allowWrite: truthy(env[NFSE_MCP_ENV.allowWrite]), mock };
}

/** Runs the server on stdin/stdout until stdin closes. Logs go to stderr only. */
export async function runNfseMcpStdio(options?: NfseMcpServerOptions): Promise<void> {
  const log = (message: string) => process.stderr.write(`[nfse-mcp] ${message}\n`);
  const resolved = options ?? await nfseMcpOptionsFromEnv();
  const server = createNfseMcpServer({ ...resolved, log });
  const certificate = resolved.certificate instanceof NfseCertificate ? resolved.certificate : undefined;
  log(`ambiente=${resolved.ambiente ?? 'restrita'} escrita=${resolved.allowWrite ? 'habilitada' : 'desabilitada'} `
    + `certificado=${certificate ? `${certificate.cnpj ?? certificate.cpf ?? 'sem documento'} (vence ${certificate.notAfter.toISOString().slice(0, 10)})` : resolved.certificate ? 'legado' : 'ausente'}`
    + `${(resolved as { mock?: boolean }).mock ? ' mock=SEFIN simulada' : ''}`);

  const write = (response: JsonRpcResponse) => process.stdout.write(`${JSON.stringify(response)}\n`);
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
  const inflight = new Set<Promise<void>>();
  for await (const line of lines) {
    if (!line.trim()) continue;
    let message: JsonRpcRequest | JsonRpcRequest[];
    try {
      message = JSON.parse(line);
    } catch {
      write({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
      continue;
    }
    for (const item of Array.isArray(message) ? message : [message]) {
      if (!item || typeof item.method !== 'string') continue; // responses from the client are not expected
      const task = server.handle(item).then(
        (response) => { if (response) write(response); },
        (error) => {
          log(`request failed: ${error instanceof Error ? error.message : String(error)}`);
          if (item.id !== undefined && item.id !== null) write({ jsonrpc: '2.0', id: item.id, error: { code: -32603, message: 'Internal error' } });
        },
      ).finally(() => inflight.delete(task));
      inflight.add(task);
    }
  }
  await Promise.all(inflight);
}
