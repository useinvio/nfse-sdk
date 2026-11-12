# @useinvio/nfse-sdk

[![npm version](https://img.shields.io/npm/v/@useinvio/nfse-sdk.svg)](https://www.npmjs.com/package/@useinvio/nfse-sdk)
[![npm access](https://img.shields.io/badge/npm-public-brightgreen.svg)](https://www.npmjs.com/package/@useinvio/nfse-sdk)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-339933.svg)](https://nodejs.org/)

[Website](https://sdk.useinvio.com/)

[English version](./ENGLISH.md)

<img width="959" height="296" alt="image" src="https://github.com/user-attachments/assets/d6c45737-e7ca-4ea7-a06f-d93b7c16e4f0" />

---

SDK TypeScript para integração com a **NFS-e Nacional** (SEFIN).

Transforme JSON em DPS/NFS-e, assine com XMLDSIG, compacte em GZip/Base64 e transmita por mTLS sem escrever XML fiscal na mão.

O SDK cuida da camada protocolar: certificado A1, montagem de DPS, validações estruturais, assinatura XML, compactação, envio, consulta e normalização de rejeições da SEFIN. A aplicação [...]

**Para quem é:** ERPs, SaaS financeiros, plataformas de cobrança, contabilidades digitais e times Node.js/TypeScript que precisam integrar com a NFS-e Nacional.

**O que ele não é:** um motor fiscal, consultor tributário ou substituto da validação contábil do seu produto.

---

## Índice

- [Instalação](#instalação)
- [Quick start](#quick-start)
- [Por que usar](#por-que-usar)
- [Escolhendo o ponto de entrada](#escolhendo-o-ponto-de-entrada)
- [Cliente orientado a recursos](#cliente-orientado-a-recursos)
- [Certificado A1](#certificado-a1)
- [Emitir a partir de XML pronto](#emitir-a-partir-de-xml-pronto)
- [Emitir a partir de JSON declarativo](#emitir-a-partir-de-json-declarativo)
- [Inspecionar o XML antes de enviar](#inspecionar-o-xml-antes-de-enviar)
- [Tratar rejeições da SEFIN](#tratar-rejeições-da-sefin)
- [Consultar uma NFS-e emitida](#consultar-uma-nfs-e-emitida)
- [Recuperar uma emissão após timeout](#recuperar-uma-emissão-após-timeout)
- [Cancelar uma NFS-e](#cancelar-uma-nfs-e)
- [DANFSe (PDF)](#danfse-pdf)
- [Distribuição e parâmetros municipais (ADN)](#distribuição-e-parâmetros-municipais-adn)
- [Timeout e novas tentativas](#timeout-e-novas-tentativas)
- [Série e número da DPS](#série-e-número-da-dps)
- [Ambientes](#ambientes)
- [Agentes de IA e MCP](#agentes-de-ia-e-mcp)
- [Referência da API](#referência-da-api)
- [Desenvolvimento](#desenvolvimento)
- [Publicação no npm](#publicação-no-npm)
- [Exemplos](#exemplos)

---

## Instalação

```bash
npm install @useinvio/nfse-sdk
```

> Node.js ≥ 20 é obrigatório. Não precisa de `xmllint` nem de binários nativos: a validação XSD roda em WebAssembly.

---

## Quick start

O caminho mais comum: emitir uma nota a partir de JSON declarativo.

```ts
import { emitirNfse, EmitirNotaError, NfseCertificate } from '@useinvio/nfse-sdk';

// NFSE_CERT_PATH=./certificado.pfx e NFSE_CERT_PASSWORD=... (veja Certificado A1)
const certificado = NfseCertificate.fromEnv();

const nota = {
  ambiente: 'restrita' as const,
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
    tributacaoMunicipal: {
      tribISSQN: '1',
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
  const resultado = await emitirNfse(nota, certificado);
  console.log(resultado.chaveAcesso); // chave de 50 dígitos
  console.log(resultado.nfseXml);    // XML autorizado pela SEFIN
} catch (error) {
  if (error instanceof EmitirNotaError) {
    for (const rejeicao of error.erros) {
      console.error(rejeicao.Codigo, rejeicao.Descricao);
    }
  }
}
```

---

## Por que usar

- Entrada JSON tipada para construir DPS no layout nacional.
- Assinatura XMLDSIG, GZip/Base64 e mTLS encapsulados em uma API Node.js.
- Erros oficiais da SEFIN preservados em formato estruturado.
- Builder separado para inspecionar ou salvar o XML antes de transmitir.
- Cliente `NfseClient` para configurar certificado, ambiente e defaults uma vez.
- Validação explícita de campos fiscais obrigatórios, sem defaults silenciosos.

---

## Escolhendo o ponto de entrada

| Situação | O que usar |
|---|---|
| Quer uma API de cliente com `client.invoices.create(...)` | `new NfseClient(...)` |
| Outro sistema já gera o XML da DPS | `emitirNfse(xmlString, certificado)` |
| Você monta os dados e quer que a SDK construa o XML | `emitirNfse(notaJson, certificado)` |
| Precisa inspecionar ou salvar o XML antes de enviar | `buildDpsFromJson(nota)` |
| Fluxo customizado (assinar, compactar ou enviar separadamente) | funções de baixo nível |

---

## Cliente orientado a recursos

Use `NfseClient` quando preferir configurar ambiente e certificado uma vez e
emitir notas por recursos, como `client.invoices.create(...)`.

O cliente usa os mesmos campos do JSON declarativo (`prestador`, `servico` e
`emissao`). Os `defaults` seguem o mesmo formato e podem ser sobrescritos em
cada chamada.

```ts
import { NfseCertificate, NfseClient } from '@useinvio/nfse-sdk';

const client = new NfseClient({
  environment: 'sandbox',
  certificate: NfseCertificate.fromEnv(),
  defaults: {
    prestador: {
      cnpj: '12345678000195',
      cLocEmi: '4106902',
      serie: '1601',
      opSimpNac: '1',
      regEspTrib: '0',
    },
    servico: {
      cTribNac: '010201',
      xDescServ: 'Servico ficticio de desenvolvimento de software',
      cLocPrestacao: '4106902',
    },
  },
});

const invoice = await client.invoices.create({
  emissao: {
    nDPS: '1',
    valores: { vServ: '1000.00' },
    tomador: {
      CPF: '00000000000',
      xNome: 'Cliente Exemplo',
      end: {
        endNac: { cMun: '4106902', CEP: '80010000' },
        xLgr: 'Rua Exemplo', nro: '100', xBairro: 'Centro',
      },
    },
    tributacaoMunicipal: {
      tribISSQN: '1',
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

console.log(invoice.chaveAcesso);
console.log(invoice.nfseXml);
```

`environment: 'sandbox'` é alias de `restrita`, e `production` é alias de
`producao`. `certificate` aceita um `NfseCertificate` ou, por compatibilidade,
`{ content, password }` com o PFX em `Buffer` ou base64.

Para inspecionar a DPS gerada sem assinar nem enviar:

```ts
const dps = client.invoices.buildDpsJson({
  prestador: {
    serie: '1701',
  },
  emissao: {
    nDPS: '2',
    valores: { vServ: '2500.00' },
    tributacaoMunicipal: { tribISSQN: '1', tpRetISSQN: '1' },
    totTrib: { pTotTribFed: '0', pTotTribEst: '0', pTotTribMun: '5' },
  },
});
```

---


### Validacao e compatibilidade

`validateDpsJsonRequest(entrada)` retorna `valid`, `issues` (erros), `warnings` (avisos) e uma copia `normalizedPayload`. Campos opcionais devem ser omitidos ou `undefined`; strings vazias, `null` e tipos incorretos sao rejeitados. Consulte [o mapeamento JSON](JSON_MAPPING.md) para os limites de datas e valores.

Divergencias entre `vServ` e a conversao cambial geram avisos, preservando o valor explicito. O mesmo vale para o valor estrangeiro do bloco de comercio exterior. Todos os valores monetarios sao arredondados para duas casas, inclusive `comExt.vServMoeda`; valores de servico que arredondam para zero sao rejeitados. Leia `warnings` antes da emissao quando quiser apresentar esses avisos ao usuario.

`prepararNota` verifica a vigencia do certificado antes de assinar; `transmitirNotaPreparada` verifica novamente antes do envio. `assertCertificateValidity(certificado, now?)` expoe essa verificacao. A checagem de titularidade continua explicita via `assertCertificateForProvider(certificado, documento, now?)`; o SDK nao resolve representacao fiscal.

O ambiente para JSON segue `options.ambiente` → `request.ambiente` → `restrita`, tanto no XML quanto no destino. XML externo usa `tpAmb` e rejeita uma opcao divergente. Notas preparadas tambem precisam ter o mesmo ambiente no XML assinado e no envio.

`client.invoices.get(chaveAcesso, { ambiente: 'producao' })` permite consultar uma emissao feita com sobrescrita de ambiente. Sem opcao, usa `defaults.ambiente` ou o ambiente do construtor. O cliente nao memoriza o ambiente da ultima emissao.

HTTP 2xx sem XML NFS-e bem formado e chave de 50 digitos consistente gera `EmitirNotaError` com codigo `INVALID_AUTHORIZATION_RESPONSE`, preservando corpo, status e DPS. Isso nao confirma rejeicao fiscal: concilie a emissao antes de reenviar. Nao ha retentativa automatica nem verificacao da assinatura da NFS-e recebida.

Veja [as correcoes e mudancas de comportamento](docs/CORRECOES_EMISSAO.md) e os [payloads nacional e exterior testados](examples/payloads.ts). Os exemplos declaram cenarios ilustrativos; a aplicacao escolhe o enquadramento aplicavel.

> **Migracao para 3.0.0:** esta versao tem breaking changes de validacao e resposta de autorizacao. Leia o guia curto em [CORRECOES_EMISSAO.md](docs/CORRECOES_EMISSAO.md) antes de atualizar.

## Certificado A1

Use `NfseCertificate`. Ele lê o `.pfx`/`.p12` uma vez, mantém a chave privada fora do objeto e descarta a senha e os bytes do arquivo. `console.log(certificado)` e `JSON.stringify(certificado)` mostram só CNPJ/CPF, validade e fingerprint.

### Variáveis de ambiente (recomendado)

```bash
NFSE_CERT_PATH=./certificado.pfx   # ou NFSE_CERT_BASE64=<PFX em base64>
NFSE_CERT_PASSWORD=sua-senha       # ou NFSE_CERT_PASSWORD_FILE=/run/secrets/nfse_cert_password
```

```ts
import { NfseCertificate } from '@useinvio/nfse-sdk';

const certificado = NfseCertificate.fromEnv();
console.log(certificado.cnpj, certificado.notAfter, certificado.daysUntilExpiry());
```

`NFSE_CERT_PASSWORD_FILE` lê a senha de um arquivo, o formato de secrets do Docker e do Kubernetes. Nunca versione o `.pfx` nem a senha.

### Outras origens

```ts
NfseCertificate.fromFile('./certificado.pfx', senha);
NfseCertificate.fromBase64(pfxBase64, senha);        // aceita quebras de linha e data: URLs
NfseCertificate.fromPfx(pfxBuffer, senha);           // ex.: PFX vindo do seu cofre de segredos
NfseCertificate.fromPem({ key, cert, passphrase });  // par extraído com openssl
```

### Vários emitentes (multi-tenant)

Crie um `NfseCertificate` por emitente e reaproveite-o. Cada certificado tem o próprio agente mTLS, então conexões nunca são compartilhadas entre emitentes. Guarde o PFX cifrado (KMS, Vault, Secrets Manager) e a senha em um segredo separado, e descriptografe só ao criar o objeto.

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

### Erros de certificado

Todos lançam `CertificateValidationError` com um `code` estável:

| `code` | Quando |
|---|---|
| `CERTIFICATE_INVALID_PASSWORD` | Senha incorreta. |
| `CERTIFICATE_UNREADABLE` | O conteúdo não é um PFX/PEM válido. |
| `CERTIFICATE_MISSING`, `CERTIFICATE_PASSWORD_MISSING` | Variáveis de ambiente ausentes em `fromEnv`. |
| `CERTIFICATE_NOT_YET_VALID`, `CERTIFICATE_EXPIRED` | Fora da vigência. Verificado antes de assinar e antes de enviar. |
| `CERTIFICATE_HOLDER_MISMATCH` | `assertCertificateForProvider` com CPF/CNPJ diferente do titular. |

> `loadPfx` e `loadPfxFromBuffer` continuam funcionando, mas retornam a chave privada em PEM dentro de um objeto comum. Prefira `NfseCertificate`.

---

## Emitir a partir de XML pronto

Use quando outro sistema (ERP, sistema legado) já gera o XML da DPS no layout nacional.

```ts
import { emitirNfse, NfseCertificate } from '@useinvio/nfse-sdk';

const certificado = NfseCertificate.fromEnv();

const resultado = await emitirNfse(dpsXml, certificado, { ambiente: 'restrita' });

console.log(resultado.chaveAcesso);
console.log(resultado.nfseXml);
```

> O XML precisa ter `Id` valido em `<infDPS>` e `tpAmb` consistente com o destino. `options.dpsId` apenas seleciona a referencia de assinatura; nao corrige um XML incompleto nem dispensa o XSD.

---

## Emitir a partir de JSON declarativo

Use quando a aplicação mantém os perfis de prestador e serviço e quer que a SDK monte o XML.

Para a referência completa de campos aceitos no JSON, consulte [JSON_MAPPING.md](./JSON_MAPPING.md).
O builder valida formatos e combinações mínimas antes de gerar XML, mas não escolhe códigos fiscais por você. Campos como `tributacaoMunicipal` e `totTrib` precisam ser informados explicita[...]

```ts
import { emitirNfse, NfseCertificate, type DpsJsonRequest } from '@useinvio/nfse-sdk';

const nota: DpsJsonRequest = {
  ambiente: 'restrita',
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
    tributacaoMunicipal: {
      tribISSQN: '1',
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

const certificado = NfseCertificate.fromEnv();
const resultado = await emitirNfse(nota, certificado);
```

> `pTotTribFed`, `pTotTribEst` e `pTotTribMun` são percentuais com duas casas decimais (ex.: `"5.00"`), diferentes das alíquotas com quatro casas (`pAliq`).
> O shape simplificado legado de `tribNac` é rejeitado: IBS/CBS no layout nacional `v1.01` exige o bloco RTC `IBSCBS`, ainda não implementado nesta SDK.

---

## Inspecionar o XML antes de enviar

Útil para comparar com um XML de referência, salvar snapshots ou depurar rejeições de schema.

```ts
import { buildDpsFromJson } from '@useinvio/nfse-sdk';

const { id, xml } = buildDpsFromJson(nota);

console.log(id);  // ex.: "DPS..."
console.log(xml); // XML não assinado da DPS
```

---

## Tratar rejeições da SEFIN

`emitirNfse` lança `EmitirNotaError` quando a SEFIN retorna HTTP fora de 2xx ou resposta sem XML autorizado.

```ts
import { EmitirNotaError, emitirNfse } from '@useinvio/nfse-sdk';

try {
  await emitirNfse(nota, certificado);
} catch (error) {
  if (!(error instanceof EmitirNotaError)) throw error;

  console.log('HTTP:', error.status);
  console.log('DPS ID:', error.dpsId);

  for (const rejeicao of error.erros) {
    console.log(rejeicao.Codigo);       // código oficial SEFIN
    console.log(rejeicao.Descricao);    // descrição da rejeição
    console.log(rejeicao.Complemento);  // detalhe adicional (quando presente)
  }
}
```

---

## Consultar uma NFS-e emitida

```ts
import { ConsultaNfseError, obterNfse } from '@useinvio/nfse-sdk';

try {
  const nota = await obterNfse(chaveAcesso, certificado, 'restrita');
  console.log(nota.resumo.nNFSe, nota.resumo.cStat, nota.resumo.valores.vLiq);
  console.log(nota.nfseXml); // XML autorizado, já descompactado
} catch (error) {
  if (error instanceof ConsultaNfseError && error.notFound) console.log('NFS-e não existe neste ambiente');
  else throw error;
}
```

`resumo` traz número, situação, emitente, tomador, DPS de origem e valores
(`vServ`, `vBC`, `pAliqAplic`, `vISSQN`, `vTotalRet`, `vLiq`). Para ler um XML
que você já tem, use `lerNfse(xml)`. No cliente: `client.invoices.retrieve(chave)`.
A resposta crua continua disponível em `consultarNfse(...)` / `client.invoices.get(...)`.

---

## Recuperar uma emissão após timeout

`POST /nfse` não é idempotente, por isso o SDK **nunca** repete uma emissão
automaticamente. Se a conexão cair sem resposta, pergunte à SEFIN se a DPS foi
processada antes de reenviar:

```ts
import { prepararNota, recuperarNfsePorDps, transmitirNotaPreparada } from '@useinvio/nfse-sdk';

const nota = prepararNota(dps, certificado); // persista nota.dpsId e nota.signedXml antes de enviar
try {
  return await transmitirNotaPreparada(nota, certificado, { timeoutMs: 30_000 });
} catch (error) {
  if (error instanceof Error && error.name === 'EmitirNotaError') throw error; // rejeição real
  const existente = await recuperarNfsePorDps(nota.dpsId, certificado, nota.ambiente, { retries: 3 });
  return existente ?? transmitirNotaPreparada(nota, certificado); // null: a DPS não chegou à SEFIN
}
```

Veja [`examples/recover-emission.ts`](./examples/recover-emission.ts).

---

## Cancelar uma NFS-e

```ts
import { cancelarNfse, RegistrarEventoError } from '@useinvio/nfse-sdk';

try {
  const evento = await cancelarNfse(
    {
      ambiente: 'restrita',
      chaveAcesso,
      cMotivo: '1', // 1 = erro na emissão, 2 = serviço não prestado, 9 = outros
      xMotivo: 'Nota emitida com valor incorreto', // 15 a 255 caracteres
      // autor: { CNPJ: '...' } // padrão: CNPJ/CPF do titular do certificado
    },
    certificado,
  );
  console.log(evento.pedRegEventoId, evento.eventoXml);
} catch (error) {
  if (error instanceof RegistrarEventoError) console.error(error.status, error.erros);
  else throw error;
}
```

O SDK monta o `pedRegEvento` v1.01, valida contra o XSD oficial, assina
`infPedReg`, compacta e envia em `pedidoRegistroEventoXmlGZipB64`. Para
substituição (e105102), emita a nota substituta e chame
`cancelarNfsePorSubstituicao({ chaveAcesso, chaveSubstituta, cMotivo: '01' }, certificado)`.
Consulte eventos com `consultarEvento(chave, TP_EVENTO.cancelamento, certificado)`
(SEFIN) ou `consultarEventosPorChaveAdn(chave, certificado)` (ADN). Para montar sem
enviar: `buildCancelamentoFromJson(...)` e `buildCancelamentoPorSubstituicaoFromJson(...)`.

---

## DANFSe (PDF)

```ts
import { writeFile } from 'node:fs/promises';
import { baixarDanfse } from '@useinvio/nfse-sdk';

const danfse = await baixarDanfse(chaveAcesso, certificado, 'restrita');
if (danfse.pdf) await writeFile(`danfse-${chaveAcesso}.pdf`, danfse.pdf);
else console.error(danfse.status, danfse.body);
```

O PDF oficial vem do Ambiente de Dados Nacional (ADN), `GET /danfse/{chave}`.

---

## Distribuição e parâmetros municipais (ADN)

| Função | Endpoint (ADN) |
|---|---|
| `distribuirDfePorNsu(nsu, certificado, ambiente?, { cnpjConsulta?, lote? })` | `GET /contribuintes/DFe/{nsu}` |
| `consultarEventosPorChaveAdn(chave, certificado, ambiente?)` | `GET /contribuintes/NFSe/{chave}/Eventos` |
| `consultarConvenio(codMun, certificado, ambiente?)` | `GET /parametrizacao/{codMun}/convenio` |
| `consultarAliquota(codMun, codServico, competencia, ...)` | `GET /parametrizacao/{codMun}/{codServico}/{competencia}/aliquota` |
| `consultarHistoricoAliquotas(codMun, codServico, ...)` | `GET /parametrizacao/{codMun}/{codServico}/historicoaliquotas` |
| `consultarRegimesEspeciais(codMun, codServico, competencia, ...)` | `GET /parametrizacao/{codMun}/{codServico}/{competencia}/regimes_especiais` |
| `consultarRetencoes(codMun, competencia, ...)` | `GET /parametrizacao/{codMun}/{competencia}/retencoes` |
| `consultarBeneficio(codMun, numeroBeneficio, competencia, ...)` | `GET /parametrizacao/{codMun}/{numeroBeneficio}/{competencia}/beneficio` |

Os parâmetros de caminho são validados antes de qualquer chamada de rede
(`SefinParametroInvalidoError`). No cliente: `client.distribution.byNsu(...)` e
`client.municipalParameters.agreement(...)`, `.rate(...)`, `.rateHistory(...)`,
`.specialRegimes(...)`, `.withholdings(...)`, `.benefit(...)`.

---

## Timeout e novas tentativas

Toda função de rede aceita `{ timeoutMs, retries, signal }` (padrão: 60 s, 0 tentativas).
`retries` vale apenas para GETs (erros de rede e HTTP 429/502/503/504, com backoff
exponencial). Emissão e eventos nunca são repetidos. No cliente, configure uma vez
com `new NfseClient({ ..., request: { timeoutMs: 30_000, retries: 2 } })`.

---

## Série e número da DPS

A SEFIN identifica uma DPS pela combinação de prestador, município, `serie` e `nDPS`.

```ts
// série no perfil do prestador (padrão para todas as DPS)
prestador: {
  serie: '1601',
}

// ou por emissão (sobrescreve prestador.serie apenas para esta DPS)
emissao: {
  serie: '1601',
  nDPS: '4',
}
```

O padrão usual é manter uma `serie` fixa e incrementar `nDPS` em cada nova DPS:

```
serie 1601, nDPS 1
serie 1601, nDPS 2
serie 1601, nDPS 3
```

> O Emissor Web usa séries como `70000`. Para emissão via API, use uma série válida para API (ex.: `1601`) e controle o `nDPS` na sua aplicação.

---

## Ambientes

| Chave | SEFIN (emissão, consulta, eventos) | ADN (DANFSe, distribuição, parâmetros) |
|---|---|---|
| `restrita` | `https://sefin.producaorestrita.nfse.gov.br/SefinNacional` | `https://adn.producaorestrita.nfse.gov.br` |
| `producao` | `https://sefin.nfse.gov.br/SefinNacional` | `https://adn.nfse.gov.br` |

```ts
import { resolveSefinBaseUrl } from '@useinvio/nfse-sdk';

const baseUrl = resolveSefinBaseUrl('restrita');
```

---

## Observabilidade da SEFIN

O SDK pode emitir métricas de latência das chamadas mTLS feitas contra a SEFIN quando `NFSE_SEFIN_LATENCY_METRICS=1` está configurada. Por padrão, percentis como `p50Ms`, `p95Ms` e `p99Ms` ficam desligados e precisam de `includePercentiles: true`. Essas métricas medem o round-trip externo da SEFIN, separado da latência total da sua API.

Leia o guia completo em [docs/METRICS.md](./docs/METRICS.md).

---

## Agentes de IA e MCP

O subpath `@useinvio/nfse-sdk/agent` expõe ferramentas neutras de framework para servidores MCP e agentes (OpenAI, LangChain, Vercel AI SDK). Cada ferramenta traz `name`, `description`, `inputSchema`/`outputSchema` em JSON Schema, `annotations` no formato MCP e um handler `run`.

| Ferramenta | Efeito | Certificado |
| --- | --- | --- |
| `validate_dps` | Valida a requisição; nenhum efeito colateral. | Não |
| `build_dps_xml` | Gera o XML não assinado e confere contra o XSD v1.01. | Não |
| `get_nfse` | Consulta uma NFS-e pela chave de acesso. | Sim |

```ts
import { nfseAgentTools } from '@useinvio/nfse-sdk/agent';

const context = { pfx: certificado, ambiente: 'restrita' as const }; // configuração do host
for (const tool of nfseAgentTools) {
  // registre tool.name, tool.description, tool.inputSchema e tool.annotations no seu framework
  // e chame tool.run(argumentos, context) quando o modelo usar a ferramenta
}
```

Certificado e ambiente ficam no `context` do host, nunca na entrada da ferramenta: o modelo não escolhe `producao` nem vê material de chave. Uma requisição com `ambiente` diferente do configurado gera `AMBIENTE_NOT_ALLOWED`. Falhas esperadas retornam `issues` com `code`, `path`, `severity`, `source` e `suggestion`; falhas de infraestrutura (rede, motor XSD) rejeitam a promise. `toAgentIssues(error)` converte erros do SDK (`DpsFiscalValidationError`, `DpsXsdValidationError`, `CertificateValidationError`, `EmitirNotaError`) para esse mesmo formato.

`DPS_JSON_REQUEST_SCHEMA`, exportado também pela raiz do pacote, descreve o `DpsJsonRequest` canônico em JSON Schema 2020-12 com um subconjunto portável de palavras-chave. Ele cobre formatos e domínios de códigos, mas não as regras entre campos (regime × `totTrib`, nacional × exportação); `validateDpsJsonRequest` continua sendo a autoridade. Atalhos legados (`emissao.vServ`, `comExt`) e campos rejeitados pela validação ficam fora do schema; `validate_dps` aponta campos desconhecidos como `UNSUPPORTED_FIELD` em vez de ignorá-los.

A emissão ainda não é exposta como ferramenta: ela exigirá confirmação explícita antes do envio.

---

## Referência da API

### Funções principais

| Função | Descrição |
|---|---|
| `new NfseClient(options)` | Cria cliente com ambiente, certificado e defaults no mesmo formato do JSON declarativo. |
| `emitirNfse(input, certificado, options?)` | Emite uma NFS-e a partir de XML ou JSON. Retorna `ResultadoEmissaoNota`. |
| `obterNfse(chaveAcesso, certificado, ambiente?, options?)` | Consulta a NFS-e e devolve XML descompactado + `resumo` tipado. |
| `recuperarNfsePorDps(dpsId, certificado, ambiente?, options?)` | Recupera a NFS-e de uma DPS após timeout; `null` se não existe. |
| `cancelarNfse(input, certificado, options?)` | Cancela uma NFS-e (e101101). |
| `cancelarNfsePorSubstituicao(input, certificado, options?)` | Cancela por substituição (e105102). |
| `baixarDanfse(chaveAcesso, certificado, ambiente?, options?)` | Baixa o PDF do DANFSe (ADN). |
| `consultarNfse(chaveAcesso, certificado, ambiente?, options?)` | Consulta crua: `{ status, body }`. |
| `consultarDps(dpsId, certificado, ambiente?, options?)` | `GET /dps/{id}` cru. |
| `consultarEvento(chave, tpEvento, certificado, ambiente?, { nSeqEvento? })` | Consulta um evento registrado. |
| `enviarEvento(xmlGzipB64, certificado, chaveAcesso, ambiente?)` | Envia um pedido de evento já assinado e compactado. |
| `buildDpsFromJson(nota)` | Monta o XML da DPS sem assinar nem enviar. |
| `setSefinRequestObserver(observer)` | Registra um hook para observar latência/status das chamadas à SEFIN. |
| `createSefinLatencyTracker(options?)` | Agrega amostras recentes e pode calcular percentis quando `includePercentiles` estiver habilitado. |

### Certificado

| Função | Descrição |
|---|---|
| `assertCertificateValidity(certificado, now?)` | Verifica vigencia do certificado; aplicada na preparacao e no envio. |
| `assertCertificateForProvider(certificado, documento, now?)` | Verifica explicitamente vigencia e correspondencia do titular. |
| `NfseCertificate.fromEnv()` / `fromFile()` / `fromBase64()` / `fromPfx()` / `fromPem()` | Carrega o certificado A1 sem expor a chave privada. |
| `loadPfx(path, password)` | Legado: retorna a chave em PEM. Prefira `NfseCertificate`. |
| `loadPfxFromBuffer(buffer, password)` | Legado: retorna a chave em PEM. Prefira `NfseCertificate`. |

### Funções de baixo nível

| Função | Descrição |
|---|---|
| `signDps(xml, dpsId, certificado)` | Assina XML de DPS com XMLDSIG. |
| `signEnveloped(xml, id, ref, certificado)` | Assina XML genérico (eventos). |
| `verifyDps(xml, certPem)` | Verifica assinatura de uma DPS. |
| `gzipBase64(xml)` | Compacta XML em GZip e codifica em Base64. |
| `gunzipBase64(b64)` | Descompacta resposta GZip/Base64. |
| `lerNfse(xml)` | Lê um XML de NFS-e autorizada em um `NfseResumo` tipado. |
| `validatePedRegEventoXmlAgainstXsd(xml)` | Valida um pedido de evento contra o XSD oficial. |
| `extrairErros(body)` | Normaliza erros oficiais de uma resposta da SEFIN. |
| `resolveSefinBaseUrl(ambiente)` / `resolveAdnBaseUrl(ambiente)` | Retornam as URLs base do ambiente. |

### Tipos exportados

```ts
import type {
  Ambiente,
  CreateInvoiceInput,
  GetInvoiceOptions,
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

### Constantes

```ts
import { SEFIN_BASE_URL, TP_AMB, DEFAULT_AMBIENTE } from '@useinvio/nfse-sdk';
```

---

## Desenvolvimento

```bash
npm install
npm run typecheck   # verifica tipos sem compilar
npm run build       # compila para dist/
npm test            # build + tipos + testes unitários
```

`npm test` também valida as DPS geradas contra os XSD oficiais em `schemas/nfse/v1.01/Schemas/1.01` com o motor embutido (libxml2 em WebAssembly). Se o `xmllint` estiver instalado, como no CI, os testes também o usam como verificação cruzada.

### Uso local em outro projeto

```json
{
  "dependencies": {
    "@useinvio/nfse-sdk": "file:../nfse-sdk"
  }
}
```

---

## Publicação no npm

Pacote publicado publicamente no npm como [`@useinvio/nfse-sdk`](https://www.npmjs.com/package/@useinvio/nfse-sdk).

```bash
npm install
npm run typecheck
npm run build
npm pack --dry-run   # verifica o que será publicado
npm publish
```

O pacote usa `publishConfig.access = public`, necessário para publicar um pacote escopado público no npm.

---

## Exemplos

Exemplos copiáveis ficam em [`examples/`](./examples).

---

## Princípios de design

- Sem dependência de banco de dados, config de aplicação ou estado de tenant.
- Funções pequenas, testáveis e reutilizáveis.
- Erros oficiais da SEFIN são preservados na íntegra, não engolidos.
- O SDK transporta declarações fiscais; não valida se estão contabilmente corretas.
