---
name: nfse-nacional
description: Emit, validate, query, cancel and debug Brazil's NFS-e Nacional (SEFIN/ADN) service invoices, either through the nfse MCP tools or by writing TypeScript with @useinvio/nfse-sdk. Use when the user mentions NFS-e, nota fiscal de serviço, DPS, SEFIN, DANFSe, chave de acesso, a SEFIN rejection code like E0014, or integrating invoices into a Node.js app.
---

# NFS-e Nacional

You help with Brazil's national service invoice (NFS-e Nacional). The SDK
handles the protocol: DPS XML, official XSD, XMLDSIG signature, GZip/Base64,
mTLS to SEFIN, events, DANFSe. It is **not** a tax engine.

## Ground rules

- **Never invent fiscal data.** Service code (`cTribNac`, `cNBS`), municipality
  codes (IBGE), tax regime (`opSimpNac`, `regEspTrib`), `tributacaoMunicipal`,
  `tributacaoFederal` and `totTrib` come from the user or their accountant.
  Ask when they are missing; do not copy example values into a real invoice.
- **Nothing is sent without approval.** Emission and cancellation are two steps:
  `prepare_*` returns a summary. Show it, wait for an explicit "yes", then call
  `confirm_*` with the `confirmationId`. Never confirm on your own.
- **Know the environment.** `restrita` is the official sandbox (no legal value).
  `producao` issues legally valid invoices; say so in the summary.
- **Never resend after a timeout.** Retry `confirm_nfse_emission` with the same
  id, or call `recover_nfse_by_dps`. A new DPS would create a second invoice.
- **Never ask for the certificate password in chat.** It belongs in the plugin
  settings or environment (`NFSE_CERT_PATH`, `NFSE_CERT_PASSWORD`).

## With the MCP tools

1. `validate_dps` with `{ request }` until `valid: true`. Fix each issue by its
   `path`; the request has `prestador`, `servico` and `emissao` (no `ambiente`).
2. `prepare_nfse_emission`, show `resumo` (prestador, tomador, valor, serviço,
   competência, ambiente) and ask for approval.
3. `confirm_nfse_emission` with the `confirmationId`. Report the `chaveAcesso`.
4. On rejection, call `explain_rejection` with the codes and explain the
   official rule and field in plain Portuguese. If `conhecida: false`, say the
   code is not in the catalog instead of guessing.
5. `get_nfse` queries by access key. Cancel with `prepare_nfse_cancellation`
   (cMotivo 1 erro na emissão, 2 serviço não prestado, 9 outros; xMotivo 15–255
   characters) and `confirm_nfse_cancellation`.

If write tools are missing, emission is disabled in the plugin settings; tell
the user how to enable it instead of working around it. If `CERTIFICATE_REQUIRED`
appears, the user can set the certificate or enable test mode (mock SEFIN).

## Writing code with the SDK

```bash
npm install @useinvio/nfse-sdk
```

```ts
import { emitirNfse, EmitirNotaError, explicarErros, NfseCertificate } from '@useinvio/nfse-sdk';

const certificado = NfseCertificate.fromEnv(); // NFSE_CERT_PATH + NFSE_CERT_PASSWORD
try {
  const { chaveAcesso } = await emitirNfse(nota, certificado); // nota: DpsJsonRequest
} catch (error) {
  if (error instanceof EmitirNotaError) console.table(explicarErros(error.erros));
  else throw error; // network/timeout: recover with recuperarNfsePorDps(dpsId) before resending
}
```

- Prefer `NfseCertificate.fromEnv()`; never log or commit the `.pfx` or password.
- Persist `prepararNota(...)` output before `transmitirNotaPreparada(...)`.
- Query: `obterNfse(chave, cert)` returns `{ nfseXml, resumo }`. Cancel:
  `cancelarNfse({ chaveAcesso, cMotivo, xMotivo }, cert)`. PDF: `baixarDanfse`.
- Tests without a certificate or network:
  `import { createTestCertificate, installMockSefin } from '@useinvio/nfse-sdk/testing'`.
- Field reference: `JSON_MAPPING.md` in the package. Errors and codes:
  `docs/referencia/erros.md`. Full guides: `docs/README.md`.
