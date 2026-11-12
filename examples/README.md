# Examples

Copyable entry points for common NFS-e Nacional flows.

The payloads in `payloads.ts` are shared by these examples and exercised by the JSON/XSD test suite. They include domestic and export declarations. Running the XML generator requires no certificate; the issuing examples do.

## Files

- [`payloads.ts`](./payloads.ts): reusable, tested domestic and export JSON payloads.
- [`generate-dps-xml.ts`](./generate-dps-xml.ts): build an unsigned DPS XML from JSON.
- [`emit-homologation.ts`](./emit-homologation.ts): emit in the restricted/sandbox SEFIN environment.
- [`client-resource.ts`](./client-resource.ts): use `NfseClient` with certificate and defaults configured once.
- [`handle-errors.ts`](./handle-errors.ts): normalize SEFIN rejection details for your application.
- [`cancel-nfse.ts`](./cancel-nfse.ts): download the DANFSe PDF and cancel an NFS-e (event e101101).
- [`recover-emission.ts`](./recover-emission.ts): recover an emission after a timeout with `GET /dps/{id}` instead of resending.

The examples assume Node.js 20+ and a valid A1/PFX certificate, loaded with `NfseCertificate.fromEnv()` from `NFSE_CERT_PATH` (or `NFSE_CERT_BASE64`) and `NFSE_CERT_PASSWORD` (or `NFSE_CERT_PASSWORD_FILE`). They are intentionally explicit about fiscal fields; the SDK does not infer municipal taxation, withholding, CST or total tax burden.
