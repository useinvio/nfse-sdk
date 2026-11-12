import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  buildDpsFromJson,
  DpsXsdValidationError,
  validateDpsXmlAgainstXsd,
  XmllintUnavailableError,
  XsdEngineUnavailableError,
  type DpsJsonRequest,
} from '../index.js';

const request: DpsJsonRequest = {
  ambiente: 'restrita',
  prestador: {
    cnpj: '39999099000909',
    tpInsc: '2',
    cLocEmi: '4106902',
    serie: '1608',
    opSimpNac: '1',
    regEspTrib: '0',
  },
  servico: {
    cTribNac: '010201',
    cNBS: '115022000',
    xDescServ: 'Desenvolvimento de software',
    cLocPrestacao: '4106902',
  },
  emissao: {
    nDPS: '4',
    dhEmi: '2026-04-20T14:02:19-03:00',
    dCompet: '2026-03-27',
    valores: {
      vServMoeda: '9000.00',
      cotacao: 5.210621,
    },
    comercioExterior: {
      mdPrestacao: '4',
      vincPrest: '0',
      tpMoeda: '220',
      vServMoeda: '9000.00',
      mecAFComexP: '01',
      mecAFComexT: '01',
      movTempBens: '1',
      mdic: '0',
    },
    tributacaoMunicipal: {
      tribISSQN: '3',
      cPaisResult: 'US',
      tpRetISSQN: '1',
    },
    tributacaoFederal: {
      piscofins: {
        CST: '00',
      },
    },
    totTrib: {
      pTotTribFed: '11.33',
      pTotTribEst: '0',
      pTotTribMun: '5',
    },
  },
};

function withPath<T>(path: string, fn: () => T): T {
  const original = process.env.PATH;
  process.env.PATH = path;
  try {
    return fn();
  } finally {
    process.env.PATH = original;
  }
}

test('XSD validation runs in-process and does not need xmllint on PATH', () => {
  const { xml } = buildDpsFromJson(request);
  const emptyPathDir = mkdtempSync(join(tmpdir(), 'nfse-sdk-empty-path-'));
  try {
    withPath(emptyPathDir, () => {
      assert.doesNotThrow(() => validateDpsXmlAgainstXsd(xml));
      assert.throws(
        () => validateDpsXmlAgainstXsd(xml.replace('<tpAmb>2</tpAmb>', '<tpAmb>9</tpAmb>')),
        DpsXsdValidationError,
      );
    });
  } finally {
    rmSync(emptyPathDir, { recursive: true, force: true });
  }
});

test('malformed XML is a payload error, not an engine failure', () => {
  assert.throws(
    () => validateDpsXmlAgainstXsd('<DPS><infDPS></DPS>'),
    (error: unknown) => {
      assert.ok(error instanceof DpsXsdValidationError);
      assert.ok(!(error instanceof XsdEngineUnavailableError));
      assert.ok(error.details.length > 0);
      return true;
    },
  );
});

test('XmllintUnavailableError stays as a deprecated alias of XsdEngineUnavailableError', () => {
  assert.equal(XmllintUnavailableError, XsdEngineUnavailableError);
  const error = new XsdEngineUnavailableError('boom', new Error('cause'));
  assert.ok(error instanceof XmllintUnavailableError);
});

test('an XML that really violates the v1.01 XSD throws DpsXsdValidationError with the libxml2 diagnostic', () => {
  const { xml } = buildDpsFromJson(request);
  // dhEmi expects an xs:dateTime; this value is well-formed XML but schema-invalid.
  const invalidXml = xml.replace(
    '<dhEmi>2026-04-20T14:02:19-03:00</dhEmi>',
    '<dhEmi>not-a-date</dhEmi>',
  );
  assert.notEqual(invalidXml, xml);

  assert.throws(
    () => validateDpsXmlAgainstXsd(invalidXml),
    (error: unknown) => {
      assert.ok(error instanceof DpsXsdValidationError, 'expected DpsXsdValidationError');
      assert.ok(error.details.length > 0);
      assert.ok(error.details.every((line) => line.length > 0 && line !== 'undefined'));
      assert.doesNotMatch(error.message, /: undefined$/);
      assert.match(error.message, /dhEmi|dateTime|not-a-date/i);
      return true;
    },
  );
});
