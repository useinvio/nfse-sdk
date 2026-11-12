# @useinvio/nfse-sdk

[![npm version](https://img.shields.io/npm/v/@useinvio/nfse-sdk.svg)](https://www.npmjs.com/package/@useinvio/nfse-sdk)
[![CI](https://github.com/useinvio/nfse-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/useinvio/nfse-sdk/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-339933.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

[Website](https://sdk.useinvio.com/) · [Documentação](./docs/README.md) · [English](./README.en.md)

<img width="959" height="296" alt="NFS-e SDK" src="https://github.com/user-attachments/assets/d6c45737-e7ca-4ea7-a06f-d93b7c16e4f0" />

**Emita, consulte e cancele NFS-e Nacional em TypeScript, sem escrever XML fiscal na mão.**

Você descreve a nota em JSON; o SDK monta a DPS, valida contra o XSD oficial,
assina com o certificado A1, compacta, envia por mTLS para a SEFIN e devolve a
resposta oficial em formato estruturado. Sem binários nativos e sem `xmllint`.

## O que ele faz

| Operação | Função | No `NfseClient` |
|---|---|---|
| Emitir a partir de JSON ou XML | `emitirNfse` | `invoices.create` |
| Validar sem enviar (JSON + XSD) | `validateDpsJsonRequest`, `buildDpsFromJson` | `invoices.buildDpsJson` |
| Consultar com resultado tipado | `obterNfse` | `invoices.retrieve` |
| Recuperar uma emissão após timeout | `recuperarNfsePorDps` | `invoices.recover` |
| Cancelar / cancelar por substituição | `cancelarNfse`, `cancelarNfsePorSubstituicao` | `invoices.cancel`, `invoices.cancelBySubstitution` |
| Baixar o DANFSe em PDF | `baixarDanfse` | `invoices.danfse` |
| Distribuição por NSU e parâmetros municipais (ADN) | `distribuirDfePorNsu`, `consultarAliquota`… | `distribution`, `municipalParameters` |
| Ferramentas para agentes de IA e MCP | `@useinvio/nfse-sdk/agent` | – |

## Instalação

```bash
npm install @useinvio/nfse-sdk
```

Node.js 20 ou mais recente. Nada para instalar no sistema: a validação XSD roda
em WebAssembly.

## Em 60 segundos

```bash
NFSE_CERT_PATH=./certificado.pfx
NFSE_CERT_PASSWORD=sua-senha
```

```ts
import { emitirNfse, EmitirNotaError, NfseCertificate } from '@useinvio/nfse-sdk';

const certificado = NfseCertificate.fromEnv(); // a chave privada nunca aparece em logs

const nota = {
  ambiente: 'restrita' as const, // produção restrita: o sandbox oficial
  prestador: {
    cnpj: '12345678000195',
    cLocEmi: '4106902',
    serie: '1601',
    opSimpNac: '1',
    regEspTrib: '0',
  },
  servico: {
    cTribNac: '010201',
    xDescServ: 'Desenvolvimento de software',
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
  const { chaveAcesso, nfseXml } = await emitirNfse(nota, certificado);
  console.log(chaveAcesso); // chave de 50 dígitos
} catch (error) {
  if (!(error instanceof EmitirNotaError)) throw error;
  for (const rejeicao of error.erros) console.error(rejeicao.Codigo, rejeicao.Descricao);
}
```

Primeira vez? Siga o [tutorial](./docs/tutoriais/primeira-nfse.md): emitir,
consultar, baixar o PDF e cancelar na produção restrita, do zero.

## Documentação

| Guia | |
|---|---|
| [Certificado A1](./docs/guias/certificado.md) | Variáveis de ambiente, cofres de segredo, vários emitentes. |
| [Emitir](./docs/guias/emitir.md) | JSON, `NfseClient`, XML pronto, série e número. |
| [Consultar e DANFSe](./docs/guias/consultar.md) | Resultado tipado e PDF. |
| [Recuperar após timeout](./docs/guias/recuperar-emissao.md) | Sem notas duplicadas quando a conexão cai. |
| [Cancelar](./docs/guias/cancelar.md) | e101101 e substituição (e105102). |
| [Erros e rejeições](./docs/guias/rejeicoes.md) | O que cada erro significa e o que fazer. |
| [Agentes de IA e MCP](./docs/guias/agentes-ia.md) | Ferramentas prontas, sem expor o certificado ao modelo. |
| [Referência da API](./docs/referencia/api.md) | Todas as funções. |
| [Mapeamento do JSON](./JSON_MAPPING.md) | Cada campo de `DpsJsonRequest`. |

Exemplos executáveis em [`examples/`](./examples).

## Com agentes de IA

```ts
import { nfseAgentTools } from '@useinvio/nfse-sdk/agent';
```

`validate_dps`, `build_dps_xml` e `get_nfse` vêm com JSON Schema e anotações MCP.
O certificado e o ambiente ficam no host, nunca na entrada da ferramenta. Para
assistentes de código, o pacote inclui [`llms.txt`](./llms.txt).

## O que fica com a sua aplicação

O SDK cuida do protocolo; ele não é um motor fiscal. Códigos de serviço, CST,
alíquotas, retenções, regime tributário e a numeração da DPS são decisões da
sua aplicação e de quem cuida da parte tributária. Campos fiscais obrigatórios
nunca recebem valores padrão silenciosos. O grupo IBS/CBS da reforma tributária
ainda não é suportado.

## Contribuir

Issues e PRs são bem-vindos. Veja [CONTRIBUTING.md](./CONTRIBUTING.md) e o
[CHANGELOG](./CHANGELOG.md).

## Licença

[MIT](./LICENSE) © Invio
