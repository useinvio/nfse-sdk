import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDpsXmlTool,
  getNfseTool,
  nfseAgentTools,
  toAgentIssues,
  validateDpsTool,
  type NfseAgentTool,
} from '../agent.js';
import { CertificateValidationError, EmitirNotaError, gzipBase64 } from '../index.js';
import { checkJsonSchema } from '../jsonSchemaCheck.js';
import { certificate, invoice } from './fixtures.js';
import { mockHttps } from './httpsMock.js';

function agentRequest(kind: 'national' | 'export' = 'national') {
  const { ambiente: _ambiente, ...request } = invoice(kind);
  return request;
}

function assertOutput(tool: NfseAgentTool, output: unknown) {
  assert.deepEqual(checkJsonSchema(tool.outputSchema, output), [], `${tool.name} output does not match its outputSchema`);
}

const CHAVE = '1'.repeat(50);

test('agent tools have unique names and portable schemas', () => {
  assert.deepEqual(nfseAgentTools.map(({ name }) => name), ['validate_dps', 'build_dps_xml', 'get_nfse']);
  for (const tool of nfseAgentTools) {
    assert.equal(tool.inputSchema.type, 'object');
    assert.equal(tool.outputSchema.type, 'object');
    assert.equal(tool.annotations.destructiveHint, false);
  }
  assert.deepEqual(checkJsonSchema(validateDpsTool.inputSchema, { request: agentRequest('export') }), []);
  assert.deepEqual(checkJsonSchema(getNfseTool.inputSchema, { chaveAcesso: CHAVE }), []);
  assert.notDeepEqual(checkJsonSchema(validateDpsTool.inputSchema, { request: invoice() }), [], 'ambiente must not be tool input');
});

test('validate_dps accepts the example payloads in the host environment', async () => {
  for (const kind of ['national', 'export'] as const) {
    const output = await validateDpsTool.run({ request: agentRequest(kind) });
    assertOutput(validateDpsTool, output);
    assert.equal(output.valid, true, JSON.stringify(output.issues));
    assert.equal(output.ambiente, 'restrita');
  }
});

test('validate_dps reports fiscal issues and unsupported fields in one shape', async () => {
  const request = agentRequest() as any;
  delete request.emissao.totTrib;
  request.emissao.tributacaoMunicipal.aliquota = '5.00';
  const output = await validateDpsTool.run({ request });
  assertOutput(validateDpsTool, output);
  assert.equal(output.valid, false);
  const codes = output.issues.map(({ code, path, source }) => [code, path, source]);
  assert.deepEqual(codes.find(([code]) => code === 'UNSUPPORTED_FIELD'), ['UNSUPPORTED_FIELD', 'tributacaoMunicipal.aliquota', 'schema']);
  assert.deepEqual(codes.find(([code]) => code === 'TOT_TRIB_REQUIRED'), ['TOT_TRIB_REQUIRED', 'totTrib', 'sdk']);
});

test('validate_dps reports malformed input without throwing', async () => {
  const output = await validateDpsTool.run({ request: 'not an object' } as any);
  assertOutput(validateDpsTool, output);
  assert.equal(output.valid, false);
  assert.equal(output.issues[0].code, 'INVALID_STRUCTURE');
});

test('the host, not the request, decides the environment', async () => {
  const request = { ...agentRequest(), ambiente: 'producao' } as any;
  const blocked = await validateDpsTool.run({ request });
  assert.deepEqual(blocked.issues.map(({ code }) => code), ['AMBIENTE_NOT_ALLOWED']);

  const allowed = await validateDpsTool.run({ request }, { ambiente: 'producao' });
  assert.equal(allowed.valid, true);
  assert.equal(allowed.ambiente, 'producao');
});

test('build_dps_xml returns XSD-valid XML for the host environment', async () => {
  const restrita = await buildDpsXmlTool.run({ request: agentRequest() });
  assertOutput(buildDpsXmlTool, restrita);
  assert.equal(restrita.ok, true);
  assert.equal(restrita.dpsId?.length, 45);
  assert.match(restrita.xml!, /<tpAmb>2<\/tpAmb>/);

  const producao = await buildDpsXmlTool.run({ request: agentRequest() }, { ambiente: 'producao' });
  assert.match(producao.xml!, /<tpAmb>1<\/tpAmb>/);
});

test('build_dps_xml returns issues instead of XML for invalid requests', async () => {
  const request = agentRequest() as any;
  request.prestador.opSimpNac = '9';
  const output = await buildDpsXmlTool.run({ request });
  assertOutput(buildDpsXmlTool, output);
  assert.equal(output.ok, false);
  assert.equal(output.xml, undefined);
  assert.ok(output.issues.some(({ path }) => path === 'prestador.opSimpNac'));
});

test('get_nfse requires a host certificate and a 50-digit key', async () => {
  const missingCert = await getNfseTool.run({ chaveAcesso: CHAVE });
  assertOutput(getNfseTool, missingCert);
  assert.equal(missingCert.issues[0].code, 'CERTIFICATE_REQUIRED');

  const badKey = await getNfseTool.run({ chaveAcesso: '123' }, { pfx: certificate() });
  assert.equal(badKey.issues[0].code, 'CHAVE_ACESSO_INVALID_FORMAT');
});

test('get_nfse decodes the NFS-e XML and maps SEFIN errors', async (t) => {
  const pfx = certificate();
  const calls = mockHttps(t, { chaveAcesso: CHAVE, nfseXmlGZipB64: gzipBase64('<NFSe/>') });
  const found = await getNfseTool.run({ chaveAcesso: CHAVE }, { pfx });
  assertOutput(getNfseTool, found);
  assert.equal(found.ok, true);
  assert.equal(found.nfseXml, '<NFSe/>');
  assert.deepEqual(found.body, { chaveAcesso: CHAVE });
  assert.match(String(calls[0].options.hostname), /producaorestrita/);

  t.mock.restoreAll();
  mockHttps(t, { erros: [{ Codigo: 'E404', Descricao: 'NFS-e nao encontrada' }] }, 404);
  const missing = await getNfseTool.run({ chaveAcesso: CHAVE }, { pfx });
  assertOutput(getNfseTool, missing);
  assert.equal(missing.ok, false);
  assert.deepEqual(missing.issues.map(({ code, source }) => [code, source]), [['E404', 'sefin']]);
});

test('toAgentIssues maps known SDK errors and leaves the rest to the caller', () => {
  assert.deepEqual(toAgentIssues(new CertificateValidationError('CERTIFICATE_EXPIRED', 'expirado')), [
    { code: 'CERTIFICATE_EXPIRED', path: '$', severity: 'error', source: 'certificate', message: 'expirado' },
  ]);

  const ambiguous = toAgentIssues(new EmitirNotaError('x', 200, [{ Codigo: 'INVALID_AUTHORIZATION_RESPONSE', Descricao: 'XML ausente' }], 'DPS1', {}));
  assert.equal(ambiguous?.[0].source, 'sdk');
  assert.ok(ambiguous?.[0].suggestion);

  const rejected = toAgentIssues(new EmitirNotaError('x', 400, [{ Codigo: 'E0001', Descricao: 'Rejeicao', Complemento: 'campo' }], 'DPS1', {}));
  assert.deepEqual(rejected, [{ code: 'E0001', path: '$', severity: 'error', source: 'sefin', message: 'Rejeicao (campo)' }]);

  assert.equal(toAgentIssues(new Error('ECONNRESET')), undefined);
});
