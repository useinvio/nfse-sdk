import assert from 'node:assert/strict';
import test from 'node:test';
import { checkJsonSchema } from '../jsonSchemaCheck.js';
import { createNfseAgentToolkit, explainRejectionTool, nfseAgentTools, recoverNfseByDpsTool, toAgentIssues, type NfseAgentTool } from '../agent.js';
import { EmitirNotaError } from '../index.js';
import { createTestCertificate, installMockSefin } from '../testing.js';
import { invoice } from './fixtures.js';

const { certificate } = createTestCertificate({ cnpj: '12345678000195' });
const context = { pfx: certificate, ambiente: 'restrita' as const };

function request(nDPS: string) {
  const { ambiente: _ambiente, ...rest } = invoice();
  return { ...rest, emissao: { ...rest.emissao, nDPS } };
}

function tool(tools: readonly NfseAgentTool[], name: string): NfseAgentTool {
  const found = tools.find((t) => t.name === name);
  assert.ok(found, `missing tool ${name}`);
  return found;
}

test('write tools are absent unless the host enables them', () => {
  assert.deepEqual(createNfseAgentToolkit().tools.map((t) => t.name), nfseAgentTools.map((t) => t.name));
  const names = createNfseAgentToolkit({ allowWrite: true }).tools.map((t) => t.name);
  assert.ok(names.includes('prepare_nfse_emission') && names.includes('confirm_nfse_cancellation'));
  for (const t of createNfseAgentToolkit({ allowWrite: true }).tools) {
    assert.equal(t.annotations.destructiveHint, t.name.startsWith('confirm_'), `${t.name} destructiveHint`);
    assert.equal(t.inputSchema.type, 'object');
  }
});

test('explain_rejection returns official text and flags unknown codes', async () => {
  const { explicacoes } = await explainRejectionTool.run({ codigos: ['E0014', '0014', 'E9999'] });
  assert.equal(explicacoes[0].conhecida, true);
  assert.match(explicacoes[0].mensagemOficial!, /Série, Número/);
  assert.equal(explicacoes[1].codigo, 'E0014');
  assert.equal(explicacoes[2].conhecida, false);
  assert.deepEqual(checkJsonSchema(explainRejectionTool.inputSchema, { codigos: ['E0014'] }), []);
});

test('SEFIN issues carry the official rule as a suggestion', () => {
  const [issue] = toAgentIssues(new EmitirNotaError('x', 400, [{ Codigo: 'E0014', Descricao: 'duplicada' }], 'DPS', {}))!;
  assert.match(issue.suggestion ?? '', /^Campo: .*serie\. Regra oficial:/);
});

test('emission needs prepare, then confirm, and the id is single use', async (t) => {
  const mock = installMockSefin();
  t.after(() => mock.restore());
  const { tools, pendingCount } = createNfseAgentToolkit({ allowWrite: true });

  const prepared = await tool(tools, 'prepare_nfse_emission').run({ request: request('201') }, context);
  assert.equal(prepared.ok, true, JSON.stringify(prepared));
  assert.equal(mock.notas.size, 0, 'prepare must not transmit');
  assert.equal((prepared.resumo as any).prestador, '12345678000195');
  assert.match(String(prepared.instrucoes), /aprovacao explicita/);
  assert.equal(pendingCount(), 1);

  const confirmed = await tool(tools, 'confirm_nfse_emission').run({ confirmationId: prepared.confirmationId }, context);
  assert.equal(confirmed.ok, true);
  assert.equal(mock.notas.size, 1);

  const again = await tool(tools, 'confirm_nfse_emission').run({ confirmationId: prepared.confirmationId }, context);
  assert.equal(again.ok, false);
  assert.equal((again.issues as any)[0].code, 'CONFIRMATION_NOT_FOUND');
  assert.equal(mock.notas.size, 1);
});

test('a dropped confirmation is recovered on retry instead of emitting twice', async (t) => {
  const mock = installMockSefin();
  t.after(() => mock.restore());
  const { tools } = createNfseAgentToolkit({ allowWrite: true });
  const prepared = await tool(tools, 'prepare_nfse_emission').run({ request: request('202') }, context);

  mock.dropResponseNext();
  const first = await tool(tools, 'confirm_nfse_emission').run({ confirmationId: prepared.confirmationId }, context);
  assert.equal(first.ok, false);
  assert.equal(first.resultadoIncerto, true);

  const second = await tool(tools, 'confirm_nfse_emission').run({ confirmationId: prepared.confirmationId }, context);
  assert.equal(second.ok, true);
  assert.equal(second.recuperada, true);
  assert.equal(mock.notas.size, 1, 'exactly one NFS-e');
  assert.equal(mock.requests.filter((r) => r.method === 'POST').length, 1, 'the DPS was sent once');
});

test('cancellation shows the invoice first and only cancels on confirm', async (t) => {
  const mock = installMockSefin();
  t.after(() => mock.restore());
  const { tools } = createNfseAgentToolkit({ allowWrite: true });
  const emitted = await tool(tools, 'prepare_nfse_emission').run({ request: request('203') }, context);
  const { chaveAcesso } = await tool(tools, 'confirm_nfse_emission').run({ confirmationId: emitted.confirmationId }, context) as any;

  const prepared = await tool(tools, 'prepare_nfse_cancellation').run({ chaveAcesso, cMotivo: '1', xMotivo: 'Nota emitida com valor incorreto' }, context);
  assert.equal(prepared.ok, true, JSON.stringify(prepared));
  assert.equal((prepared.nota as any).chaveAcesso, chaveAcesso);
  assert.equal(mock.notas.get(chaveAcesso)?.cancelada, false);

  const confirmed = await tool(tools, 'confirm_nfse_cancellation').run({ confirmationId: prepared.confirmationId }, context);
  assert.equal(confirmed.ok, true);
  assert.equal(mock.notas.get(chaveAcesso)?.cancelada, true);

  const missing = await tool(tools, 'prepare_nfse_cancellation').run({ chaveAcesso: '9'.repeat(50), cMotivo: '1', xMotivo: 'Nota emitida com valor incorreto' }, context);
  assert.equal(missing.ok, false);
});

test('recover_nfse_by_dps distinguishes processed and unknown DPS', async (t) => {
  const mock = installMockSefin();
  t.after(() => mock.restore());
  const { tools } = createNfseAgentToolkit({ allowWrite: true });
  const prepared = await tool(tools, 'prepare_nfse_emission').run({ request: request('204') }, context);
  const dpsId = (prepared.resumo as any).dpsId as string;
  assert.equal((await recoverNfseByDpsTool.run({ dpsId }, context)).encontrada, false);
  await tool(tools, 'confirm_nfse_emission').run({ confirmationId: prepared.confirmationId }, context);
  const found = await recoverNfseByDpsTool.run({ dpsId }, context);
  assert.equal(found.encontrada, true);
  assert.equal(found.resumo?.dps.id, dpsId);
});
