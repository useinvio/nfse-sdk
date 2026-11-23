import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createNfseAgentToolkit, type NfseAgentTool } from '../agent.js';
import {
  buildDpsFromJson,
  buildDpsRequestFromProfile,
  mergeNfseProfile,
  NfseProfileError,
  readNfseProfile,
  validateDpsJsonRequest,
  validateDpsXmlAgainstXsd,
  writeNfseProfile,
  type NfseProfile,
} from '../index.js';
import { nfseMcpOptionsFromEnv } from '../mcpServer.js';
import { createTestCertificate, installMockSefin } from '../testing.js';
import { invoice } from './fixtures.js';

const example = invoice();
const { certificate } = createTestCertificate({ cnpj: '12345678000195' });

function profile(): NfseProfile {
  const { tributacaoMunicipal, tributacaoFederal, totTrib, tomador } = example.emissao;
  return {
    prestador: structuredClone(example.prestador),
    servicos: { desenvolvimento: { ...structuredClone(example.servico), tributacaoMunicipal, tributacaoFederal, totTrib } },
    clientes: { 'Padaria São João': structuredClone(tomador!) },
    ultimoNDPS: 41,
    ultimoNDPSRestrita: 7,
  };
}

function tempDir(t: test.TestContext): string {
  const dir = mkdtempSync(join(tmpdir(), 'nfse-profile-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function tool(tools: readonly NfseAgentTool[], name: string): NfseAgentTool {
  const found = tools.find((t) => t.name === name);
  assert.ok(found, `missing tool ${name}`);
  return found;
}

test('a profile invoice needs only client, service and amount, and passes the XSD', () => {
  const request = buildDpsRequestFromProfile(profile(), { cliente: 'padaria sao joao', valor: '1500' }, 'producao');
  assert.equal(request.ambiente, 'producao');
  assert.equal(request.emissao.nDPS, '42');
  assert.deepEqual(request.emissao.valores, { vServ: '1500.00' });
  assert.equal(request.emissao.tomador?.xNome, example.emissao.tomador?.xNome);
  assert.deepEqual(request.emissao.tributacaoMunicipal, example.emissao.tributacaoMunicipal);
  assert.deepEqual(validateDpsJsonRequest(request).issues, []);
  validateDpsXmlAgainstXsd(buildDpsFromJson(request).xml);
});

test('each environment has its own DPS counter, and amounts are normalized', () => {
  assert.equal(buildDpsRequestFromProfile(profile(), { valor: '10' }, 'restrita').emissao.nDPS, '8');
  assert.equal(buildDpsRequestFromProfile(profile(), { valor: '10', nDPS: '99' }, 'producao').emissao.nDPS, '99');
  for (const [valor, vServ] of [['1500', '1500.00'], ['1500,5', '1500.50'], ['R$ 99,90', '99.90'], ['abc', 'abc']]) {
    assert.equal(buildDpsRequestFromProfile(profile(), { valor }).emissao.valores?.vServ, vServ);
  }
  const custom = buildDpsRequestFromProfile(profile(), { valor: '1', descricao: 'Ajuste no site', competencia: '2026-10-01' });
  assert.equal(custom.servico.xDescServ, 'Ajuste no site');
  assert.equal(custom.emissao.dCompet, '2026-10-01');
});

test('missing pieces are reported by name instead of guessed', () => {
  const expectError = (fn: () => unknown, code: string, pattern: RegExp) =>
    assert.throws(fn, (e) => e instanceof NfseProfileError && e.code === code && pattern.test(e.message));
  expectError(() => buildDpsRequestFromProfile({}, { valor: '1' }), 'PROFILE_INCOMPLETE', /prestador/);
  expectError(() => buildDpsRequestFromProfile(profile(), { valor: '1', cliente: 'acme' }), 'PROFILE_ITEM_NOT_FOUND', /Padaria São João/);
  expectError(() => buildDpsRequestFromProfile(profile(), { valor: '1', servico: 'design' }), 'PROFILE_ITEM_NOT_FOUND', /desenvolvimento/);
  const twoServices = mergeNfseProfile(profile(), { servicos: { suporte: { ...profile().servicos!.desenvolvimento, xDescServ: 'Suporte' } } });
  expectError(() => buildDpsRequestFromProfile(twoServices, { valor: '1' }), 'PROFILE_ITEM_NOT_FOUND', /desenvolvimento, suporte/);
  const { ultimoNDPS: _ignored, ...noCounter } = profile();
  expectError(() => buildDpsRequestFromProfile(noCounter, { valor: '1' }, 'producao'), 'PROFILE_INCOMPLETE', /ultimoNDPS/);
});

test('the profile file is private, atomic and strict about its shape', (t) => {
  const file = join(tempDir(t), 'nested', 'perfil.json');
  assert.deepEqual(readNfseProfile(file), {});
  writeNfseProfile(profile(), file);
  assert.deepEqual(readNfseProfile(file), profile());
  if (process.platform !== 'win32') {
    assert.equal(statSync(file).mode & 0o777, 0o600);
    assert.equal(statSync(join(file, '..')).mode & 0o777, 0o700);
  }
  writeFileSync(file, '{ not json');
  assert.throws(() => readNfseProfile(file), (e) => e instanceof NfseProfileError && e.code === 'PROFILE_INVALID');
  writeFileSync(file, JSON.stringify({ senha: 'x' }));
  assert.throws(() => readNfseProfile(file), /Campo desconhecido no perfil: senha/);
  assert.throws(() => mergeNfseProfile({}, { servicos: { x: { cTribNac: '010201' } as any } }), /servicos\.x\.xDescServ/);
});

test('merge replaces clients by name ignoring case and accents, and null removes one', () => {
  const updated = mergeNfseProfile(profile(), { clientes: { 'PADARIA SAO JOAO': { CNPJ: '11222333000181', xNome: 'Padaria Nova' } }, prestador: { serie: '900' } });
  assert.deepEqual(Object.keys(updated.clientes!), ['Padaria São João']);
  assert.equal(updated.clientes!['Padaria São João'].xNome, 'Padaria Nova');
  assert.equal(updated.prestador!.serie, '900');
  assert.equal(updated.prestador!.cnpj, example.prestador.cnpj);
  assert.deepEqual(mergeNfseProfile(updated, { clientes: { 'padaria sao joao': null } }).clientes, {});
});

test('profile tools exist only with a host profile path, and emitting from it still needs allowWrite', (t) => {
  const file = join(tempDir(t), 'perfil.json');
  const names = (options: Parameters<typeof createNfseAgentToolkit>[0]) => createNfseAgentToolkit(options).tools.map((x) => x.name);
  assert.ok(!names({ allowWrite: true }).includes('get_nfse_profile'));
  const readOnly = names({ profilePath: file });
  assert.ok(readOnly.includes('get_nfse_profile') && readOnly.includes('update_nfse_profile'));
  assert.ok(!readOnly.includes('prepare_nfse_emission_from_profile') && !readOnly.includes('confirm_nfse_emission'));
  assert.ok(names({ profilePath: file, allowWrite: true }).includes('prepare_nfse_emission_from_profile'));
  for (const x of createNfseAgentToolkit({ profilePath: file, allowWrite: true }).tools) {
    assert.equal(x.annotations.destructiveHint, x.name.startsWith('confirm_'), `${x.name} destructiveHint`);
  }
});

test('a profile is built through the tool, then one short call emits and advances the counter', async (t) => {
  const mock = installMockSefin();
  t.after(() => mock.restore());
  const file = join(tempDir(t), 'perfil.json');
  const { tools } = createNfseAgentToolkit({ allowWrite: true, profilePath: file });
  const context = { pfx: certificate, ambiente: 'restrita' as const };

  const empty = await tool(tools, 'get_nfse_profile').run({}, context);
  assert.equal(empty.pronto, false);
  assert.deepEqual(empty.faltando, ['prestador', 'servicos', 'ultimoNDPSRestrita']);
  assert.equal((empty.certificado as any).documento, '12345678000195');

  const bad = await tool(tools, 'update_nfse_profile').run({ clientes: { x: { CNPJ: '123' } } }, context);
  assert.equal(bad.ok, false);
  const { ultimoNDPS: _prod, ...rest } = profile();
  const saved = await tool(tools, 'update_nfse_profile').run(rest, context);
  assert.equal(saved.ok, true, JSON.stringify(saved));
  assert.equal(saved.pronto, true);
  assert.equal(mock.notas.size, 0, 'profile tools never talk to SEFIN');

  const noValue = await tool(tools, 'prepare_nfse_emission_from_profile').run({ cliente: 'Padaria Sao Joao' }, context);
  assert.equal(noValue.ok, false);
  assert.match((noValue.issues as any)[0].message, /valor e obrigatorio/);
  const unknown = await tool(tools, 'prepare_nfse_emission_from_profile').run({ cliente: 'acme', valor: '1' }, context);
  assert.equal((unknown.issues as any)[0].code, 'PROFILE_ITEM_NOT_FOUND');

  const first = await tool(tools, 'prepare_nfse_emission_from_profile').run({ cliente: 'Padaria Sao Joao', valor: '1500' }, context);
  assert.equal(first.ok, true, JSON.stringify(first));
  assert.equal((first.resumo as any).nDPS, '8');
  assert.equal((first.resumo as any).cliente, 'Padaria Sao Joao');
  assert.equal((first.resumo as any).valorServico, '1500.00');
  const second = await tool(tools, 'prepare_nfse_emission_from_profile').run({ cliente: 'Padaria Sao Joao', valor: '200' }, context);
  assert.equal((second.resumo as any).nDPS, '9', 'a pending emission keeps its number reserved');
  assert.equal(mock.notas.size, 0);

  const confirmed = await tool(tools, 'confirm_nfse_emission').run({ confirmationId: second.confirmationId }, context);
  assert.equal(confirmed.ok, true, JSON.stringify(confirmed));
  assert.deepEqual(confirmed.perfil, { ultimoNDPSRestrita: 9 });
  await tool(tools, 'confirm_nfse_emission').run({ confirmationId: first.confirmationId }, context);
  const stored = JSON.parse(readFileSync(file, 'utf8'));
  assert.equal(stored.ultimoNDPSRestrita, 9, 'the counter never goes back');
  assert.equal(stored.ultimoNDPS, undefined, 'production counter untouched');
  assert.equal(mock.notas.size, 2);
});

test('the MCP server reads the profile path from the environment and isolates mock mode', async () => {
  const real = await nfseMcpOptionsFromEnv({});
  assert.equal(real.profilePath, '~/.config/nfse/perfil.json');
  assert.equal(real.ambiente, 'restrita');
  const mocked = await nfseMcpOptionsFromEnv({ NFSE_MCP_MOCK: 'true' });
  assert.equal(mocked.profilePath, '~/.config/nfse/perfil-teste.json');
  assert.equal((await nfseMcpOptionsFromEnv({ NFSE_PROFILE_PATH: '/x/p.json' })).profilePath, '/x/p.json');
});
