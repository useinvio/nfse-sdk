import assert from 'node:assert/strict';
import test from 'node:test';
import { DPS_JSON_REQUEST_SCHEMA, validateDpsJsonRequest, type DpsJsonRequest } from '../index.js';
import { checkJsonSchema } from '../jsonSchemaCheck.js';
import { invoice } from './fixtures.js';

function withValue(request: DpsJsonRequest, path: string, value: unknown): DpsJsonRequest {
  const copy = structuredClone(request) as unknown as Record<string, any>;
  const keys = path.split('.');
  const parent = keys.slice(0, -1).reduce((node, key) => (node[key] ??= {}), copy);
  if (value === undefined) delete parent[keys.at(-1)!];
  else parent[keys.at(-1)!] = value;
  return copy as unknown as DpsJsonRequest;
}

const schemaErrors = (request: unknown) => checkJsonSchema(DPS_JSON_REQUEST_SCHEMA, request);

test('example payloads conform to the published JSON Schema', () => {
  for (const kind of ['national', 'export'] as const) {
    assert.deepEqual(schemaErrors(invoice(kind)), [], kind);
    assert.equal(validateDpsJsonRequest(invoice(kind)).valid, true, kind);
  }
});

// Each field-level rule must be rejected by both the schema and the validator.
const rejected: Array<[kind: 'national' | 'export', path: string, value: unknown]> = [
  ['national', 'prestador.cnpj', '123'],
  ['national', 'prestador.cLocEmi', '410690'],
  ['national', 'prestador.serie', '123456'],
  ['national', 'prestador.opSimpNac', '4'],
  ['national', 'prestador.regEspTrib', '7'],
  ['national', 'servico.cTribNac', '01020'],
  ['national', 'servico.cNBS', '11502200'],
  ['national', 'servico.xDescServ', ''],
  ['national', 'emissao.nDPS', '01'],
  ['national', 'emissao.dhEmi', '2026-06-15 10:30:00'],
  ['national', 'emissao.dCompet', '15/06/2026'],
  ['national', 'emissao.valores.vServ', '1,500.00'],
  ['national', 'emissao.valores.vServ', '-1'],
  ['national', 'emissao.valores.vServ', 1500],
  ['national', 'emissao.tomador.CPF', '123'],
  ['national', 'emissao.tomador.end.endNac.CEP', '8001000'],
  ['national', 'emissao.tributacaoMunicipal.tribISSQN', '5'],
  ['national', 'emissao.tributacaoMunicipal.tpRetISSQN', '0'],
  ['national', 'emissao.tributacaoMunicipal', undefined],
  ['national', 'emissao.tributacaoFederal.piscofins.CST', '10'],
  ['national', 'emissao.tributacaoFederal.piscofins.tpRetPisCofins', '10'],
  ['national', 'emissao.totTrib', undefined],
  ['national', 'emissao.obra', { inscImobFisc: '123' }],
  ['national', 'emissao.obra', { cObra: 'x'.repeat(31) }],
  ['export', 'emissao.comercioExterior.mdPrestacao', '5'],
  ['export', 'emissao.comercioExterior.mecAFComexP', '09'],
  ['export', 'emissao.comercioExterior.mecAFComexT', '27'],
  ['export', 'emissao.comercioExterior.tpMoeda', '22'],
  ['export', 'emissao.comercioExterior.mdic', '2'],
  ['export', 'emissao.tomador.end.endExt.cPais', 'usa'],
  ['export', 'emissao.tomador.cNaoNIF', '0'],
  ['export', 'emissao.tributacaoMunicipal.cPaisResult', 'us'],
  ['export', 'emissao.valores.cotacao', 0],
];

for (const [kind, path, value] of rejected) {
  test(`schema and validator both reject ${kind} ${path}=${JSON.stringify(value)}`, () => {
    let request = withValue(invoice(kind), path, value);
    if (path === 'emissao.tomador.cNaoNIF') request = withValue(request, 'emissao.tomador.NIF', undefined);
    assert.notDeepEqual(schemaErrors(request), [], 'schema accepted');
    assert.equal(validateDpsJsonRequest(request).valid, false, 'validator accepted');
  });
}

const accepted: Array<[kind: 'national' | 'export', path: string, value: unknown]> = [
  ['national', 'emissao.tributacaoFederal.piscofins.CST', '99'],
  ['national', 'emissao.tributacaoFederal.piscofins.tpRetPisCofins', '9'],
  ['national', 'emissao.obra', { cObra: 'x'.repeat(30) }],
  ['export', 'emissao.comercioExterior.mecAFComexT', '26'],
  ['export', 'emissao.comercioExterior.vincPrest', '9'],
];

for (const [kind, path, value] of accepted) {
  test(`schema and validator both accept ${kind} ${path}=${JSON.stringify(value)}`, () => {
    const request = withValue(invoice(kind), path, value);
    assert.deepEqual(schemaErrors(request), []);
    assert.equal(validateDpsJsonRequest(request).valid, true);
  });
}

test('schema rejects unknown fields and legacy aliases', () => {
  const typo = withValue(invoice(), 'emissao.tributacaoMunicipal.aliquota', '5.00');
  assert.deepEqual(schemaErrors(typo).map(({ path, keyword }) => [path, keyword]), [['emissao.tributacaoMunicipal.aliquota', 'additionalProperties']]);
  const legacy = withValue(invoice(), 'emissao.vServ', '1500.00');
  assert.deepEqual(schemaErrors(legacy).map(({ keyword }) => keyword), ['additionalProperties']);
});

test('schema uses only the portable keyword subset', () => {
  assert.throws(() => checkJsonSchema({ type: 'object', oneOf: [] }, {}), /Unsupported JSON Schema keyword/);
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(DPS_JSON_REQUEST_SCHEMA)));
  assert.equal(DPS_JSON_REQUEST_SCHEMA.$schema, 'https://json-schema.org/draft/2020-12/schema');
});
