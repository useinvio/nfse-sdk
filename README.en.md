<div align="center">

<img width="959" height="296" alt="NFS-e SDK" src="https://github.com/user-attachments/assets/d6c45737-e7ca-4ea7-a06f-d93b7c16e4f0" />

# @useinvio/nfse-sdk

**Issue, query and cancel Brazil's national service invoices (NFS-e Nacional) from TypeScript.<br>Without writing a single line of fiscal XML.** 🧾

[![npm version](https://img.shields.io/npm/v/@useinvio/nfse-sdk.svg)](https://www.npmjs.com/package/@useinvio/nfse-sdk)
[![CI](https://github.com/useinvio/nfse-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/useinvio/nfse-sdk/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-339933.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

[Website](https://useinvio.github.io/nfse-sdk/) · [Playground](https://useinvio.github.io/nfse-sdk/playground/) · [Docs (pt-BR)](./docs/README.md) · [Português](./README.md)

</div>

## ✨ How it works

You describe the invoice as JSON. The SDK handles the rest:

```text
JSON  →  DPS  →  official XSD  →  A1 signature  →  GZip  →  mTLS  →  SEFIN  →  typed response
```

No native binaries, no `xmllint`: XSD validation runs in WebAssembly.

Names follow the official Portuguese layout, so a tiny glossary helps: `emitir` is issue, `consultar` is query, `cancelar` is cancel and `chaveAcesso` is the access key.

## 📦 Install

```bash
npm install @useinvio/nfse-sdk
```

You need Node.js 20 or newer. That's it.

## 🚀 Your first invoice

```bash
NFSE_CERT_PATH=./certificate.pfx
NFSE_CERT_PASSWORD=your-password
```

```ts
import { emitirNfse, EmitirNotaError, NfseCertificate } from '@useinvio/nfse-sdk';

const certificate = NfseCertificate.fromEnv(); // the private key never ends up in your logs

const invoice = {
  ambiente: 'restrita' as const, // "produção restrita", the official sandbox
  prestador: { cnpj: '12345678000195', cLocEmi: '4106902', serie: '1601', opSimpNac: '1', regEspTrib: '0' },
  servico: { cTribNac: '010201', xDescServ: 'Software development', cLocPrestacao: '4106902', cNBS: '115022000' },
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
  const { chaveAcesso } = await emitirNfse(invoice, certificate);
  console.log('Invoice issued! 🎉', chaveAcesso);
} catch (error) {
  if (!(error instanceof EmitirNotaError)) throw error;
  for (const rejection of error.erros) console.error(rejection.Codigo, rejection.Descricao);
}
```

No certificate yet? Play with the mock SEFIN right from your terminal:

```bash
npx nfse init && npx nfse emit nota.json --mock
```

Want the full walkthrough? The [tutorial](./docs/tutoriais/primeira-nfse.md) (in Portuguese) takes you from your first invoice all the way to cancelling it.

## 🧰 What's in the box

| | Function | On `NfseClient` |
|---|---|---|
| 🧾 Issue (JSON or XML) | `emitirNfse` | `invoices.create` |
| ✅ Validate without sending | `validateDpsJsonRequest`, `buildDpsFromJson` | `invoices.buildDpsJson` |
| 🔎 Query | `obterNfse` | `invoices.retrieve` |
| 🛟 Recover after a timeout | `recuperarNfsePorDps` | `invoices.recover` |
| ❌ Cancel or replace | `cancelarNfse`, `cancelarNfsePorSubstituicao` | `invoices.cancel`, `invoices.cancelBySubstitution` |
| 📄 Download the DANFSe PDF | `baixarDanfse` | `invoices.danfse` |
| 📬 Distribution and municipal parameters | `distribuirDfePorNsu`, `consultarAliquota`… | `distribution`, `municipalParameters` |
| 💬 Understand rejections | `explicarRejeicao`, [one page per code](./docs/rejeicoes/README.md) | |
| 🧪 Test offline | `@useinvio/nfse-sdk/testing` | |
| ⌨️ Terminal | `npx nfse doctor`, `validate`, `emit`, `explain` | |

POSTs are never retried, so a timeout never turns into a duplicate invoice. Ask `recuperarNfsePorDps` what happened before you resend.

## 🤖 Talk to Claude

```bash
claude mcp add nfse --env NFSE_MCP_MOCK=1 --env NFSE_MCP_ALLOW_WRITE=1 -- npx -y @useinvio/nfse-mcp
```

Or install the plugin, which bundles the server and a skill that knows the workflow:

```text
/plugin install nfse-nacional --marketplace useinvio/nfse-sdk
```

You approve a summary before anything is sent, and the certificate never reaches the model. More in [`mcp/README.md`](./mcp/README.md). Coding assistants get an English API guide in [`llms.txt`](./llms.txt).

## 📚 Docs

The full docs are in Portuguese, just like the official layout and rejection messages:

[Guides](./docs/README.md#guias) ·
[Tutorial](./docs/tutoriais/primeira-nfse.md) ·
[API](./docs/referencia/api.md) ·
[Errors](./docs/referencia/erros.md) ·
[JSON mapping](./JSON_MAPPING.md) ·
[Examples](./examples)

## ⚖️ What stays with you

The SDK speaks the protocol, but it's not a tax engine. Service codes, CST, rates, withholdings, tax regime and DPS numbering are your call (and your accountant's). Required fiscal fields never get a hidden default. The IBS/CBS group from the tax reform isn't supported yet.

## 🤝 Contributing

Issues and PRs are very welcome! Take a look at [CONTRIBUTING.md](./CONTRIBUTING.md) and the [CHANGELOG](./CHANGELOG.md).

<div align="center">

[MIT](./LICENSE) © Invio · made with ☕

</div>
