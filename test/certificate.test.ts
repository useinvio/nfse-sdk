import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import https from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { inspect } from 'node:util';
import forge from 'node-forge';
import {
  assertCertificateForProvider,
  buildDpsFromJson,
  CertificateValidationError,
  ChaveAcessoInvalidaError,
  consultarNfse,
  enviarEvento,
  gzipBase64,
  NfseCertificate,
  signDps,
  transmitirNotaPreparada,
  prepararNota,
  verifyDps,
} from '../index.js';
import { invoice } from './fixtures.js';
import { mockHttps } from './httpsMock.js';

const PASSWORD = 'test-only-password';
const { privateKey: keyPem } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
const forgeKey = forge.pki.privateKeyFromPem(keyPem) as forge.pki.rsa.PrivateKey;
const forgePublic = forge.pki.setRsaPublicKey(forgeKey.n, forgeKey.e);

/** ICP-Brasil style SAN: otherName { 2.16.76.1.3.3, [0] OCTET STRING <CNPJ> }. */
function icpSan(oid: string, value: string): string {
  const { asn1 } = forge;
  const otherName = asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, true, [
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false, asn1.oidToDer(oid).getBytes()),
    asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, true, [asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false, value)]),
  ]);
  return asn1.toDer(asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [otherName])).getBytes();
}

function buildCert(commonName: string, san?: string, days = 30): forge.pki.Certificate {
  const cert = forge.pki.createCertificate();
  cert.publicKey = forgePublic;
  cert.serialNumber = '0a';
  cert.validity.notBefore = new Date(Date.now() - 86_400_000);
  cert.validity.notAfter = new Date(Date.now() + days * 86_400_000);
  cert.setSubject([{ name: 'commonName', value: commonName }]);
  cert.setIssuer([{ name: 'commonName', value: 'AC TESTE' }]);
  if (san) cert.setExtensions([{ id: '2.5.29.17', value: san } as any]);
  cert.sign(forgeKey, forge.md.sha256.create());
  return cert;
}

function pfxOf(cert: forge.pki.Certificate, password = PASSWORD): Buffer {
  const p12 = forge.pkcs12.toPkcs12Asn1(forgeKey, [cert], password, { algorithm: '3des' });
  return Buffer.from(forge.asn1.toDer(p12).getBytes(), 'binary');
}

const icpCert = buildCert('EMPRESA TESTE LTDA', icpSan('2.16.76.1.3.3', '12345678000195'));
const pfx = pfxOf(icpCert);

