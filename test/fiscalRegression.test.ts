import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDpsFromJson, DpsFiscalValidationError, validateDpsJsonRequest, validateDpsXmlAgainstXsd, type DpsJsonRequest } from '../index.js';
import { invoice } from './fixtures.js';

for (const kind of ['national', 'export'] as const) {
  for (const regime of ['1', '2', '3']) {
    for (const provider of ['cpf', 'cnpj'] as const) {
      test(`${kind}, regime ${regime}, provider ${provider}: JSON and XSD`, () => {
        const request = invoice(kind);
        request.prestador.opSimpNac = regime;
        if (provider === 'cpf') { delete request.prestador.cnpj; request.prestador.cpf = '12345678901'; }
        if (regime === '2') request.emissao.totTrib = { indTotTrib: '0' };
        if (regime === '3') request.emissao.totTrib = { pTotTribSN: '4.25' };
        assert.equal(validateDpsJsonRequest(request).valid, true);
        validateDpsXmlAgainstXsd(buildDpsFromJson(request).xml);
      });
    }
  }
}

test('normalization resolves mixed aliases per field, preserves precedence, and copies input', () => {
  const request = invoice('export');
  request.emissao.valores = { vServMoeda: '9000.00' };
  request.emissao.cotacao = 5.210621;
  request.emissao.vServMoeda = '1';
  request.emissao.comExt = { mdPrestacao: '9' };
  const original = structuredClone(request);
  const report = validateDpsJsonRequest(request);
  assert.equal(report.valid, true);
  assert.equal(report.normalizedPayload.emissao.valores?.cotacao, 5.210621);
  assert.equal(report.normalizedPayload.emissao.valores?.vServMoeda, '9000.00');
  assert.equal(report.normalizedPayload.emissao.comercioExterior?.mdPrestacao, '1');
  assert.match(buildDpsFromJson(request).xml, /<vServ>46895.59<\/vServ>/);
  report.normalizedPayload.emissao.tomador!.end!.nro = '999';
  assert.deepEqual(request, original);
});

test('national legacy currency fields cannot bypass the matrix when valores exists', () => {
  const request = invoice();
  request.emissao.cotacao = 5;
  assert.equal(validateDpsJsonRequest(request).valid, false);
});

test('legacy-only export and comExt alias produce the same XML', () => {
  const request = invoice('export');
  const expected = buildDpsFromJson(request);
  Object.assign(request.emissao, request.emissao.valores);
  delete request.emissao.valores;
  request.emissao.comExt = request.emissao.comercioExterior;
  delete request.emissao.comercioExterior;
  assert.deepEqual(buildDpsFromJson(request), expected);
});

test('currency differences are warnings only and explicit values remain authoritative', () => {
  const request = invoice('export');
  request.emissao.valores!.vServ = '1.005';
  request.emissao.comercioExterior!.vServMoeda = '2.005';
  const report = validateDpsJsonRequest(request);
  assert.equal(report.valid, true);
  assert.deepEqual(report.issues, []);
  assert.deepEqual(report.warnings.map((w) => w.code), ['CURRENCY_BRL_MISMATCH', 'CURRENCY_FOREIGN_MISMATCH']);
  assert.ok(report.warnings.every((w) => w.severity === 'warning'));
  const { xml } = buildDpsFromJson(request);
  assert.match(xml, /<vServ>1.01<\/vServ>/);
  assert.match(xml, /<vServMoeda>2.01<\/vServMoeda>/);
  validateDpsXmlAgainstXsd(xml);
});

test('conversion retains original foreign precision and warnings compare cents', () => {
  const request = invoice('export');
  request.emissao.valores = { vServMoeda: '1.005', cotacao: 2, vServ: '2.014' };
  request.emissao.comercioExterior!.vServMoeda = '1.006';
  const report = validateDpsJsonRequest(request);
  assert.deepEqual(report.warnings, []);
  delete request.emissao.valores.vServ;
  const { xml } = buildDpsFromJson(request);
  assert.match(xml, /<vServ>2.01<\/vServ>/);
  assert.match(xml, /<vServMoeda>1.01<\/vServMoeda>/);
  validateDpsXmlAgainstXsd(xml);
});

