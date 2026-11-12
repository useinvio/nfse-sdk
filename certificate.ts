import { createPrivateKey, X509Certificate, type KeyObject } from 'node:crypto';
import { readFileSync } from 'node:fs';
import https from 'node:https';
import { createSecureContext } from 'node:tls';
import { inspect } from 'node:util';
import forge from 'node-forge';
import { CertificateValidationError } from './certificateValidation.js';
import { parsePfx, type PfxMaterial } from './loadPfx.js';

/** Public, non-secret facts about an A1 certificate. Safe to log. */
export interface NfseCertificateInfo {
  /** Subject common name, e.g. `EMPRESA LTDA:12345678000195`. */
  subject: string;
  issuer: string;
  /** CNPJ from the ICP-Brasil otherName (OID 2.16.76.1.3.3), when present. */
  cnpj?: string;
  /** CPF from the ICP-Brasil otherName (OID 2.16.76.1.3.1), when present. */
  cpf?: string;
  notBefore: Date;
  notAfter: Date;
  serialNumber: string;
  /** SHA-256 fingerprint, colon-separated hex. Use it to identify the certificate in logs. */
  fingerprintSha256: string;
}

/** Everything the SDK accepts as signing + mTLS material. */
export type CertificateInput = NfseCertificate | PfxMaterial;

export interface NfseCertificateFromPemInput {
  /** Private key in PEM (PKCS#1 or PKCS#8). */
  key: string | Buffer;
  /** Holder certificate in PEM. */
  cert: string | Buffer;
  /** Passphrase when the PEM key is encrypted. */
  passphrase?: string;
}

/** Environment variable names read by {@link NfseCertificate.fromEnv}. */
export const NFSE_CERT_ENV = {
  path: 'NFSE_CERT_PATH',
  base64: 'NFSE_CERT_BASE64',
  password: 'NFSE_CERT_PASSWORD',
  passwordFile: 'NFSE_CERT_PASSWORD_FILE',
} as const;

/** @internal Material the signer and the HTTPS client need. Never exported from the package root. */
export interface CertificateCredentials {
  privateKey: KeyObject | string;
  certPem: string;
  certDerBase64: string;
  tls: Pick<https.RequestOptions, 'agent' | 'key' | 'cert'>;
}

const ICP_BRASIL_CNPJ_OID = '2.16.76.1.3.3';
const ICP_BRASIL_CPF_OID = '2.16.76.1.3.1';

const secrets = new WeakMap<NfseCertificate, CertificateCredentials>();

function readInfo(certPem: string): NfseCertificateInfo {
  const x509 = new X509Certificate(certPem);
  const forgeCert = forge.pki.certificateFromPem(certPem);
  const commonName = String(forgeCert.subject.getField('CN')?.value ?? x509.subject);
  const { cnpj, cpf } = icpBrasilTaxIds(forgeCert, commonName);
  return {
    subject: commonName,
    issuer: String(forgeCert.issuer.getField('CN')?.value ?? x509.issuer),
    ...(cnpj ? { cnpj } : {}),
    ...(cpf ? { cpf } : {}),
    notBefore: new Date(x509.validFrom),
    notAfter: new Date(x509.validTo),
    serialNumber: x509.serialNumber,
    fingerprintSha256: x509.fingerprint256,
  };
}

/**
 * Reads CNPJ/CPF from the ICP-Brasil subjectAltName otherName fields. Falls
 * back to the `NOME:DOCUMENTO` suffix of the common name used by ICP-Brasil CAs.
 */
