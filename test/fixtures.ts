import forge from 'node-forge';
import { nationalInvoice, exportInvoice } from '../examples/payloads.js';
import { loadPfxFromBuffer, type DpsJsonRequest } from '../index.js';

export function invoice(kind: 'national' | 'export' = 'national'): DpsJsonRequest {
  return structuredClone(kind === 'national' ? nationalInvoice : exportInvoice);
}

let keys: forge.pki.rsa.KeyPair;
export function certificate(notBefore = new Date(Date.now() - 86_400_000), notAfter = new Date(Date.now() + 86_400_000), taxId = '12345678000195') {
  keys ??= forge.pki.rsa.generateKeyPair({ bits: 1024, e: 0x10001 });
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = notBefore;
  cert.validity.notAfter = notAfter;
  const attrs = [{ name: 'commonName', value: `SDK test ${taxId}` }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  const asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], 'test-only', { algorithm: '3des' });
  return loadPfxFromBuffer(Buffer.from(forge.asn1.toDer(asn1).getBytes(), 'binary'), 'test-only');
}
