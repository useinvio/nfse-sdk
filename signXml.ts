import { SignedXml } from 'xml-crypto';
import { DOMParser } from '@xmldom/xmldom';
import { resolveCredentials, type CertificateInput } from './certificate.js';

// Algoritmos observados nas NFS-e reais do Sistema Nacional.
// Centralizados aqui para troca fácil caso o ambiente exija variantes.
const SIGNATURE_ALGORITHM = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
const DIGEST_ALGORITHM = 'http://www.w3.org/2001/04/xmlenc#sha256';
const CANON_ALGORITHM = 'http://www.w3.org/2001/10/xml-exc-c14n#WithComments';
const ENVELOPED = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature';

/** Garante declaracao XML UTF-8 antes de compactar/enviar para a SEFIN. */
export function withUtf8XmlDeclaration(xml: string): string {
  const xmlWithoutDeclaration = xml.replace(/^\uFEFF?\s*<\?xml[^?]*\?>\s*/i, '');
  return `<?xml version="1.0" encoding="UTF-8"?>${xmlWithoutDeclaration}`;
}

/**
 * Assina (XMLDSIG enveloped) o elemento de nome local `localName`, referenciando
 * seu Id (URI="#<id>"). A <Signature> é inserida como irmã desse elemento.
 * Usado para infDPS (emissão) e infPedReg (eventos/cancelamento).
 */
export function signEnveloped(
  xml: string,
  refId: string,
  localName: string,
  certificate: CertificateInput,
): string {
  const credentials = resolveCredentials(certificate);
  const xpath = `//*[local-name(.)='${localName}']`;
  const sig = new SignedXml({
    privateKey: credentials.privateKey,
    publicCert: credentials.certPem,
    signatureAlgorithm: SIGNATURE_ALGORITHM,
    canonicalizationAlgorithm: CANON_ALGORITHM,
  });

  sig.addReference({
    xpath,
    transforms: [ENVELOPED, CANON_ALGORITHM],
    digestAlgorithm: DIGEST_ALGORITHM,
    uri: refId,
  });

  // Emite <KeyInfo> com o certificado do titular.
  sig.getKeyInfoContent = () =>
    `<X509Data><X509Certificate>${credentials.certDerBase64}</X509Certificate></X509Data>`;

  sig.computeSignature(xml, { location: { reference: xpath, action: 'after' } });
  return withUtf8XmlDeclaration(sig.getSignedXml());
}

/** Assina a DPS (referência em infDPS). */
export function signDps(xml: string, dpsId: string, certificate: CertificateInput): string {
  return signEnveloped(xml, dpsId, 'infDPS', certificate);
}

/** Valida uma DPS assinada usando o certificado fornecido. Útil em testes. */
export function verifyDps(signedXml: string, certPem: string): boolean {
  const doc = new DOMParser().parseFromString(signedXml, 'text/xml');
  const signature = doc.getElementsByTagName('Signature')[0];
  if (!signature) throw new Error('Nenhuma <Signature> encontrada no XML');
  const sig = new SignedXml({ publicCert: certPem });
  sig.loadSignature(signature as unknown as Node);
  try {
    return sig.checkSignature(signedXml);
  } catch (error) {
    // xml-crypto 6 throws instead of returning false for a wrong key or tampered content.
    if (error instanceof Error && /invalid signature|digest/i.test(error.message)) return false;
    throw error;
  }
}
