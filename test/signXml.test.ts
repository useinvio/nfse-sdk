import assert from 'node:assert/strict';
import test from 'node:test';
import forge from 'node-forge';
import { loadPfxFromBuffer, signDps, verifyDps } from '../index.js';

const PASSWORD = 'test-password';

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

  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], PASSWORD, {
    algorithm: '3des',
  });
  const der = forge.asn1.toDer(p12Asn1).getBytes();
  return Buffer.from(der, 'binary');
}

test('loadPfxFromBuffer extracts signing material from an in-memory PFX', () => {
  const pfx = loadPfxFromBuffer(createPfxFixture(), PASSWORD);

  assert.match(pfx.privateKeyPem, /BEGIN RSA PRIVATE KEY|BEGIN PRIVATE KEY/);
  assert.match(pfx.certPem, /BEGIN CERTIFICATE/);
  assert.equal(typeof pfx.certDerBase64, 'string');
  assert.ok(pfx.certDerBase64.length > 0);
  assert.ok(Buffer.isBuffer(pfx.pfxBuffer));
});

test('signDps creates a verifiable XMLDSIG signature', () => {
  const pfx = loadPfxFromBuffer(createPfxFixture(), PASSWORD);
  const xml = '<DPS><infDPS Id="DPS1"><valor>123.45</valor></infDPS></DPS>';

  const signedXml = signDps(xml, 'DPS1', pfx);

  assert.match(signedXml, /<Signature/);
  assert.match(signedXml, /<X509Certificate>/);
  assert.equal(verifyDps(signedXml, pfx.certPem), true);
});
