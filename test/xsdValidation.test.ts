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

function assertValidatesAgainstXsd(xml: string): void {
  const dir = mkdtempSync(join(tmpdir(), 'nfse-sdk-xsd-'));
  const schemaPath = prepareXmllintSchemaDir(dir);
  const xmlPath = join(dir, 'dps.xml');
  writeFileSync(xmlPath, xml);

  assert.doesNotThrow(() => {
    execFileSync('xmllint', ['--noout', '--schema', schemaPath, xmlPath], { stdio: 'pipe' });
  });
}

test('generated DPS XML validates against the official NFS-e Nacional v1.01 XSD', () => {
  const { xml } = buildDpsFromJson(request);
  assertValidatesAgainstXsd(xml);
});

test('generated DPS XML with indTotTrib=0 validates for MEI', () => {
  const { xml } = buildDpsFromJson({
    ...request,
    prestador: {
      ...request.prestador,
      opSimpNac: '2',
    },
    emissao: {
      ...request.emissao,
      totTrib: {
        indTotTrib: '0',
      },
    },
  });
  assertValidatesAgainstXsd(xml);
});

test('generated DPS XML validates for a domestic invoice', () => {
  const { xml } = buildDpsFromJson({
    ...request,
    prestador: {
      ...request.prestador,
      opSimpNac: '1',
    },
    emissao: {
      ...request.emissao,
      comercioExterior: undefined,
      valores: { vServ: '9000.00' },
      tributacaoMunicipal: {
        tribISSQN: '1',
        tpRetISSQN: '1',
      },
    },
  });
  assertValidatesAgainstXsd(xml);
});

test('generated DPS XML validates for PIS/COFINS with rates', () => {
  const { xml } = buildDpsFromJson({
    ...request,
    emissao: {
      ...request.emissao,
      tributacaoFederal: {
        piscofins: {
          CST: '00',
          vBCPisCofins: '9000.00',
          pAliqPis: '0.65',
          pAliqCofins: '3.00',
        },
      },
    },
  });
  assertValidatesAgainstXsd(xml);
});

test('generated DPS XML validates for another ME/EPP pTotTribSN rate', () => {
  const { xml } = buildDpsFromJson({
    ...request,
    prestador: {
      ...request.prestador,
      opSimpNac: '3',
    },
    emissao: {
      ...request.emissao,
      totTrib: {
        pTotTribSN: '4.25',
      },
    },
  });
  assertValidatesAgainstXsd(xml);
});

test('generated DPS XML validates for the pTotTribSN branch (ME/EPP)', () => {
  const { xml } = buildDpsFromJson({
    ...request,
    prestador: {
      ...request.prestador,
      opSimpNac: '3',
    },
    emissao: {
      ...request.emissao,
      comercioExterior: undefined,
      valores: { vServ: '9000.00' },
      tributacaoMunicipal: { tribISSQN: '1', tpRetISSQN: '1' },
      totTrib: {
        pTotTribSN: '6',
      },
    },
  });
  assertValidatesAgainstXsd(xml);
});

test('generated DPS XML validates for a tomador with endNac address', () => {
  const { xml } = buildDpsFromJson({
    ...request,
    emissao: {
      ...request.emissao,
      comercioExterior: undefined,
      valores: { vServ: '9000.00' },
      tributacaoMunicipal: { tribISSQN: '1', tpRetISSQN: '1' },
      tomador: {
        CNPJ: '11222333000181',
        xNome: 'Cliente Exemplo',
        end: {
          endNac: { cMun: '4106902', CEP: '80010000' },
          xLgr: 'Rua Teste',
          nro: '100',
          xBairro: 'Centro',
        },
      },
    },
  });
  assertValidatesAgainstXsd(xml);
});