const invalidCases: Array<[string, (r: DpsJsonRequest) => void]> = [
  ['zero after rounding', r => { r.emissao.valores = { vServ: '0.001' }; }],
  ['negative money', r => { r.emissao.valores = { vServ: '-1' }; }],
  ['comma money', r => { r.emissao.valores = { vServ: '1,5' }; }],
  ['exponent money', r => { r.emissao.valores = { vServ: '1e3' }; }],
  ['money overflow after rounding', r => { r.emissao.valores = { vServ: '999999999999999.995' }; }],
  ['empty optional federal amount', r => { r.emissao.tributacaoFederal = { vRetCP: '' }; }],
  ['invalid federal amount without PIS', r => { r.emissao.tributacaoFederal = { vRetIRRF: '-1' }; }],
  ['invalid retention enum', r => { r.emissao.tributacaoFederal = { piscofins: { CST: '00', tpRetPisCofins: '10' } }; }],
  ['PIS rate overflow', r => { r.emissao.tributacaoFederal = { piscofins: { CST: '00', pAliqPis: '99.995' } }; }],
  ['totals rate overflow', r => { r.emissao.totTrib!.pTotTribFed = '999.995'; }],
  ['invalid calendar date', r => { r.emissao.dhEmi = '2026-02-29T10:00:00-03:00'; }],
  ['invalid hour', r => { r.emissao.dhEmi = '2026-10-06T24:00:00-03:00'; }],
  ['fractional timestamp', r => { r.emissao.dhEmi = '2026-10-06T10:00:00.123-03:00'; }],
  ['offset minutes unsupported by XSD', r => { r.emissao.dhEmi = '2026-10-06T10:00:00+05:30'; }],
  ['invalid competence', r => { r.emissao.dCompet = '2026-04-31'; }],
  ['empty obra', r => { r.emissao.obra = {}; }],
  ['obra only registration', r => { r.emissao.obra = { inscImobFisc: '123' }; }],
  ['long obra code', r => { r.emissao.obra = { cObra: '1'.repeat(31) }; }],
  ['foreign intermediary', r => { r.emissao.intermediario = { NIF: 'ABC', xNome: 'Foreign' } as never; }],
  ['mixed total branches', r => { r.emissao.totTrib!.indTotTrib = '0'; }],
  ['incomplete totals', r => { delete r.emissao.totTrib!.pTotTribFed; }],
  ['wrong regime totals', r => { r.prestador.opSimpNac = '2'; }],
  ['two provider identifiers', r => { r.prestador.cpf = '12345678901'; }],
  ['two recipient identifiers', r => { r.emissao.tomador!.CNPJ = '12345678000195'; }],
  ['recipient without address', r => { delete r.emissao.tomador!.end; }],
];
for (const [name, mutate] of invalidCases) test(`validation rejects ${name}`, () => {
  const request = invoice(); mutate(request);
  assert.equal(validateDpsJsonRequest(request).valid, false);
  assert.throws(() => buildDpsFromJson(request), DpsFiscalValidationError);
});

for (const value of [null, [], 3, {}, { prestador: null }, { prestador: {}, servico: {}, emissao: [] }]) {
  test(`malformed root returns structured errors: ${JSON.stringify(value)}`, () => {
    const report = validateDpsJsonRequest(value);
    assert.equal(report.valid, false);
    assert.ok(report.issues.every(i => i.code === 'INVALID_STRUCTURE'));
    assert.throws(() => buildDpsFromJson(JSON.stringify(value)), DpsFiscalValidationError);
  });
}
for (const mutate of [
  (r: DpsJsonRequest) => { r.emissao.tomador = 'bad' as never; },
  (r: DpsJsonRequest) => { r.emissao.tomador!.end = [] as never; },
  (r: DpsJsonRequest) => { r.servico.xDescServ = 42 as never; },
  (r: DpsJsonRequest) => { r.emissao.dCompet = false as never; },
  (r: DpsJsonRequest) => { r.emissao.valores!.cotacao = NaN; },
  (r: DpsJsonRequest) => { r.emissao.valores!.vServ = 100 as never; },
]) test(`nested malformed shape ${mutate.toString()}`, () => {
  const request = invoice(); mutate(request);
  assert.equal(validateDpsJsonRequest(request).issues[0].code, 'INVALID_STRUCTURE');
});

test('obra order, zero federal retention, and federal rounding validate against XSD', () => {
  const request = invoice();
  request.emissao.obra = { cObra: '123', inscImobFisc: '456' };
  request.emissao.tributacaoFederal = { vRetCP: '0', vRetIRRF: '1.005', vRetCSLL: '0.005', piscofins: { CST: '00', pAliqPis: '1.005', tpRetPisCofins: '9' } };
  const { xml } = buildDpsFromJson(request);
  assert.match(xml, /<obra><inscImobFisc>456<\/inscImobFisc><cObra>123<\/cObra><\/obra>/);
  assert.match(xml, /<vRetCP>0.00<\/vRetCP><vRetIRRF>1.01<\/vRetIRRF><vRetCSLL>0.01<\/vRetCSLL>/);
  validateDpsXmlAgainstXsd(xml);
});

for (const [field, value] of Object.entries({ mdPrestacao: '5', vincPrest: '7', tpMoeda: 'USD', mecAFComexP: '09', mecAFComexT: '27', movTempBens: '4', mdic: '2', vServMoeda: '0.001' })) {
  test(`export rejects invalid ${field}`, () => {
    const request = invoice('export');
    Object.assign(request.emissao.comercioExterior!, { [field]: value });
    assert.equal(validateDpsJsonRequest(request).valid, false);
  });
}

test('conversion rejects a rounded zero and overflow', () => {
  for (const cotacao of [0.0001, 1e15]) {
    const request = invoice('export'); request.emissao.valores = { vServMoeda: '1', cotacao };
    assert.equal(validateDpsJsonRequest(request).valid, false);
  }
});

for (const id of ['NIF', '1', '2', 'absent']) test(`export recipient ${id}`, () => {
  const request = invoice('export');
  if (id === 'absent') delete request.emissao.tomador;
  else if (id !== 'NIF') { delete request.emissao.tomador!.NIF; request.emissao.tomador!.cNaoNIF = id; }
  validateDpsXmlAgainstXsd(buildDpsFromJson(request).xml);
});

for (const field of ['prestador', 'servico', 'emissao']) test(`required block ${field}`, () => {
  const request = invoice(); delete (request as unknown as Record<string, unknown>)[field];
  assert.ok(validateDpsJsonRequest(request).issues.some(i => i.path === field));
});
