import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const pluginRoot = resolve(import.meta.dirname, '..');
const validDps = {
  ambiente: 'restrita',
  prestador: { cnpj: '12345678000195', cLocEmi: '4106902', serie: '1601', opSimpNac: '1', regEspTrib: '0' },
  servico: { cTribNac: '010201', xDescServ: 'Servico de teste', cLocPrestacao: '4106902' },
  emissao: {
    nDPS: '1', valores: { vServ: '100.00' },
    tributacaoMunicipal: { tribISSQN: '1', tpRetISSQN: '1' },
    totTrib: { pTotTribFed: '0', pTotTribEst: '0', pTotTribMun: '5' },
  },
};

test('local MCP server exposes certificate-free DPS tools', async () => {
  const transport = new StdioClientTransport({ command: process.execPath, args: ['server/index.js'], cwd: pluginRoot, stderr: 'pipe' });
  const client = new Client({ name: 'nfse-sdk-mcp-test', version: '0.1.0' });
  await client.connect(transport);
  try {
    const listed = await client.listTools();
    assert.deepEqual(listed.tools.map(tool => tool.name), [
      'get_dps_questions', 'validate_dps_json', 'build_dps_xml', 'validate_dps_xml', 'prepare_nfse', 'emit_nfse',
    ]);

    const questions = await client.callTool({ name: 'get_dps_questions', arguments: { dps: {} } });
    const interview = JSON.parse(questions.content[0].text);
    assert.equal(interview.readyForXml, false);
    assert.ok(interview.questions.length > 0);
    assert.equal(interview.questions.some(question => /certificado/i.test(question.question)), false);

    const invalid = await client.callTool({ name: 'validate_dps_json', arguments: { dps: {} } });
    assert.equal(invalid.isError, undefined);
    assert.equal(JSON.parse(invalid.content[0].text).valid, false);

    const built = await client.callTool({ name: 'build_dps_xml', arguments: { dps: validDps } });
    assert.equal(built.isError, undefined);
    const { xml } = JSON.parse(built.content[0].text);
    assert.match(xml, /^<DPS/);

    const validated = await client.callTool({ name: 'validate_dps_xml', arguments: { xml } });
    assert.deepEqual(JSON.parse(validated.content[0].text), { valid: true, schemaVersion: '1.01' });

    const missingCertificate = await client.callTool({ name: 'prepare_nfse', arguments: { dps: validDps } });
    assert.equal(missingCertificate.isError, true);
  } finally {
    await client.close();
  }
});
