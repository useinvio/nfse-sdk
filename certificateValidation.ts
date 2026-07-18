import forge from 'node-forge';
import type { PfxMaterial } from './loadPfx.js';

export class CertificateValidationError extends Error {
  constructor(
    public readonly code: 'CERTIFICATE_NOT_YET_VALID' | 'CERTIFICATE_EXPIRED' | 'CERTIFICATE_HOLDER_MISMATCH',
    message: string,
  ) {
    super(message);
    this.name = 'CertificateValidationError';
  }
}

/** Final certificate validity and holder check performed immediately before transmission. */
export function assertCertificateForProvider(pfx: PfxMaterial, providerTaxId: string, now = new Date()): void {
  const certificate = forge.pki.certificateFromPem(pfx.certPem);
  if (now < certificate.validity.notBefore) {
    throw new CertificateValidationError('CERTIFICATE_NOT_YET_VALID', 'O certificado digital ainda nao esta vigente.');
  }
  if (now >= certificate.validity.notAfter) {
    throw new CertificateValidationError('CERTIFICATE_EXPIRED', 'O certificado digital esta expirado.');
  }

  const expected = providerTaxId.replace(/\D/g, '');
  const subjectText = certificate.subject.attributes.map((attribute) => String(attribute.value)).join(' ');
  const derText = forge.asn1.toDer(forge.pki.certificateToAsn1(certificate)).getBytes();
  const taxIds: string[] = `${subjectText} ${derText}`.match(/\d{14}/g) ?? [];
  if (!taxIds.includes(expected)) {
    throw new CertificateValidationError(
      'CERTIFICATE_HOLDER_MISMATCH',
      'O titular do certificado digital nao corresponde ao CNPJ do emitente.',
    );
  }
}