export function icpBrasilTaxIds(cert: forge.pki.Certificate, commonName = String(cert.subject.getField('CN')?.value ?? '')): { cnpj?: string; cpf?: string } {
  const found: { cnpj?: string; cpf?: string } = {};
  const extension = cert.getExtension('subjectAltName') as { value?: string } | undefined;
  if (extension?.value) {
    try {
      const generalNames = forge.asn1.fromDer(extension.value).value as forge.asn1.Asn1[];
      for (const name of generalNames) {
        // otherName is context-specific tag [0]: SEQUENCE { type-id OID, [0] EXPLICIT value }
        if (name.tagClass !== forge.asn1.Class.CONTEXT_SPECIFIC || name.type !== 0 || !Array.isArray(name.value)) continue;
        const [oidNode, wrapped] = name.value as forge.asn1.Asn1[];
        if (!oidNode || !wrapped || typeof oidNode.value !== 'string') continue;
        const oid = forge.asn1.derToOid(oidNode.value);
        const inner = Array.isArray(wrapped.value) ? (wrapped.value[0] as forge.asn1.Asn1 | undefined) : undefined;
        const text = typeof inner?.value === 'string' ? inner.value : '';
        if (oid === ICP_BRASIL_CNPJ_OID && /^\d{14}$/.test(text)) found.cnpj = text;
        // ICP-Brasil e-CPF layout: birth date (8) + CPF (11) + ...
        if (oid === ICP_BRASIL_CPF_OID && /^\d{19}/.test(text)) found.cpf = text.slice(8, 19);
      }
    } catch {
      // Non-ICP certificates may carry SANs in other shapes; fall back to the CN.
    }
  }
  if (!found.cnpj && !found.cpf) {
    const suffix = commonName.match(/(?:^|[:\s])(\d{14}|\d{11})$/)?.[1];
    if (suffix?.length === 14) found.cnpj = suffix;
    else if (suffix) found.cpf = suffix;
  }
  return found;
}

function readPasswordFromEnv(env: NodeJS.ProcessEnv): string {
  const file = env[NFSE_CERT_ENV.passwordFile]?.trim();
  if (file) return readFileSync(file, 'utf8').replace(/\r?\n$/, '');
  const password = env[NFSE_CERT_ENV.password];
  if (password === undefined) {
    throw new CertificateValidationError(
      'CERTIFICATE_PASSWORD_MISSING',
      `Defina ${NFSE_CERT_ENV.password} ou ${NFSE_CERT_ENV.passwordFile} com a senha do certificado A1.`,
    );
  }
  return password;
}

function decodeBase64(content: string): Buffer {
  const trimmed = content.trim();
  const payload = trimmed.startsWith('data:') ? trimmed.slice(trimmed.indexOf(',') + 1) : trimmed;
  return Buffer.from(payload.replace(/\s/g, ''), 'base64');
}

/**
 * An A1 (ICP-Brasil) certificate loaded for signing and mTLS.
 *
 * The private key is kept as a non-exportable-by-accident `KeyObject` and a
 * dedicated TLS agent, both held outside the object. The PFX bytes and the
 * password are not retained. `console.log`, `JSON.stringify` and error
 * serializers only ever see {@link NfseCertificateInfo}.
 */
export class NfseCertificate implements NfseCertificateInfo {
  readonly subject!: string;
  readonly issuer!: string;
  readonly cnpj?: string;
  readonly cpf?: string;
  readonly notBefore!: Date;
  readonly notAfter!: Date;
  readonly serialNumber!: string;
  readonly fingerprintSha256!: string;

  private constructor(privateKeyPem: string, certPem: string, certDerBase64: string) {
    Object.assign(this, readInfo(certPem));
    const privateKey = createPrivateKey(privateKeyPem);
    const secureContext = createSecureContext({ key: privateKeyPem, cert: certPem });
    // One agent per certificate: pooled sockets are never shared between tenants.
    const agent = new https.Agent({ keepAlive: true, secureContext });
    secrets.set(this, { privateKey, certPem, certDerBase64, tls: { agent } });
    Object.freeze(this);
  }