test('NfseCertificate reads ICP-Brasil holder metadata', () => {
  const certificate = NfseCertificate.fromPfx(pfx, PASSWORD);
  assert.equal(certificate.cnpj, '12345678000195');
  assert.equal(certificate.cpf, undefined);
  assert.equal(certificate.subject, 'EMPRESA TESTE LTDA');
  assert.equal(certificate.issuer, 'AC TESTE');
  assert.match(certificate.fingerprintSha256, /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
  assert.ok(certificate.isValidAt());
  assert.ok(certificate.daysUntilExpiry() >= 29);
  assert.ok(Object.isFrozen(certificate));
});

test('e-CPF otherName yields the CPF and the CN suffix is a fallback', () => {
  const ecpf = NfseCertificate.fromPfx(pfxOf(buildCert('FULANO', icpSan('2.16.76.1.3.1', `01011990${'12345678901'}00000000000`))), PASSWORD);
  assert.equal(ecpf.cpf, '12345678901');
  const cnOnly = NfseCertificate.fromPfx(pfxOf(buildCert('EMPRESA LTDA:98765432000110')), PASSWORD);
  assert.equal(cnOnly.cnpj, '98765432000110');
});

test('holder check uses the structured CNPJ, not any digits in the certificate', () => {
  const certificate = NfseCertificate.fromPfx(pfx, PASSWORD);
  assert.doesNotThrow(() => assertCertificateForProvider(certificate, '12.345.678/0001-95'));
  assert.throws(() => assertCertificateForProvider(certificate, '99999999000199'),
    (e) => e instanceof CertificateValidationError && e.code === 'CERTIFICATE_HOLDER_MISMATCH');
});

test('wrong password and unreadable input map to stable codes', () => {
  assert.throws(() => NfseCertificate.fromPfx(pfx, 'wrong'),
    (e) => e instanceof CertificateValidationError && e.code === 'CERTIFICATE_INVALID_PASSWORD');
  assert.throws(() => NfseCertificate.fromPfx(Buffer.from('not a pfx'), PASSWORD),
    (e) => e instanceof CertificateValidationError && e.code === 'CERTIFICATE_UNREADABLE');
});

test('logging and serialization never expose key material', () => {
  const certificate = NfseCertificate.fromPfx(pfx, PASSWORD);
  const surfaces = [
    inspect(certificate, { depth: 10, showHidden: true }),
    JSON.stringify(certificate),
    JSON.stringify({ nested: { certificate } }),
    Object.keys(certificate).join(','),
    String(Object.getOwnPropertyNames(certificate)),
  ];
  for (const text of surfaces) {
    assert.doesNotMatch(text, /PRIVATE KEY|BEGIN|test-only-password/);
  }
  assert.match(inspect(certificate), /NfseCertificate \{ cnpj=12345678000195/);
});

test('fromBase64 accepts whitespace and data URLs; fromPem accepts extracted pairs', () => {
  const b64 = pfx.toString('base64');
  const wrapped = `data:application/x-pkcs12;base64,${b64.replace(/(.{64})/g, '$1\n')}`;
  assert.equal(NfseCertificate.fromBase64(wrapped, PASSWORD).cnpj, '12345678000195');
  const fromPem = NfseCertificate.fromPem({ key: keyPem, cert: forge.pki.certificateToPem(icpCert) });
  assert.equal(fromPem.cnpj, '12345678000195');
  assert.throws(() => NfseCertificate.fromPem({ key: 'nope', cert: 'nope' }),
    (e) => e instanceof CertificateValidationError && e.code === 'CERTIFICATE_UNREADABLE');
});

test('fromEnv supports path, base64 and password files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'nfse-sdk-cert-'));
  try {
    const pfxPath = join(dir, 'a1.pfx');
    const passwordPath = join(dir, 'password');
    writeFileSync(pfxPath, pfx);
    writeFileSync(passwordPath, `${PASSWORD}\n`);
    assert.equal(NfseCertificate.fromEnv({ NFSE_CERT_PATH: pfxPath, NFSE_CERT_PASSWORD_FILE: passwordPath }).cnpj, '12345678000195');
    assert.equal(NfseCertificate.fromEnv({ NFSE_CERT_BASE64: pfx.toString('base64'), NFSE_CERT_PASSWORD: PASSWORD }).cnpj, '12345678000195');
    assert.throws(() => NfseCertificate.fromEnv({}), (e) => e instanceof CertificateValidationError && e.code === 'CERTIFICATE_MISSING');
    assert.throws(() => NfseCertificate.fromEnv({ NFSE_CERT_PATH: pfxPath }),
      (e) => e instanceof CertificateValidationError && e.code === 'CERTIFICATE_PASSWORD_MISSING');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('NfseCertificate signs a verifiable DPS', () => {
  const certificate = NfseCertificate.fromPfx(pfx, PASSWORD);
  const { id, xml } = buildDpsFromJson(invoice());
  const signed = signDps(xml, id, certificate);
  assert.ok(verifyDps(signed, forge.pki.certificateToPem(icpCert)));
});

test('transmission uses a per-certificate mTLS agent instead of PEM options', async (t) => {
  const certificate = NfseCertificate.fromPfx(pfx, PASSWORD);
  const other = NfseCertificate.fromPfx(pfx, PASSWORD);
  const key = '1'.repeat(50);
  const nfseXml = `<NFSe xmlns="http://www.sped.fazenda.gov.br/nfse"><infNFSe Id="NFS${key}"/></NFSe>`;
  const calls = mockHttps(t, { chaveAcesso: key, nfseXmlGZipB64: gzipBase64(nfseXml) });
  const result = await transmitirNotaPreparada(prepararNota(invoice(), certificate), certificate);
  await consultarNfse(key, other, 'restrita');
  assert.equal(result.chaveAcesso, key);
  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.ok(call.options.agent instanceof https.Agent);
    assert.equal(call.options.key, undefined);
    assert.equal(call.options.cert, undefined);
  }
  assert.notEqual(calls[0].options.agent, calls[1].options.agent, 'tenants must not share pooled sockets');
  certificate.destroy();
  other.destroy();
});

test('malformed access keys are rejected before any network I/O', async (t) => {
  const certificate = NfseCertificate.fromPfx(pfx, PASSWORD);
  const calls = mockHttps(t, {});
  for (const bad of ['123', '../../admin', `${'1'.repeat(50)}/eventos`, '1'.repeat(51)]) {
    await assert.rejects(consultarNfse(bad, certificate), ChaveAcessoInvalidaError);
    await assert.rejects(enviarEvento('x', certificate, bad), ChaveAcessoInvalidaError);
  }
  assert.equal(calls.length, 0);
});
