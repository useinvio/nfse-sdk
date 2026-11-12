import { X509Certificate } from 'node:crypto';
import forge from 'node-forge';
import { icpBrasilTaxIds, NfseCertificate, resolveCredentials, type CertificateInput } from './certificate.js';

export type CertificateValidationCode =
  | 'CERTIFICATE_NOT_YET_VALID'
  | 'CERTIFICATE_EXPIRED'
  | 'CERTIFICATE_HOLDER_MISMATCH'
  | 'CERTIFICATE_INVALID_PASSWORD'
  | 'CERTIFICATE_UNREADABLE'
  | 'CERTIFICATE_MISSING'
  | 'CERTIFICATE_PASSWORD_MISSING';

export class CertificateValidationError extends Error {
  constructor(
    public readonly code: CertificateValidationCode,
    message: string,
  ) {
    super(message);
    this.name = 'CertificateValidationError';
  }
}

function validityOf(input: CertificateInput): { notBefore: Date; notAfter: Date } {
  if (input instanceof NfseCertificate) return input;
  const x509 = new X509Certificate(resolveCredentials(input).certPem);
  return { notBefore: new Date(x509.validFrom), notAfter: new Date(x509.validTo) };
}

/** Validity is checked at signing time and again immediately before transmission. */
export function assertCertificateValidity(certificate: CertificateInput, now = new Date()): void {
  const { notBefore, notAfter } = validityOf(certificate);
  if (now < notBefore) {
    throw new CertificateValidationError('CERTIFICATE_NOT_YET_VALID', 'O certificado digital ainda nao esta vigente.');
  }
  if (now >= notAfter) {
    throw new CertificateValidationError('CERTIFICATE_EXPIRED', 'O certificado digital esta expirado.');
  }
}

/**
 * Explicit holder check against the ICP-Brasil CNPJ/CPF fields of the
 * certificate (otherName OIDs 2.16.76.1.3.3 / 2.16.76.1.3.1, or the
 * `NOME:DOCUMENTO` common name). Does not resolve fiscal representation.
 */
export function assertCertificateForProvider(certificate: CertificateInput, providerTaxId: string, now = new Date()): void {
  assertCertificateValidity(certificate, now);
  const expected = providerTaxId.replace(/\D/g, '');
  const { cnpj, cpf } = certificate instanceof NfseCertificate
    ? certificate
    : icpBrasilTaxIds(forge.pki.certificateFromPem(resolveCredentials(certificate).certPem));
  if (expected !== cnpj && expected !== cpf) {
    throw new CertificateValidationError(
      'CERTIFICATE_HOLDER_MISMATCH',
      'O titular do certificado digital nao corresponde ao CPF/CNPJ do emitente.',
    );
  }
}
