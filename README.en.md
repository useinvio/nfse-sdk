# @useinvio/nfse-sdk

[![npm version](https://img.shields.io/npm/v/@useinvio/nfse-sdk.svg)](https://www.npmjs.com/package/@useinvio/nfse-sdk)
[![CI](https://github.com/useinvio/nfse-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/useinvio/nfse-sdk/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-339933.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

[Website](https://sdk.useinvio.com/) · [Playground](https://useinvio.github.io/nfse-sdk/) · [Documentation (pt-BR)](./docs/README.md) · [Português](./README.md)

<img width="959" height="296" alt="NFS-e SDK" src="https://github.com/user-attachments/assets/d6c45737-e7ca-4ea7-a06f-d93b7c16e4f0" />

**Issue, query and cancel Brazil's national service invoices (NFS-e Nacional) from TypeScript, without hand-writing fiscal XML.**

You describe the invoice as JSON. The SDK builds the DPS, validates it against
the official XSD, signs it with your A1 certificate, compresses it, sends it to
SEFIN over mTLS and returns the official answer in a structured shape. No native
binaries and no `xmllint`.

## What it does

| Operation | Function | On `NfseClient` |
|---|---|---|
| Issue from JSON or XML | `emitirNfse` | `invoices.create` |
| Validate without sending (JSON + XSD) | `validateDpsJsonRequest`, `buildDpsFromJson` | `invoices.buildDpsJson` |
| Query with a typed result | `obterNfse` | `invoices.retrieve` |
| Recover an emission after a timeout | `recuperarNfsePorDps` | `invoices.recover` |
| Cancel / cancel by substitution | `cancelarNfse`, `cancelarNfsePorSubstituicao` | `invoices.cancel`, `invoices.cancelBySubstitution` |
| Download the DANFSe PDF | `baixarDanfse` | `invoices.danfse` |
| NSU distribution and municipal parameters (ADN) | `distribuirDfePorNsu`, `consultarAliquota`… | `distribution`, `municipalParameters` |
| Explain rejections with the official text | `explicarRejeicao`, `explicarErros`, [one page per code](./docs/rejeicoes/README.md) | – |
| Command line | `npx nfse init`, `doctor`, `validate`, `emit`, `explain` | – |
| Test without a certificate or network | `@useinvio/nfse-sdk/testing` | – |
| MCP server and tools for AI agents | `npx -y @useinvio/nfse-mcp`, `@useinvio/nfse-sdk/agent` | – |

Function and field names follow the official Portuguese layout (`emitir` =
issue, `consultar` = query, `cancelar` = cancel, `chaveAcesso` = access key).

## Install

```bash
npm install @useinvio/nfse-sdk
```

Node.js 20 or newer. Nothing to install on the system: XSD validation runs in WebAssembly.

## In 60 seconds

```bash
NFSE_CERT_PATH=./certificate.pfx
NFSE_CERT_PASSWORD=your-password
```

```ts
import { emitirNfse, EmitirNotaError, NfseCertificate } from '@useinvio/nfse-sdk';

const certificate = NfseCertificate.fromEnv(); // the private key never shows up in logs

const invoice = {
  ambiente: 'restrita' as const, // "produção restrita": the official sandbox
  prestador: {
    cnpj: '12345678000195',
    cLocEmi: '4106902',
    serie: '1601',
    opSimpNac: '1',
    regEspTrib: '0',
  },
  servico: {
    cTribNac: '010201',
    xDescServ: 'Software development',
    cLocPrestacao: '4106902',
    cNBS: '115022000',
  },
  emissao: {
    nDPS: '1',
    dhEmi: '2026-06-15T10:30:00-03:00',
    dCompet: '2026-06-01',
    valores: { vServ: '1500.00' },
    tributacaoMunicipal: { tribISSQN: '1', tpRetISSQN: '1' },
    tributacaoFederal: { piscofins: { CST: '07' } },
    totTrib: { pTotTribFed: '0.00', pTotTribEst: '0.00', pTotTribMun: '5.00' },
  },
};

try {
  const { chaveAcesso, nfseXml } = await emitirNfse(invoice, certificate);
  console.log(chaveAcesso); // 50-digit access key
} catch (error) {
  if (!(error instanceof EmitirNotaError)) throw error;
  for (const rejection of error.erros) console.error(rejection.Codigo, rejection.Descricao);
}
```

## Key ideas

- **Certificate:** `NfseCertificate` keeps the private key out of the object,
  drops the password and exposes only CNPJ/CPF, validity and fingerprint. Each
  certificate gets its own mTLS agent, so tenants never share connections.
- **No blind retries:** issuing and events are POSTs and are never retried. After
  a timeout, `recuperarNfsePorDps(dpsId)` asks SEFIN whether the DPS was
  processed before you resend it. GETs accept `{ retries, timeoutMs, signal }`.
- **Typed errors:** `DpsFiscalValidationError` and `DpsXsdValidationError` before
  sending, `EmitirNotaError` / `RegistrarEventoError` / `ConsultaNfseError` with
  the official SEFIN codes after.
- **Not a tax engine:** service codes, CST, rates, withholdings and DPS numbering
  stay with your application. The IBS/CBS group of the tax reform is not
  supported yet.

## Documentation

The full documentation is in Portuguese, since the official layout, field names
and rejection messages are too:

- [Tutorial: your first NFS-e](./docs/tutoriais/primeira-nfse.md)
- [Guides](./docs/README.md#guias): certificate, issuing, querying, recovery,
  cancellation, errors, timeouts, ADN, AI agents
- [API reference](./docs/referencia/api.md) and [errors](./docs/referencia/erros.md)
- [JSON field mapping](./JSON_MAPPING.md)
- [`llms.txt`](./llms.txt): an English API guide for AI coding assistants
- Runnable [`examples/`](./examples)

## With AI agents

Issue an NFS-e by talking to Claude. Test mode runs a mock SEFIN, so you can try
it without a certificate:

```bash
claude mcp add nfse --env NFSE_MCP_MOCK=1 --env NFSE_MCP_ALLOW_WRITE=1 -- npx -y @useinvio/nfse-mcp
```

Or install the Claude Code plugin (server plus a skill that teaches the workflow):

```text
/plugin install nfse-nacional --marketplace useinvio/nfse-sdk
```

Emission and cancellation always show a summary you approve before anything is
sent, and the certificate never reaches the model. See [`mcp/README.md`](./mcp/README.md).

## Contributing

Issues and PRs are welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md) and the
[CHANGELOG](./CHANGELOG.md).

## License

[MIT](./LICENSE) © Invio
