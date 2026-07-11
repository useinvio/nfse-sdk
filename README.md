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
- [Cancelar uma NFS-e](#cancelar-uma-nfs-e)
- [Consultar eventos](#consultar-eventos)
- [Baixar o DANFSe (PDF)](#baixar-o-danfse-pdf)
- [Distribuição de documentos (ADN)](#distribuição-de-documentos-adn)
- [Parâmetros municipais](#parâmetros-municipais)
- [Série e número da DPS](#série-e-número-da-dps)
- [Ambientes](#ambientes)
- [Timeout e retry](#timeout-e-retry)
- [Referência da API](#referência-da-api)
- [Desenvolvimento](#desenvolvimento)
- [Publicação no npm](#publicação-no-npm)
- [Divulgação e exemplos](#divulgação-e-exemplos)
- [Assistente GPT](#assistente-gpt)

---

## Instalação

```bash
npm install @useinvio/nfse-sdk
```

> Node.js ≥ 20 é obrigatório.

---

## Quick start

O caminho mais comum: emitir uma nota a partir de JSON declarativo.

```ts
import { emitirNfse, loadPfx, EmitirNotaError } from '@useinvio/nfse-sdk';

const pfx = loadPfx('./certificado.pfx', process.env.PFX_PASSWORD!);

const nota = {
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
  const resultado = await emitirNfse(nota, pfx);
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
| Outro sistema já gera o XML da DPS | `emitirNfse(xmlString, pfx)` |
| Você monta os dados e quer que a SDK construa o XML | `emitirNfse(notaJson, pfx)` |
| Precisa inspecionar ou salvar o XML antes de enviar | `buildDpsFromJson(nota)` |
| Precisa cancelar uma NFS-e emitida | `cancelarNfse(...)` ou `client.invoices.cancel(...)` |
| Precisa do PDF da nota (DANFSe) | `baixarDanfse(...)` ou `client.invoices.danfsePdf(...)` |
| Acompanha notas/eventos como tomador (distribuição ADN) | `distribuirDfePorNsu(...)` / `client.distribution.byNsu(...)` |
| Fluxo customizado (assinar, compactar ou enviar separadamente) | funções de baixo nível |

---

## Cliente orientado a recursos

Use `NfseClient` quando preferir configurar ambiente e certificado uma vez e
emitir notas por recursos, como `client.invoices.create(...)`.

O cliente usa os mesmos campos do JSON declarativo (`prestador`, `servico` e
`emissao`). Os `defaults` seguem o mesmo formato e podem ser sobrescritos em
cada chamada.

```ts
import { NfseClient } from '@useinvio/nfse-sdk';

const client = new NfseClient({
  environment: 'sandbox',
  certificate: {
    content: process.env.NFSE_CERTIFICATE!, // PFX em base64
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

console.log(invoice.chaveAcesso);
console.log(invoice.nfseXml);
```

`environment: 'sandbox'` é alias de `restrita`, e `production` é alias de
`producao`. O campo `certificate.content` aceita o conteúdo binário do PFX em
`Buffer` ou o PFX codificado em base64, formato comum para variáveis de
ambiente.

Para inspecionar a DPS gerada sem assinar nem enviar:

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

## Certificado A1

### A partir de arquivo

```ts
import { loadPfx } from '@useinvio/nfse-sdk';

const pfx = loadPfx('./certificado.pfx', process.env.PFX_PASSWORD!);
```

### A partir de buffer (ex.: certificado descriptografado do banco)

```ts
import { loadPfxFromBuffer } from '@useinvio/nfse-sdk';

const pfx = loadPfxFromBuffer(pfxBuffer, password);
```

O objeto `pfx` retornado contém chave privada e certificado em PEM, pronto para assinar e fazer mTLS.

---

## Emitir a partir de XML pronto

Use quando outro sistema (ERP, sistema legado) já gera o XML da DPS no layout nacional.

```ts
import { emitirNfse, loadPfx } from '@useinvio/nfse-sdk';

const pfx = loadPfx('./certificado.pfx', process.env.PFX_PASSWORD!);

const resultado = await emitirNfse(dpsXml, pfx, { ambiente: 'restrita' });

console.log(resultado.chaveAcesso);
console.log(resultado.nfseXml);
```

> O XML precisa ter o atributo `Id` em `<infDPS>`. Se não tiver, passe `options.dpsId` manualmente.

```ts
await emitirNfse(dpsXml, pfx, { dpsId: 'DPS0001', ambiente: 'restrita' });
```

---

## Emitir a partir de JSON declarativo

Use quando a aplicação mantém os perfis de prestador e serviço e quer que a SDK monte o XML.

Para a referência completa de campos aceitos no JSON, consulte [JSON_MAPPING.md](./JSON_MAPPING.md).
O builder valida formatos e combinações mínimas antes de gerar XML, mas não escolhe códigos fiscais por você. Campos como `tributacaoMunicipal` e `totTrib` precisam ser informados explicita[...]

```ts
import { emitirNfse, loadPfx, type DpsJsonRequest } from '@useinvio/nfse-sdk';

const nota: DpsJsonRequest = {
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

const pfx = loadPfx('./certificado.pfx', process.env.PFX_PASSWORD!);
const resultado = await emitirNfse(nota, pfx);
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
  await emitirNfse(nota, pfx);
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
import { consultarNfse } from '@useinvio/nfse-sdk';

const resposta = await consultarNfse(chaveAcesso, pfx, 'restrita');

if (resposta.status === 200) {
  console.log(resposta.body);
} else {
  console.error('Falha na consulta:', resposta.status, resposta.body);
}
```

Quando a emissão sofre timeout e você não sabe se a nota foi gerada, consulte
pelo Id da DPS (45 caracteres) para recuperar a chave de acesso sem risco de
duplicidade:

```ts
import { consultarDps } from '@useinvio/nfse-sdk';

const resposta = await consultarDps(dpsId, pfx, 'restrita');
// via cliente: await client.invoices.getByDpsId(dpsId)
```

---

## Cancelar uma NFS-e

O SDK monta, assina e envia o pedido de registro do evento `e101101`
(Cancelamento de NFS-e). Informe o autor (CNPJ ou CPF), o código do motivo e
uma justificativa de 15 a 255 caracteres:

```ts
import { cancelarNfse, RegistrarEventoError } from '@useinvio/nfse-sdk';

try {
  const resultado = await cancelarNfse(
    {
      ambiente: 'restrita',
      chaveAcesso, // 50 dígitos
      autor: { CNPJ: '12345678000195' },
      cMotivo: '1', // 1 = Erro na Emissão; 2 = Serviço não Prestado; 9 = Outros
      xMotivo: 'Nota emitida com valor incorreto',
    },
    pfx,
  );
  console.log(resultado.eventoXml);
} catch (error) {
  if (error instanceof RegistrarEventoError) {
    console.error(error.status, error.erros);
  }
}
```

Para cancelamento por substituição (`e105102`), use
`cancelarNfsePorSubstituicao(...)` informando também `chaveSubstituta` — a
chave da NFS-e que substitui a cancelada.

Via cliente: `client.invoices.cancel(...)` e
`client.invoices.cancelBySubstitution(...)`.

Para outros tipos de evento, o caminho de baixo nível continua disponível —
assine e envie um `pedRegEvento` próprio:

```ts
import { enviarEvento, gzipBase64, signEnveloped } from '@useinvio/nfse-sdk';

const signedEventXml = signEnveloped(pedRegXml, pedRegId, 'infPedReg', pfx);
const pedRegXmlGZipB64 = gzipBase64(signedEventXml);

const resposta = await enviarEvento(pedRegXmlGZipB64, pfx, chaveAcesso, 'restrita');
```

---

## Consultar eventos

Consulta os eventos registrados para uma NFS-e na SEFIN, por tipo e,
opcionalmente, por número sequencial:

```ts
import { consultarEvento, TP_EVENTO } from '@useinvio/nfse-sdk';

// todos os eventos de cancelamento da nota
const todos = await consultarEvento(chaveAcesso, TP_EVENTO.cancelamento, undefined, pfx, 'restrita');

// um evento específico
const um = await consultarEvento(chaveAcesso, TP_EVENTO.cancelamento, 1, pfx, 'restrita');
```

Via cliente: `client.events.get(chaveAcesso, TP_EVENTO.cancelamento, 1)`.

O XML retornado em `arquivoXml` pode vir em Base64 simples ou duplo; use
`gunzipBase64Flexivel(...)` para decodificar sem se preocupar com o formato.

---

## Baixar o DANFSe (PDF)

```ts
import { baixarDanfse } from '@useinvio/nfse-sdk';
import { writeFile } from 'node:fs/promises';

const danfse = await baixarDanfse(chaveAcesso, pfx, 'restrita');

if (danfse.pdf) {
  await writeFile('danfse.pdf', danfse.pdf);
} else {
  console.error('Falha ao baixar DANFSe:', danfse.status, danfse.body);
}
```

Via cliente: `client.invoices.danfsePdf(chaveAcesso)`.

---

## Distribuição de documentos (ADN)

O Ambiente de Dados Nacional (ADN) distribui, por NSU, os documentos fiscais
vinculados ao CNPJ do certificado — útil para tomadores acompanharem notas
emitidas contra si e para sincronizar eventos:

```ts
import { distribuirDfePorNsu, consultarEventosPorChaveAdn, gunzipBase64Flexivel } from '@useinvio/nfse-sdk';

// documentos a partir do NSU informado (lote)
const lote = await distribuirDfePorNsu(0, pfx, 'restrita', { lote: true });
for (const doc of lote.body?.LoteDFe ?? []) {
  const xml = gunzipBase64Flexivel(doc.ArquivoXml);
}

// todos os eventos de uma chave no ADN
const eventos = await consultarEventosPorChaveAdn(chaveAcesso, pfx, 'restrita');
```

Via cliente: `client.distribution.byNsu(0, { lote: true })` e
`client.events.listByChave(chaveAcesso)`.

---

## Parâmetros municipais

Consultas de parametrização no ADN, úteis para validar dados antes de emitir
(alíquota vigente, convênio do município, regimes especiais e benefícios):

```ts
import {
  consultarAliquota,
  consultarConvenio,
  consultarHistoricoAliquotas,
  consultarRegimesEspeciais,
  consultarBeneficio,
} from '@useinvio/nfse-sdk';

const convenio = await consultarConvenio('4106902', pfx, 'restrita');
const aliquota = await consultarAliquota('4106902', '010201', '2026-07-01', pfx, 'restrita');
const historico = await consultarHistoricoAliquotas('4106902', '010201', pfx, 'restrita');
const regimes = await consultarRegimesEspeciais('4106902', '010201', '2026-07-01', pfx, 'restrita');
const beneficio = await consultarBeneficio('4106902', 'NUMERO_BENEFICIO', '2026-07-01', pfx, 'restrita');
```

Via cliente: `client.municipalParameters.aliquota(...)`, `.convenio(...)`,
`.historicoAliquotas(...)`, `.regimesEspeciais(...)` e `.beneficio(...)`.

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

| Chave | SEFIN | ADN |
|---|---|---|
| `restrita` | `https://sefin.producaorestrita.nfse.gov.br/SefinNacional` | `https://adn.producaorestrita.nfse.gov.br` |
| `producao` | `https://sefin.nfse.gov.br/SefinNacional` | `https://adn.nfse.gov.br` |

```ts
import { resolveSefinBaseUrl, resolveAdnBaseUrl } from '@useinvio/nfse-sdk';

const sefinUrl = resolveSefinBaseUrl('restrita');
const adnUrl = resolveAdnBaseUrl('restrita');
```

---

## Timeout e retry

Todas as funções de transporte aceitam `SefinRequestOptions` como último
parâmetro, e o `NfseClient` aceita o mesmo objeto em `request`:

```ts
const client = new NfseClient({
  certificate,
  request: {
    timeoutMs: 30_000, // default: 60000
    retries: 2,        // default: 0
  },
});

// ou por chamada:
const resposta = await consultarNfse(chaveAcesso, pfx, 'restrita', { timeoutMs: 10_000, retries: 3 });
```

`retries` usa backoff exponencial (0,5s, 1s, 2s, máx. 4s) e se aplica apenas a
consultas GET, que são idempotentes — emissões e eventos (POST) nunca são
repetidos automaticamente para não gerar duplicidade.

---

## Observabilidade da SEFIN

O SDK pode emitir métricas de latência das chamadas mTLS feitas contra a SEFIN quando `NFSE_SEFIN_LATENCY_METRICS=1` está configurada. Por padrão, percentis como `p50Ms`, `p95Ms` e `p99Ms` ficam desligados e precisam de `includePercentiles: true`. Essas métricas medem o round-trip externo da SEFIN, separado da latência total da sua API.

Leia o guia completo em [docs/METRICS.md](./docs/METRICS.md).

---

## Referência da API

### Funções principais

| Função | Descrição |
|---|---|
| `new NfseClient(options)` | Cria cliente com ambiente, certificado e defaults no mesmo formato do JSON declarativo. Recursos: `invoices`, `events`, `distribution`, `municipalParameters`. |
| `emitirNfse(input, pfx, options?)` | Emite uma NFS-e a partir de XML ou JSON. Retorna `ResultadoEmissaoNota`. |
| `cancelarNfse(input, pfx, options?)` | Cancela uma NFS-e (evento e101101): monta, assina e envia o pedido. |
| `cancelarNfsePorSubstituicao(input, pfx, options?)` | Cancela por substituição (evento e105102). |
| `consultarNfse(chaveAcesso, pfx, ambiente?, options?)` | Consulta uma NFS-e pela chave de acesso. |
| `consultarDps(dpsId, pfx, ambiente?, options?)` | Consulta uma NFS-e pelo Id da DPS (idempotência pós-timeout). |
| `consultarEvento(chave, tpEvento, nSeq?, pfx, ambiente?, options?)` | Consulta eventos registrados na SEFIN. |
| `baixarDanfse(chaveAcesso, pfx, ambiente?, options?)` | Baixa o PDF do DANFSe. |
| `distribuirDfePorNsu(nsu, pfx, ambiente?, options?)` | Distribuição de documentos por NSU no ADN. |
| `consultarEventosPorChaveAdn(chave, pfx, ambiente?, options?)` | Todos os eventos de uma chave no ADN. |
| `consultarAliquota / consultarConvenio / consultarHistoricoAliquotas / consultarRegimesEspeciais / consultarBeneficio` | Consultas de parâmetros municipais no ADN. |
| `enviarEvento(xmlGzipB64, pfx, chaveAcesso, ambiente?, options?)` | Envia evento fiscal já assinado/compactado (baixo nível). |
| `buildDpsFromJson(nota)` | Monta o XML da DPS sem assinar nem enviar. |
| `buildCancelamentoFromJson(input)` / `buildCancelamentoPorSubstituicaoFromJson(input)` | Montam o XML do pedRegEvento sem assinar nem enviar. |
| `registrarEvento(built, pfx, options?)` | Assina e envia um `BuiltPedRegEvento`. |
| `setSefinRequestObserver(observer)` | Registra um hook para observar latência/status das chamadas à SEFIN. |
| `createSefinLatencyTracker(options?)` | Agrega amostras recentes e pode calcular percentis quando `includePercentiles` estiver habilitado. |

### Certificado

| Função | Descrição |
|---|---|
| `loadPfx(path, password)` | Carrega certificado A1 a partir de arquivo. |
| `loadPfxFromBuffer(buffer, password)` | Carrega certificado A1 a partir de buffer. |

### Funções de baixo nível

| Função | Descrição |
|---|---|
| `signDps(xml, dpsId, pfx)` | Assina XML de DPS com XMLDSIG. |
| `signEnveloped(xml, id, ref, pfx)` | Assina XML genérico (eventos). |
| `verifyDps(xml)` | Verifica assinatura de uma DPS. |
| `buildPedRegEventoId(chave, tpEvento)` | Monta o Id `PRE` + chave(50) + tpEvento(6) do pedRegEvento. |
| `gzipBase64(xml)` | Compacta XML em GZip e codifica em Base64. |
| `gunzipBase64(b64)` | Descompacta resposta GZip/Base64. |
| `gunzipBase64Flexivel(b64)` | Descompacta payloads em Base64 simples ou duplo (eventos/ADN). |
| `extrairErros(body)` | Normaliza erros oficiais de uma resposta da SEFIN. |
| `resolveSefinBaseUrl(ambiente)` | Retorna a URL base da SEFIN do ambiente. |
| `resolveAdnBaseUrl(ambiente)` | Retorna a URL base do ADN do ambiente. |

### Tipos exportados

```ts
import type {
  Ambiente,
  CancelamentoNfseInput,
  CancelamentoPorSubstituicaoInput,
  CreateInvoiceInput,
  DanfseResposta,
  DpsJsonInput,
  DpsJsonRequest,
  EmitirNotaOptions,
  NfseClientDpsDefaults,
  NfseClientOptions,
  NotaInput,
  PfxMaterial,
  PrestadorProfile,
  ResultadoEmissaoNota,
  ResultadoEvento,
  SefinErro,
  SefinRequestOptions,
  SefinResposta,
  ServicoProfile,
} from '@useinvio/nfse-sdk';
```

### Constantes

```ts
import { SEFIN_BASE_URL, ADN_BASE_URL, TP_AMB, TP_EVENTO, DEFAULT_AMBIENTE } from '@useinvio/nfse-sdk';
```

---

## Desenvolvimento

```bash
npm install
npm run typecheck   # verifica tipos sem compilar
npm run build       # compila para dist/
npm test            # build + tipos + testes unitários
```

`npm test` também valida uma DPS gerada contra os XSD oficiais em `schemas/nfse/v1.01/Schemas/1.01`. Para compatibilidade com `xmllint`, o teste corrige em uma cópia temporária a âncora regex[...]

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

## Divulgação e exemplos

- Exemplos copiáveis ficam em [`examples/`](./examples).
- Material de lançamento, mensagens para redes e prompt de landing page ficam em [`docs/launch.md`](./docs/launch.md).

---

## Assistente GPT

Para criar um GPT que ajude outros devs a implementar e documentar esta SDK, use:

- [`docs/gpt-assistant.md`](./docs/gpt-assistant.md): configuracao completa do GPT, instrucoes copiaveis, starters e testes de preview.
- [`docs/gpt-knowledge.md`](./docs/gpt-knowledge.md): resumo compacto para subir como arquivo de Knowledge.

---

## Princípios de design

- Sem dependência de banco de dados, config de aplicação ou estado de tenant.
- Funções pequenas, testáveis e reutilizáveis.
- Erros oficiais da SEFIN são preservados na íntegra, não engolidos.
- O SDK transporta declarações fiscais; não valida se estão contabilmente corretas.
