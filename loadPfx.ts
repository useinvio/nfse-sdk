import { readFileSync } from 'node:fs';
import forge from 'node-forge';

export interface PfxMaterial {
  /** Chave privada em PEM (PKCS#8/PKCS#1) */
  privateKeyPem: string;
  /** Certificado do titular em PEM */
  certPem: string;
  /** Certificado em DER base64 (sem cabeçalhos PEM), p/ <X509Certificate> */
  certDerBase64: string;
  /** Buffer bruto do .pfx, para uso no handshake mTLS */
  pfxBuffer: Buffer;
}

/**
 * Lê um certificado ICP-Brasil A1 (.pfx/PKCS#12) e extrai a chave privada e o
 * certificado do titular. Usado tanto para a assinatura XMLDSIG quanto para o
 * mTLS (via pfxBuffer).
 */
/** Load from an in-memory buffer (used for decrypted certs in multi-tenant flow). */
export function loadPfxFromBuffer(pfxBuffer: Buffer, password: string): PfxMaterial {
  return parsePfx(pfxBuffer, password);
}

export function loadPfx(pfxPath: string, password: string): PfxMaterial {
  const pfxBuffer = readFileSync(pfxPath);
  return parsePfx(pfxBuffer, password);
}

function parsePfx(pfxBuffer: Buffer, password: string): PfxMaterial {
  const p12Der = forge.util.createBuffer(pfxBuffer.toString('binary'));
  const p12Asn1 = forge.asn1.fromDer(p12Der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

  // Chave privada
  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];
  if (!keyBag?.key) throw new Error('Chave privada não encontrada no .pfx (senha incorreta?)');
  const privateKeyPem = forge.pki.privateKeyToPem(keyBag.key);

  // Certificado do titular: o que casa com a chave (não-CA, com o CNPJ)
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const certs = certBags[forge.pki.oids.certBag] ?? [];
  const isCa = (b: forge.pkcs12.Bag): boolean => {
    const ext = b.cert?.getExtension('basicConstraints') as { cA?: boolean } | undefined;
    return ext?.cA === true;
  };
  const holder = certs.find((b) => b.cert && !isCa(b)) ?? certs[0];
  if (!holder?.cert) throw new Error('Certificado do titular não encontrado no .pfx');

  const certPem = forge.pki.certificateToPem(holder.cert);
  const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(holder.cert)).getBytes();
  const certDerBase64 = forge.util.encode64(certDer);

  return { privateKeyPem, certPem, certDerBase64, pfxBuffer };
}
