import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import forge from 'node-forge';
import {
  buildCancelamentoFromJson,
  buildCancelamentoPorSubstituicaoFromJson,
  buildDpsFromJson,
  loadPfxFromBuffer,
  signEnveloped,
  type DpsJsonRequest,
} from '../index.js';

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

  return schemaCopyDir;
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

function assertValidatesAgainstXsd(xml: string, rootSchema = 'DPS_v1.01.xsd'): void {
  const dir = mkdtempSync(join(tmpdir(), 'nfse-sdk-xsd-'));
  const schemaPath = join(prepareXmllintSchemaDir(dir), rootSchema);
  const xmlPath = join(dir, 'documento.xml');
  writeFileSync(xmlPath, xml);

  assert.doesNotThrow(() => {
    execFileSync('xmllint', ['--noout', '--schema', schemaPath, xmlPath], { stdio: 'pipe' });
  });
}

test('generated DPS XML validates against the official NFS-e Nacional v1.01 XSD', () => {
  const { xml } = buildDpsFromJson(request);
  assertValidatesAgainstXsd(xml);
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
  assertValidatesAgainstXsd(xml);
});

test('generated DPS XML validates for a domestic invoice with tribISSQN=1 and pAliq', () => {
  const { xml } = buildDpsFromJson({
    ...request,
    prestador: {
      ...request.prestador,
      opSimpNac: '2',
    },
    emissao: {
      ...request.emissao,
      comercioExterior: undefined,
      tributacaoMunicipal: {
        tribISSQN: '1',
        tpRetISSQN: '1',
        pAliq: '2.5',
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

test('generated DPS XML validates for the vTotTrib(Fed/Est/Mun) branch', () => {
  const { xml } = buildDpsFromJson({
    ...request,
    emissao: {
      ...request.emissao,
      totTrib: {
        vTotTribFed: '100.00',
        vTotTribEst: '0',
        vTotTribMun: '50.00',
      },
    },
  });
  assertValidatesAgainstXsd(xml);
});

test('generated DPS XML validates for the pTotTribSN branch (Simples Nacional)', () => {
  const { xml } = buildDpsFromJson({
    ...request,
    prestador: {
      ...request.prestador,
      opSimpNac: '2',
    },
    emissao: {
      ...request.emissao,
      totTrib: {
        pTotTribSN: '6',
      },
    },
  });
  assertValidatesAgainstXsd(xml);
});

test('generated pedRegEvento (cancelamento e101101) validates against the official XSD', () => {
  const { xml } = buildCancelamentoFromJson({
    ambiente: 'restrita',
    chaveAcesso: '1'.repeat(50),
    autor: { CNPJ: '11222333000181' },
    dhEvento: '2026-04-20T14:02:19-03:00',
    cMotivo: '1',
    xMotivo: 'Nota emitida com valor incorreto',
  });
  assertValidatesAgainstXsd(xml, 'pedRegEvento_v1.01.xsd');
});

test('generated pedRegEvento (cancelamento por substituicao e105102) validates against the official XSD', () => {
  const { xml } = buildCancelamentoPorSubstituicaoFromJson({
    ambiente: 'restrita',
    chaveAcesso: '1'.repeat(50),
    autor: { CPF: '39053344705' },
    dhEvento: '2026-04-20T14:02:19-03:00',
    cMotivo: '05',
    xMotivo: 'Rejeicao registrada pelo tomador do servico',
    chaveSubstituta: '2'.repeat(50),
  });
  assertValidatesAgainstXsd(xml, 'pedRegEvento_v1.01.xsd');
});

test('signed pedRegEvento keeps validating against the official XSD', () => {
  const built = buildCancelamentoFromJson({
    ambiente: 'restrita',
    chaveAcesso: '1'.repeat(50),
    autor: { CNPJ: '11222333000181' },
    dhEvento: '2026-04-20T14:02:19-03:00',
    cMotivo: '2',
    xMotivo: 'Servico nao foi prestado ao tomador',
  });
  const pfx = loadPfxFromBuffer(createPfxFixture(), 'test-password');
  const signedXml = signEnveloped(built.xml, built.id, 'infPedReg', pfx);
  assertValidatesAgainstXsd(signedXml, 'pedRegEvento_v1.01.xsd');
});

function createPfxFixture(): Buffer {
  const keys = forge.pki.rsa.generateKeyPair({ bits: 1024, e: 0x10001 });
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';

  const now = new Date();
  cert.validity.notBefore = new Date(now.getTime() - 60_000);
  cert.validity.notAfter = new Date(now.getTime() + 86_400_000);

  const attrs = [{ name: 'commonName', value: 'nfse-sdk test certificate' }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.setExtensions([{ name: 'basicConstraints', cA: false }]);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], 'test-password', {
    algorithm: '3des',
  });
  return Buffer.from(forge.asn1.toDer(p12Asn1).getBytes(), 'binary');
}

test('generated DPS XML validates for a tomador with endNac address', () => {
  const { xml } = buildDpsFromJson({
    ...request,
    emissao: {
      ...request.emissao,
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
