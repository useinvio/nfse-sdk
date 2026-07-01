import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { buildDpsFromJson, type DpsJsonRequest } from '../index.js';

const schemaDir = resolve('schemas/nfse/v1.01/Schemas/1.01');

function prepareXmllintSchemaDir(workDir: string): string {
  const schemaCopyDir = join(workDir, 'schemas');
  cpSync(schemaDir, schemaCopyDir, { recursive: true });

  const simpleTypesPath = join(schemaCopyDir, 'tiposSimples_v1.01.xsd');
  const simpleTypes = readFileSync(simpleTypesPath, 'utf8').replace(
    '<xs:pattern value="^0{0,4}\\d{1,5}$"/>',
    '<xs:pattern value="0{0,4}\\d{1,5}"/>',
  );
  writeFileSync(simpleTypesPath, simpleTypes);

  return join(schemaCopyDir, 'DPS_v1.01.xsd');
}

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

test('generated DPS XML validates against the official NFS-e Nacional v1.01 XSD', () => {
  const { xml } = buildDpsFromJson(request);
  const dir = mkdtempSync(join(tmpdir(), 'nfse-sdk-xsd-'));
  const schemaPath = prepareXmllintSchemaDir(dir);
  const xmlPath = join(dir, 'dps.xml');
  writeFileSync(xmlPath, xml);

  assert.doesNotThrow(() => {
    execFileSync('xmllint', ['--noout', '--schema', schemaPath, xmlPath], { stdio: 'pipe' });
  });
});

test('generated DPS XML with indTotTrib=0 validates for non-Simples providers', () => {
  const { xml } = buildDpsFromJson({
    ...request,
    prestador: {
      ...request.prestador,
      opSimpNac: '1',
    },
    emissao: {
      ...request.emissao,
      totTrib: {
        indTotTrib: '0',
      },
    },
  });
  const dir = mkdtempSync(join(tmpdir(), 'nfse-sdk-xsd-'));
  const schemaPath = prepareXmllintSchemaDir(dir);
  const xmlPath = join(dir, 'dps.xml');
  writeFileSync(xmlPath, xml);

  assert.doesNotThrow(() => {
    execFileSync('xmllint', ['--noout', '--schema', schemaPath, xmlPath], { stdio: 'pipe' });
  });
});
