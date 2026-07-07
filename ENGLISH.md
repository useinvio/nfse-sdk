# @useinvio/nfse-sdk

[![npm version](https://img.shields.io/npm/v/@useinvio/nfse-sdk.svg)](https://www.npmjs.com/package/@useinvio/nfse-sdk)
[![npm access](https://img.shields.io/badge/npm-public-brightgreen.svg)](https://www.npmjs.com/package/@useinvio/nfse-sdk)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-339933.svg)](https://nodejs.org/)

[Website](https://sdk.useinvio.com/)

<img width="959" height="296" alt="NFS-e SDK preview" src="https://github.com/user-attachments/assets/d6c45737-e7ca-4ea7-a06f-d93b7c16e4f0" />

---

TypeScript SDK for integrating Node.js applications with Brazil's **NFS-e Nacional** platform.

Build DPS XML from typed JSON, sign it with XMLDSIG, compress it with GZip/Base64, send it through mTLS, query issued invoices, submit events, and preserve SEFIN rejection details in a structured format.

The SDK handles the protocol layer: A1 certificates, DPS assembly, structural validation, XML signatures, compression, submission, consultation, and SEFIN error normalization. Your application remains responsible for tax decisions, accounting rules, tenant state, numbering, and business validation.

**Built for:** ERPs, financial SaaS products, billing platforms, digital accounting tools, and Node.js/TypeScript teams that need to integrate with NFS-e Nacional.

**Not built for:** replacing fiscal/accounting validation or choosing tax codes for your product.

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Why Use This SDK](#why-use-this-sdk)
- [Choosing an Entry Point](#choosing-an-entry-point)
- [Resource-Oriented Client](#resource-oriented-client)
- [A1 Certificate](#a1-certificate)
- [Issue from Existing XML](#issue-from-existing-xml)
- [Issue from Declarative JSON](#issue-from-declarative-json)
- [Inspect XML Before Sending](#inspect-xml-before-sending)
- [Handle SEFIN Rejections](#handle-sefin-rejections)
- [Query an Issued NFS-e](#query-an-issued-nfs-e)
- [Send Events](#send-events)
- [DPS Series and Number](#dps-series-and-number)
- [Environments](#environments)
- [API Reference](#api-reference)
- [Development](#development)
- [Publishing](#publishing)
- [Design Principles](#design-principles)

---

## Installation

```bash
npm install @useinvio/nfse-sdk
```

Node.js 20 or newer is required.

---

## Quick Start

The most common flow is issuing an invoice from declarative JSON:

```ts
import { EmitirNotaError, emitirNfse, loadPfx } from '@useinvio/nfse-sdk';

const pfx = loadPfx('./certificate.pfx', process.env.PFX_PASSWORD!);

const invoice = {
  ambiente: 'restrita' as const,
  prestador: {
    cnpj: '12345678000195',
    tpInsc: '2',
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
    tributacaoMunicipal: {
      tribISSQN: '3',
      cPaisResult: 'BR',
      tpRetISSQN: '1',
    },
    tributacaoFederal: {
      piscofins: { CST: '07' },
    },
    totTrib: {
      pTotTribFed: '0.00',
      pTotTribEst: '0.00',
      pTotTribMun: '5.00',
    },
  },
};

try {
  const result = await emitirNfse(invoice, pfx);
  console.log(result.chaveAcesso);
  console.log(result.nfseXml);
} catch (error) {
  if (error instanceof EmitirNotaError) {
    for (const rejection of error.erros) {
      console.error(rejection.Codigo, rejection.Descricao);
    }
  }
}
```

---

## Why Use This SDK

- Typed JSON input for generating DPS XML in the national layout.
- XMLDSIG signing, GZip/Base64 compression, and mTLS wrapped in a Node.js API.
- Official SEFIN errors preserved in a structured shape.
- A standalone builder for inspecting, snapshotting, or storing XML before submission.
- `NfseClient` for configuring certificate, environment, and defaults once.
- Explicit validation of required fiscal fields, without silent fiscal defaults.

---

## Choosing an Entry Point

| Situation | Use |
|---|---|
| You want a client API such as `client.invoices.create(...)` | `new NfseClient(...)` |
| Another system already generates DPS XML | `emitirNfse(xmlString, pfx)` |
| You keep invoice data and want the SDK to build XML | `emitirNfse(invoiceJson, pfx)` |
| You need to inspect or save XML before sending | `buildDpsFromJson(invoice)` |
| You need a custom flow for signing, compression, or transport | Low-level helpers |

---

## Resource-Oriented Client

Use `NfseClient` when you want to configure the environment and certificate once, then issue invoices through resources such as `client.invoices.create(...)`.

The client uses the same declarative JSON fields (`prestador`, `servico`, and `emissao`). Defaults use the same shape and can be overridden per call.

```ts
import { NfseClient } from '@useinvio/nfse-sdk';

const client = new NfseClient({
  environment: 'sandbox',
  certificate: {
    content: process.env.NFSE_CERTIFICATE!,
    password: process.env.NFSE_CERTIFICATE_PASSWORD!,
  },
  defaults: {
    prestador: {
      cnpj: '12345678000195',
      tpInsc: '2',
      cLocEmi: '4106902',
      serie: '1601',
      opSimpNac: '1',
      regEspTrib: '0',
    },
    servico: {
      cTribNac: '010201',
      xDescServ: 'Software development',
      cLocPrestacao: '4106902',
    },
  },
});

const issued = await client.invoices.create({
  emissao: {
    nDPS: '1',
    valores: { vServ: '1000.00' },
    tomador: {
      CPF: '00000000000',
      xNome: 'Example Customer',
    },
    tributacaoMunicipal: {
      tribISSQN: '3',
      tpRetISSQN: '1',
    },
    tributacaoFederal: {
      piscofins: { CST: '07' },
    },
    totTrib: {
      pTotTribFed: '0.00',
      pTotTribEst: '0.00',
      pTotTribMun: '5.00',
    },
  },
});

console.log(issued.chaveAcesso);
console.log(issued.nfseXml);
```

`environment: 'sandbox'` is an alias for `restrita`, and `production` is an alias for `producao`. `certificate.content` accepts either a `Buffer` with the binary PFX contents or a base64-encoded PFX string, which is convenient for environment variables.

To inspect the generated DPS without signing or sending it:

```ts
const dps = client.invoices.buildDpsJson({
  prestador: {
    serie: '1701',
  },
  emissao: {
    nDPS: '2',
    valores: { vServ: '2500.00' },
  },
});
```

---

## A1 Certificate

### From a file

```ts
import { loadPfx } from '@useinvio/nfse-sdk';

const pfx = loadPfx('./certificate.pfx', process.env.PFX_PASSWORD!);
```

### From a buffer

```ts
import { loadPfxFromBuffer } from '@useinvio/nfse-sdk';

const pfx = loadPfxFromBuffer(pfxBuffer, password);
```

The returned `pfx` object contains the private key and certificate in PEM format, ready for XML signing and mTLS requests.

---

## Issue from Existing XML

Use this when another system already generates DPS XML in the national layout.

```ts
import { emitirNfse, loadPfx } from '@useinvio/nfse-sdk';

const pfx = loadPfx('./certificate.pfx', process.env.PFX_PASSWORD!);

const result = await emitirNfse(dpsXml, pfx, { ambiente: 'restrita' });

console.log(result.chaveAcesso);
console.log(result.nfseXml);
```

The XML must include an `Id` attribute on `<infDPS>`. If it does not, pass `options.dpsId` manually:

```ts
await emitirNfse(dpsXml, pfx, { dpsId: 'DPS0001', ambiente: 'restrita' });
```

---

## Issue from Declarative JSON

Use this when your application stores provider and service profiles and you want the SDK to build DPS XML.

For the complete JSON field mapping, see [JSON_MAPPING.md](./JSON_MAPPING.md).

The builder validates required formats and minimal fiscal combinations before generating XML, but it does not choose fiscal codes for you. Fields such as `tributacaoMunicipal` and `totTrib` must be supplied explicitly.

```ts
import { emitirNfse, loadPfx, type DpsJsonRequest } from '@useinvio/nfse-sdk';

const invoice: DpsJsonRequest = {
  ambiente: 'restrita',
  prestador: {
    cnpj: '12345678000195',
    tpInsc: '2',
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
    tributacaoMunicipal: {
      tribISSQN: '3',
      cPaisResult: 'BR',
      tpRetISSQN: '1',
    },
    tributacaoFederal: {
      piscofins: { CST: '07' },
    },
    totTrib: {
      pTotTribFed: '0.00',
      pTotTribEst: '0.00',
      pTotTribMun: '5.00',
    },
  },
};

const pfx = loadPfx('./certificate.pfx', process.env.PFX_PASSWORD!);
const result = await emitirNfse(invoice, pfx);
```

`pTotTribFed`, `pTotTribEst`, and `pTotTribMun` are two-decimal percentages, for example `"5.00"`. They are different from four-decimal tax rates such as `pAliq`.

The legacy simplified `tribNac` shape is rejected. IBS/CBS in the national `v1.01` layout requires the RTC `IBSCBS` block, which this SDK does not implement yet.

---

## Inspect XML Before Sending

This is useful for comparing against reference XML, saving snapshots, or debugging schema rejections.

```ts
import { buildDpsFromJson } from '@useinvio/nfse-sdk';

const { id, xml } = buildDpsFromJson(invoice);

console.log(id);
console.log(xml);
```

---

## Handle SEFIN Rejections

`emitirNfse` throws `EmitirNotaError` when SEFIN returns a non-2xx HTTP response or a response without authorized XML.

```ts
import { EmitirNotaError, emitirNfse } from '@useinvio/nfse-sdk';

try {
  await emitirNfse(invoice, pfx);
} catch (error) {
  if (!(error instanceof EmitirNotaError)) throw error;

  console.log('HTTP:', error.status);
  console.log('DPS ID:', error.dpsId);

  for (const rejection of error.erros) {
    console.log(rejection.Codigo);
    console.log(rejection.Descricao);
    console.log(rejection.Complemento);
  }
}
```

---

## Query an Issued NFS-e

```ts
import { consultarNfse } from '@useinvio/nfse-sdk';

const response = await consultarNfse(chaveAcesso, pfx, 'restrita');

if (response.status === 200) {
  console.log(response.body);
} else {
  console.error('Query failed:', response.status, response.body);
}
```

---

## Send Events

For example, to send a cancellation event:

```ts
import { enviarEvento, gzipBase64, signEnveloped } from '@useinvio/nfse-sdk';

const signedEventXml = signEnveloped(pedRegXml, pedRegId, 'infPedReg', pfx);
const pedRegXmlGZipB64 = gzipBase64(signedEventXml);

const response = await enviarEvento(pedRegXmlGZipB64, pfx, chaveAcesso, 'restrita');
```

---

## DPS Series and Number

SEFIN identifies a DPS through provider data, municipality, `serie`, and `nDPS`.

```ts
// Provider-level series, used as the default for every DPS.
prestador: {
  serie: '1601',
}

// Per-issue series, overriding prestador.serie for this DPS only.
emissao: {
  serie: '1601',
  nDPS: '4',
}
```

A typical setup keeps a fixed `serie` and increments `nDPS` for each new DPS:

```text
serie 1601, nDPS 1
serie 1601, nDPS 2
serie 1601, nDPS 3
```

The official Web Issuer may use series such as `70000`. For API issuing, use an API-valid series such as `1601` and control `nDPS` in your application.

---

## Environments

| Key | URL |
|---|---|
| `restrita` | `https://sefin.producaorestrita.nfse.gov.br/SefinNacional` |
| `producao` | `https://sefin.nfse.gov.br/SefinNacional` |

```ts
import { resolveSefinBaseUrl } from '@useinvio/nfse-sdk';

const baseUrl = resolveSefinBaseUrl('restrita');
```

---

## API Reference

### Main APIs

| API | Description |
|---|---|
| `new NfseClient(options)` | Creates a client with environment, certificate, and JSON-shaped defaults. |
| `emitirNfse(input, pfx, options?)` | Issues an NFS-e from XML or JSON and returns `ResultadoEmissaoNota`. |
| `consultarNfse(chaveAcesso, pfx, ambiente?)` | Queries an NFS-e by access key. |
| `enviarEvento(xmlGzipB64, pfx, chaveAcesso, ambiente?)` | Sends a fiscal event such as cancellation. |
| `buildDpsFromJson(invoice)` | Builds DPS XML without signing or sending it. |

### Certificates

| API | Description |
|---|---|
| `loadPfx(path, password)` | Loads an A1 certificate from a file. |
| `loadPfxFromBuffer(buffer, password)` | Loads an A1 certificate from a buffer. |

### Low-Level Helpers

| API | Description |
|---|---|
| `signDps(xml, dpsId, pfx)` | Signs DPS XML with XMLDSIG. |
| `signEnveloped(xml, id, ref, pfx)` | Signs generic XML such as event payloads. |
| `verifyDps(xml)` | Verifies a DPS signature. |
| `gzipBase64(xml)` | Compresses XML with GZip and encodes it as Base64. |
| `gunzipBase64(b64)` | Decodes and decompresses a GZip/Base64 payload. |
| `extrairErros(body)` | Normalizes official SEFIN errors from a response body. |
| `resolveSefinBaseUrl(ambiente)` | Returns the base URL for an environment. |

### Exported Types

```ts
import type {
  Ambiente,
  CreateInvoiceInput,
  DpsJsonInput,
  DpsJsonRequest,
  EmitirNotaOptions,
  NfseClientDpsDefaults,
  NfseClientOptions,
  NotaInput,
  PfxMaterial,
  PrestadorProfile,
  ResultadoEmissaoNota,
  SefinErro,
  SefinResposta,
  ServicoProfile,
} from '@useinvio/nfse-sdk';
```

### Constants

```ts
import { DEFAULT_AMBIENTE, SEFIN_BASE_URL, TP_AMB } from '@useinvio/nfse-sdk';
```

---

## Development

```bash
npm install
npm run typecheck
npm run build
npm test
```

`npm test` also validates generated DPS XML against the official NFS-e Nacional v1.01 XSD files in `schemas/nfse/v1.01/Schemas/1.01`.

### Local Usage from Another Project

```json
{
  "dependencies": {
    "@useinvio/nfse-sdk": "file:../nfse-sdk"
  }
}
```

---

## Publishing

This package is publicly published on npm as [`@useinvio/nfse-sdk`](https://www.npmjs.com/package/@useinvio/nfse-sdk).

```bash
npm install
npm run typecheck
npm run build
npm pack --dry-run
npm publish
```

The package uses `publishConfig.access = public`, which is required for public scoped packages on npm.

---

## Design Principles

- No dependency on databases, app configuration, or tenant state.
- Small, testable, reusable functions.
- Official SEFIN errors are preserved instead of being swallowed.
- The SDK transports fiscal declarations; it does not decide whether they are fiscally or accounting-wise correct.
