<div align="center">

<img width="959" height="296" alt="NFS-e SDK" src="https://github.com/user-attachments/assets/d6c45737-e7ca-4ea7-a06f-d93b7c16e4f0" />

# @useinvio/nfse-sdk

**Emita, consulte e cancele NFS-e Nacional em TypeScript.<br>Sem escrever uma linha de XML fiscal.** 🧾

[![npm version](https://img.shields.io/npm/v/@useinvio/nfse-sdk.svg)](https://www.npmjs.com/package/@useinvio/nfse-sdk)
[![CI](https://github.com/useinvio/nfse-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/useinvio/nfse-sdk/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-339933.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

[Site](https://sdk.useinvio.com/) · [Playground](https://useinvio.github.io/nfse-sdk/) · [Documentação](./docs/README.md) · [English](./README.en.md)

</div>

## ✨ Como funciona

Você descreve a nota em JSON. O SDK cuida do resto:

```text
JSON  →  DPS  →  XSD oficial  →  assinatura A1  →  GZip  →  mTLS  →  SEFIN  →  resposta tipada
```

Nada de binário nativo nem `xmllint`: a validação XSD roda em WebAssembly.

## 📦 Instalação

```bash
npm install @useinvio/nfse-sdk
```

Precisa de Node.js 20 ou mais recente. Só isso.

## 🚀 Sua primeira nota

```bash
NFSE_CERT_PATH=./certificado.pfx
NFSE_CERT_PASSWORD=sua-senha
```

```ts
import { emitirNfse, EmitirNotaError, NfseCertificate } from '@useinvio/nfse-sdk';

const certificado = NfseCertificate.fromEnv(); // a chave privada nunca vai parar nos logs

const nota = {
  ambiente: 'restrita' as const, // produção restrita, o sandbox oficial
  prestador: { cnpj: '12345678000195', cLocEmi: '4106902', serie: '1601', opSimpNac: '1', regEspTrib: '0' },
  servico: { cTribNac: '010201', xDescServ: 'Desenvolvimento de software', cLocPrestacao: '4106902', cNBS: '115022000' },
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
  const { chaveAcesso } = await emitirNfse(nota, certificado);
  console.log('Nota emitida! 🎉', chaveAcesso);
} catch (error) {
  if (!(error instanceof EmitirNotaError)) throw error;
  for (const rejeicao of error.erros) console.error(rejeicao.Codigo, rejeicao.Descricao);
}
```

Ainda não tem certificado? Brinque com a SEFIN simulada direto no terminal:

```bash
npx nfse init && npx nfse emit nota.json --mock
```

Quer o passo a passo completo? O [tutorial](./docs/tutoriais/primeira-nfse.md) leva você da primeira emissão até o cancelamento.

## 🧰 O que vem na caixa

| | Função | No `NfseClient` |
|---|---|---|
| 🧾 Emitir (JSON ou XML) | `emitirNfse` | `invoices.create` |
| ✅ Validar sem enviar | `validateDpsJsonRequest`, `buildDpsFromJson` | `invoices.buildDpsJson` |
| 🔎 Consultar | `obterNfse` | `invoices.retrieve` |
| 🛟 Recuperar após timeout | `recuperarNfsePorDps` | `invoices.recover` |
| ❌ Cancelar ou substituir | `cancelarNfse`, `cancelarNfsePorSubstituicao` | `invoices.cancel`, `invoices.cancelBySubstitution` |
| 📄 Baixar o DANFSe | `baixarDanfse` | `invoices.danfse` |
| 📬 Distribuição e parâmetros municipais | `distribuirDfePorNsu`, `consultarAliquota`… | `distribution`, `municipalParameters` |
| 💬 Entender rejeições | `explicarRejeicao`, [uma página por código](./docs/rejeicoes/README.md) | |
| 🧪 Testar sem rede | `@useinvio/nfse-sdk/testing` | |
| ⌨️ Terminal | `npx nfse doctor`, `validate`, `emit`, `explain` | |

## 🤖 Conversando com o Claude

```bash
claude mcp add nfse --env NFSE_MCP_MOCK=1 --env NFSE_MCP_ALLOW_WRITE=1 -- npx -y @useinvio/nfse-mcp
```

Ou instale o plugin, que já traz o servidor e uma skill com o fluxo:

```text
/plugin install nfse-nacional --marketplace useinvio/nfse-sdk
```

Você aprova um resumo antes de qualquer envio, e o certificado nunca chega ao modelo. Mais no [guia de agentes e MCP](./docs/guias/agentes-ia.md) e no [`llms.txt`](./llms.txt).

## 📚 Guias

[Certificado A1](./docs/guias/certificado.md) ·
[Emitir](./docs/guias/emitir.md) ·
[Consultar e DANFSe](./docs/guias/consultar.md) ·
[Recuperar após timeout](./docs/guias/recuperar-emissao.md) ·
[Cancelar](./docs/guias/cancelar.md) ·
[Rejeições](./docs/guias/rejeicoes.md) ·
[CLI](./docs/guias/cli.md) ·
[Testes](./docs/guias/testes.md) ·
[API](./docs/referencia/api.md) ·
[Mapeamento do JSON](./JSON_MAPPING.md) ·
[Exemplos](./examples)

## ⚖️ O que fica com você

O SDK fala o protocolo, mas não é um motor fiscal. Código de serviço, CST, alíquotas, retenções, regime e numeração da DPS são decisões suas (e do seu contador). Campo fiscal obrigatório nunca ganha valor padrão escondido. O grupo IBS/CBS da reforma tributária ainda não é suportado.

## 🤝 Contribuir

Issues e PRs são muito bem vindos! Dá uma olhada no [CONTRIBUTING.md](./CONTRIBUTING.md) e no [CHANGELOG](./CHANGELOG.md).

<div align="center">

[MIT](./LICENSE) © Invio · feito com ☕

</div>