  /** Loads a `.pfx`/`.p12` from memory. */
  static fromPfx(pfx: Buffer | Uint8Array, password: string): NfseCertificate {
    let material: Omit<PfxMaterial, 'pfxBuffer'>;
    try {
      material = parsePfx(Buffer.from(pfx), password);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/MAC could not be verified|Invalid password|senha incorreta/i.test(message)) {
        throw new CertificateValidationError('CERTIFICATE_INVALID_PASSWORD', 'Senha do certificado A1 incorreta.');
      }
      throw new CertificateValidationError('CERTIFICATE_UNREADABLE', `Nao foi possivel ler o certificado A1 (.pfx): ${message}`);
    }
    return new NfseCertificate(material.privateKeyPem, material.certPem, material.certDerBase64);
  }

  /** Loads a `.pfx`/`.p12` file from disk. */
  static fromFile(path: string, password: string): NfseCertificate {
    return NfseCertificate.fromPfx(readFileSync(path), password);
  }

  /** Loads a base64-encoded PFX (whitespace and `data:` URLs accepted), the usual format for env vars and secret managers. */
  static fromBase64(content: string, password: string): NfseCertificate {
    return NfseCertificate.fromPfx(decodeBase64(content), password);
  }

  /** Loads a PEM key + certificate pair, e.g. extracted once with `openssl pkcs12 -legacy`. */
  static fromPem(input: NfseCertificateFromPemInput): NfseCertificate {
    let privateKeyPem: string;
    let certPem: string;
    try {
      const key = createPrivateKey({ key: input.key, format: 'pem', ...(input.passphrase !== undefined ? { passphrase: input.passphrase } : {}) });
      privateKeyPem = key.export({ type: 'pkcs8', format: 'pem' }).toString();
      certPem = new X509Certificate(input.cert).toString();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new CertificateValidationError('CERTIFICATE_UNREADABLE', `Nao foi possivel ler a chave/certificado PEM: ${message}`);
    }
    const certDerBase64 = new X509Certificate(certPem).raw.toString('base64');
    return new NfseCertificate(privateKeyPem, certPem, certDerBase64);
  }

  /**
   * Loads the certificate from environment variables:
   * `NFSE_CERT_PATH` or `NFSE_CERT_BASE64`, plus `NFSE_CERT_PASSWORD` or
   * `NFSE_CERT_PASSWORD_FILE` (Docker/Kubernetes secrets).
   */
  static fromEnv(env: NodeJS.ProcessEnv = process.env): NfseCertificate {
    const path = env[NFSE_CERT_ENV.path]?.trim();
    const base64 = env[NFSE_CERT_ENV.base64]?.trim();
    if (!path && !base64) {
      throw new CertificateValidationError(
        'CERTIFICATE_MISSING',
        `Defina ${NFSE_CERT_ENV.path} (arquivo .pfx) ou ${NFSE_CERT_ENV.base64} (PFX em base64).`,
      );
    }
    const password = readPasswordFromEnv(env);
    return path ? NfseCertificate.fromFile(path, password) : NfseCertificate.fromBase64(base64!, password);
  }

  /** Wraps legacy {@link PfxMaterial}; the SDK keeps a `KeyObject`, not the PEM string. */
  static fromMaterial(material: PfxMaterial): NfseCertificate {
    return new NfseCertificate(material.privateKeyPem, material.certPem, material.certDerBase64);
  }

  isValidAt(now = new Date()): boolean {
    return now >= this.notBefore && now < this.notAfter;
  }

  /** Whole days until expiry (negative once expired). Handy for renewal alerts. */
  daysUntilExpiry(now = new Date()): number {
    return Math.floor((this.notAfter.getTime() - now.getTime()) / 86_400_000);
  }

  /** Closes pooled mTLS sockets. Optional; idle sockets do not keep the process alive. */
  destroy(): void {
    const agent = secrets.get(this)?.tls.agent;
    if (agent instanceof https.Agent) agent.destroy();
  }

  toJSON(): NfseCertificateInfo {
    return {
      subject: this.subject,
      issuer: this.issuer,
      ...(this.cnpj ? { cnpj: this.cnpj } : {}),
      ...(this.cpf ? { cpf: this.cpf } : {}),
      notBefore: this.notBefore,
      notAfter: this.notAfter,
      serialNumber: this.serialNumber,
      fingerprintSha256: this.fingerprintSha256,
    };
  }

  [inspect.custom](): string {
    const holder = this.cnpj ? `cnpj=${this.cnpj}` : this.cpf ? `cpf=${this.cpf}` : `subject=${JSON.stringify(this.subject)}`;
    return `NfseCertificate { ${holder}, notAfter=${this.notAfter.toISOString()}, fingerprintSha256=${this.fingerprintSha256} }`;
  }
}

/** @internal Resolves either input shape to signing + TLS material. */
export function resolveCredentials(input: CertificateInput): CertificateCredentials {
  if (input instanceof NfseCertificate) {
    const found = secrets.get(input);
    if (!found) throw new Error('NfseCertificate sem material de chave.');
    return found;
  }
  return {
    privateKey: input.privateKeyPem,
    certPem: input.certPem,
    certDerBase64: input.certDerBase64,
    tls: { key: input.privateKeyPem, cert: input.certPem },
  };
}
