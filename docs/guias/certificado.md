# Configurar o certificado A1

Use `NfseCertificate`. Ele lê o `.pfx`/`.p12` uma vez, mantém a chave privada
fora do objeto e descarta a senha e os bytes do arquivo. `console.log(certificado)`
e `JSON.stringify(certificado)` mostram só CNPJ/CPF, validade e fingerprint.

## Variáveis de ambiente (recomendado)

```bash
NFSE_CERT_PATH=./certificado.pfx   # ou NFSE_CERT_BASE64=<PFX em base64>
NFSE_CERT_PASSWORD=sua-senha       # ou NFSE_CERT_PASSWORD_FILE=/run/secrets/nfse_cert_password
```

```ts
import { NfseCertificate } from '@useinvio/nfse-sdk';

const certificado = NfseCertificate.fromEnv();
console.log(certificado.cnpj, certificado.notAfter, certificado.daysUntilExpiry());
```

`NFSE_CERT_PASSWORD_FILE` lê a senha de um arquivo, o formato de secrets do
Docker e do Kubernetes. Nunca versione o `.pfx` nem a senha: o `.gitignore` do
projeto já ignora `*.pfx`, `*.p12` e `.env*`.

Para gerar o base64 do PFX:

```bash
base64 -i certificado.pfx | tr -d '\n'
```

## Outras origens

```ts
NfseCertificate.fromFile('./certificado.pfx', senha);
NfseCertificate.fromBase64(pfxBase64, senha);        // aceita quebras de linha e data: URLs
NfseCertificate.fromPfx(pfxBuffer, senha);           // ex.: PFX vindo do seu cofre de segredos
NfseCertificate.fromPem({ key, cert, passphrase });  // par extraído com openssl
```

## Vários emitentes (multi-tenant)

Crie um `NfseCertificate` por emitente e reaproveite-o. Cada certificado tem o
próprio agente mTLS, então conexões nunca são compartilhadas entre emitentes.
Guarde o PFX cifrado (KMS, Vault, Secrets Manager) e a senha em um segredo
separado, e descriptografe só ao criar o objeto.

```ts
import { assertCertificateForProvider, NfseCertificate } from '@useinvio/nfse-sdk';

const cache = new Map<string, NfseCertificate>();

async function certificadoDoEmitente(cnpj: string): Promise<NfseCertificate> {
  const cached = cache.get(cnpj);
  if (cached?.isValidAt()) return cached;
  const { pfx, senha } = await cofre.buscarCertificado(cnpj); // seu secret manager
  const certificado = NfseCertificate.fromPfx(pfx, senha);
  assertCertificateForProvider(certificado, cnpj);
  cache.set(cnpj, certificado);
  return certificado;
}
```

## Vigência e titular

- A vigência é verificada antes de assinar e de novo antes de enviar.
- `certificado.daysUntilExpiry()` ajuda a alertar antes do vencimento.
- `assertCertificateForProvider(certificado, documento)` confere se o CNPJ/CPF do
  titular (campos ICP-Brasil ou sufixo `NOME:DOCUMENTO` do CN) é o do emitente.
  É uma chamada explícita: o SDK não resolve procuração nem representação fiscal.

## Erros

Todos lançam `CertificateValidationError` com um `code` estável:

| `code` | Quando |
|---|---|
| `CERTIFICATE_INVALID_PASSWORD` | Senha incorreta. |
| `CERTIFICATE_UNREADABLE` | O conteúdo não é um PFX/PEM válido. |
| `CERTIFICATE_MISSING`, `CERTIFICATE_PASSWORD_MISSING` | Variáveis de ambiente ausentes em `fromEnv`. |
| `CERTIFICATE_NOT_YET_VALID`, `CERTIFICATE_EXPIRED` | Fora da vigência. |
| `CERTIFICATE_HOLDER_MISMATCH` | `assertCertificateForProvider` com CPF/CNPJ diferente do titular. |

## Legado

`loadPfx` e `loadPfxFromBuffer` continuam funcionando, mas retornam a chave
privada em PEM dentro de um objeto comum. Prefira `NfseCertificate`. Em
`NfseClient`, `certificate: { content, password }` também é aceito e é
convertido para `NfseCertificate`.
