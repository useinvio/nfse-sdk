# Examples

Copyable entry points for common NFS-e Nacional flows.

## Files

- [`generate-dps-xml.ts`](./generate-dps-xml.ts): build an unsigned DPS XML from JSON.
- [`emit-homologation.ts`](./emit-homologation.ts): emit in the restricted/sandbox SEFIN environment.
- [`client-resource.ts`](./client-resource.ts): use `NfseClient` with certificate and defaults configured once.
- [`handle-errors.ts`](./handle-errors.ts): normalize SEFIN rejection details for your application.
- [`cancel-nfse.ts`](./cancel-nfse.ts): download the DANFSe PDF, cancel an NFS-e (event e101101), and query the registered event.

The examples assume Node.js 20+ and a valid A1/PFX certificate. They are intentionally explicit about fiscal fields; the SDK does not infer municipal taxation, withholding, CST or total tax burden.
