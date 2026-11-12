import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createNfseMcpServer, nfseMcpOptionsFromEnv } from '../mcpServer.js';
import { invoice } from './fixtures.js';

function request(nDPS: string) {
  const { ambiente: _ambiente, ...rest } = invoice();
  return { ...rest, emissao: { ...rest.emissao, nDPS } };
}

test('MCP handler negotiates the protocol and ignores notifications', async () => {
  const server = createNfseMcpServer();
  const init = await server.handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } } });
  assert.deepEqual((init as any).result.protocolVersion, '2025-06-18');
  assert.match((init as any).result.instructions, /aprovacao explicita/);
  const old = await createNfseMcpServer().handle({ jsonrpc: '2.0', id: 2, method: 'initialize', params: { protocolVersion: '1999-01-01' } });
  assert.equal((old as any).result.protocolVersion, '2025-11-25');
  assert.equal(await server.handle({ jsonrpc: '2.0', method: 'notifications/initialized' }), undefined);
  assert.equal((await server.handle({ jsonrpc: '2.0', id: 3, method: 'resources/list' }) as any).error.code, -32601);
  const list = await server.handle({ jsonrpc: '2.0', id: 4, method: 'tools/list' });
  assert.ok(!(list as any).result.tools.some((t: any) => t.name.startsWith('confirm_')), 'write tools are off by default');
});

test('environment config refuses mock in production and starts without a certificate', async () => {
  await assert.rejects(nfseMcpOptionsFromEnv({ NFSE_MCP_MOCK: '1', NFSE_AMBIENTE: 'producao' }), /nao pode ser usado/);
  await assert.rejects(nfseMcpOptionsFromEnv({ NFSE_AMBIENTE: 'prod' }), /restrita/);
  const options = await nfseMcpOptionsFromEnv({});
  assert.equal(options.certificate, undefined);
  assert.equal(options.allowWrite, false);
});

test('official MCP client drives the stdio server through a full mock emission', { timeout: 60_000 }, async (t) => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [resolve('dist/mcpCli.js')],
    env: { NFSE_MCP_MOCK: '1', NFSE_MCP_ALLOW_WRITE: '1', PATH: process.env.PATH ?? '' },
    stderr: 'pipe',
  });
  const client = new Client({ name: 'nfse-sdk-test', version: '1.0.0' });
  await client.connect(transport);
  t.after(() => client.close());

  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((tool) => tool.name).sort(), [
    'build_dps_xml', 'confirm_nfse_cancellation', 'confirm_nfse_emission', 'explain_rejection', 'get_nfse',
    'prepare_nfse_cancellation', 'prepare_nfse_emission', 'recover_nfse_by_dps', 'validate_dps',
  ]);
  assert.equal(tools.find((tool) => tool.name === 'confirm_nfse_emission')?.annotations?.destructiveHint, true);

  const validated = await client.callTool({ name: 'validate_dps', arguments: { request: request('301') } });
  assert.equal((validated.structuredContent as any).valid, true);

  const prepared = await client.callTool({ name: 'prepare_nfse_emission', arguments: { request: request('301') } });
  const { confirmationId } = prepared.structuredContent as any;
  assert.ok(confirmationId);

  const confirmed = await client.callTool({ name: 'confirm_nfse_emission', arguments: { confirmationId } });
  const { chaveAcesso } = confirmed.structuredContent as any;
  assert.match(chaveAcesso, /^\d{50}$/);

  const fetched = await client.callTool({ name: 'get_nfse', arguments: { chaveAcesso } });
  assert.equal((fetched.structuredContent as any).ok, true);

  const duplicate = await client.callTool({ name: 'prepare_nfse_emission', arguments: { request: request('301') } });
  const rejected = await client.callTool({ name: 'confirm_nfse_emission', arguments: { confirmationId: (duplicate.structuredContent as any).confirmationId } });
  assert.equal(rejected.isError, true);
  assert.equal((rejected.structuredContent as any).issues[0].code, 'E0014');

  const explained = await client.callTool({ name: 'explain_rejection', arguments: { codigos: ['E0014'] } });
  assert.equal((explained.structuredContent as any).explicacoes[0].conhecida, true);

  const invalid = await client.callTool({ name: 'get_nfse', arguments: { chaveAcesso: '123' } });
  assert.equal(invalid.isError, true);
});

test('MCP package, registry metadata and plugin agree on name and version', async () => {
  const { readFileSync } = await import('node:fs');
  const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
  const pkg = read('mcp/package.json');
  const server = read('mcp/server.json');
  const plugin = read('plugin/.claude-plugin/plugin.json');
  const marketplace = read('.claude-plugin/marketplace.json');
  assert.equal(server.name, pkg.mcpName);
  assert.equal(server.version, pkg.version);
  assert.equal(server.packages[0].identifier, pkg.name);
  assert.equal(server.packages[0].version, pkg.version);
  assert.ok(server.description.length <= 100, 'registry description is limited to 100 characters');
  assert.deepEqual(plugin.mcpServers.nfse.args, ['-y', `${pkg.name}@${pkg.version}`]);
  assert.equal(marketplace.plugins[0].name, plugin.name);
  const init = await createNfseMcpServer().handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
  assert.equal((init as any).result.serverInfo.version, pkg.version);
  const sdk = read('package.json');
  assert.ok(pkg.dependencies['@useinvio/nfse-sdk'].startsWith('^'), 'wrapper depends on a published SDK range');
  assert.ok(sdk.exports['./mcp'] && sdk.exports['./testing'] && sdk.bin['nfse-mcp']);
});
