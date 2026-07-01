# @useinvio/nfse-sdk

SDK TypeScript para integração com a **NFS-e Nacional** (SEFIN).

Cuida de todo o protocolo de comunicação: certificado A1, assinatura XML (XMLDSIG), compactação GZip/Base64, mTLS, envio e consulta. A aplicação que consome o SDK continua responsável pelas regras de negócio — código de serviço, CST, retenções, numeração da DPS.

---

## Índice

- [Instalação](#instalação)
- [Quick start](#quick-start)
- [Escolhendo o ponto de entrada](#escolhendo-o-ponto-de-entrada)
- [Cliente orientado a recursos](#cliente-orientado-a-recursos)
- [Certificado A1](#certificado-a1)
- [Emitir a partir de XML pronto](#emitir-a-partir-de-xml-pronto)
- [Emitir a partir de JSON declarativo](#emitir-a-partir-de-json-declarativo)
- [Inspecionar o XML antes de enviar](#inspecionar-o-xml-antes-de-enviar)
- [Tratar rejeições da SEFIN](#tratar-rejeições-da-sefin)
- [Consultar uma NFS-e emitida](#consultar-uma-nfs-e-emitida)
- [Enviar evento](#enviar-evento-ex-cancelamento)
- [Série e número da DPS](#série-e-número-da-dps)
- [Ambientes](#ambientes)
- [Referência da API](#referência-da-api)
- [Desenvolvimento](#desenvolvimento)
- [Publicação no npm](#publicação-no-npm)

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

## Escolhendo o ponto de entrada

| Situação | O que usar |
|---|---|
| Quer uma API de cliente com `client.invoices.create(...)` | `new NfseClient(...)` |
| Outro sistema já gera o XML da DPS | `emitirNfse(xmlString, pfx)` |
| Você monta os dados e quer que a SDK construa o XML | `emitirNfse(notaJson, pfx)` |
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
O builder valida formatos e combinações mínimas antes de gerar XML, mas não escolhe códigos fiscais por você. Campos como `tributacaoMunicipal` e `totTrib` precisam ser informados explicitamente; a SDK não assume tributação nem carga tributária por default.

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

---

## Enviar evento (ex.: cancelamento)

```ts
import { enviarEvento, gzipBase64, signEnveloped } from '@useinvio/nfse-sdk';

const signedEventXml = signEnveloped(pedRegXml, pedRegId, 'infPedReg', pfx);
const pedRegXmlGZipB64 = gzipBase64(signedEventXml);

const resposta = await enviarEvento(pedRegXmlGZipB64, pfx, chaveAcesso, 'restrita');
```

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

| Chave | URL |
|---|---|
| `restrita` | `https://sefin.producaorestrita.nfse.gov.br/SefinNacional` |
| `producao` | `https://sefin.nfse.gov.br/SefinNacional` |

```ts
import { resolveSefinBaseUrl } from '@useinvio/nfse-sdk';

const baseUrl = resolveSefinBaseUrl('restrita');
```

---

## Referência da API

### Funções principais

| Função | Descrição |
|---|---|
| `new NfseClient(options)` | Cria cliente com ambiente, certificado e defaults no mesmo formato do JSON declarativo. |
| `emitirNfse(input, pfx, options?)` | Emite uma NFS-e a partir de XML ou JSON. Retorna `ResultadoEmissaoNota`. |
| `consultarNfse(chaveAcesso, pfx, ambiente?)` | Consulta uma NFS-e pela chave de acesso. |
| `enviarEvento(xmlGzipB64, pfx, chaveAcesso, ambiente?)` | Envia evento fiscal (cancelamento, etc.). |
| `buildDpsFromJson(nota)` | Monta o XML da DPS sem assinar nem enviar. |

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
| `gzipBase64(xml)` | Compacta XML em GZip e codifica em Base64. |
| `gunzipBase64(b64)` | Descompacta resposta GZip/Base64. |
| `extrairErros(body)` | Normaliza erros oficiais de uma resposta da SEFIN. |
| `resolveSefinBaseUrl(ambiente)` | Retorna a URL base do ambiente. |

### Tipos exportados

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

`npm test` também valida uma DPS gerada contra os XSD oficiais em `schemas/nfse/v1.01/Schemas/1.01`. Para compatibilidade com `xmllint`, o teste corrige em uma cópia temporária a âncora regex de `TSSerieDPS` presente no XSD oficial; os arquivos baixados do gov.br ficam preservados sem alteração.

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

```bash
npm install
npm run typecheck
npm run build
npm pack --dry-run   # verifica o que será publicado
npm publish
```

O pacote usa `publishConfig.access = public`, necessário para publicar um pacote escopado público no npm.

---

## Princípios de design

- Sem dependência de banco de dados, config de aplicação ou estado de tenant.
- Funções pequenas, testáveis e reutilizáveis.
- Erros oficiais da SEFIN são preservados na íntegra, não engolidos.
- O SDK transporta declarações fiscais; não valida se estão contabilmente corretas.
