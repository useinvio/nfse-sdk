# Emitir uma NFS-e

Há três entradas. Todas assinam, compactam, enviam por mTLS e devolvem
`ResultadoEmissaoNota` (`chaveAcesso`, `dpsId`, `nfseXml`, `status`, `body`).

| Situação | Use |
|---|---|
| Você monta os dados e quer que o SDK gere o XML | `emitirNfse(notaJson, certificado)` |
| Prefere configurar certificado, ambiente e defaults uma vez | `new NfseClient(...)` e `client.invoices.create(...)` |
| Outro sistema já gera o XML da DPS | `emitirNfse(xmlString, certificado)` |

## A partir de JSON declarativo

A referência de campos está em [JSON_MAPPING.md](../../JSON_MAPPING.md) e as
combinações fiscais aceitas em [FISCAL_MATRIX.md](../FISCAL_MATRIX.md). O
builder valida formatos e combinações mínimas antes de gerar XML, mas não
escolhe códigos fiscais por você.

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

const resultado = await emitirNfse(nota, NfseCertificate.fromEnv());
```

> `pTotTribFed`, `pTotTribEst` e `pTotTribMun` são percentuais com duas casas
> (ex.: `"5.00"`), diferentes das alíquotas com quatro casas (`pAliq`). O shape
> simplificado legado de `tribNac` é rejeitado: IBS/CBS exige o bloco RTC
> `IBSCBS`, ainda não implementado.

## Com o cliente

O `NfseClient` usa os mesmos campos (`prestador`, `servico`, `emissao`). Os
`defaults` seguem o mesmo formato e podem ser sobrescritos em cada chamada.

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
    tributacaoMunicipal: { tribISSQN: '1', tpRetISSQN: '1' },
    tributacaoFederal: { piscofins: { CST: '07' } },
    totTrib: { pTotTribFed: '0.00', pTotTribEst: '0.00', pTotTribMun: '5.00' },
  },
});
```

`environment: 'sandbox'` é alias de `restrita`; `production`, de `producao`.
`client.invoices.buildDpsJson(...)` devolve o JSON combinado sem assinar nem enviar.

## A partir de XML pronto

```ts
const resultado = await emitirNfse(dpsXml, certificado, { ambiente: 'restrita' });
```

O XML precisa ter `Id` válido em `<infDPS>` e `tpAmb` igual ao ambiente de envio.
`options.dpsId` só seleciona a referência da assinatura; não corrige um XML
incompleto nem dispensa o XSD.

## Inspecionar o XML antes de enviar

```ts
import { buildDpsFromJson, validateDpsXmlAgainstXsd } from '@useinvio/nfse-sdk';

const { id, xml } = buildDpsFromJson(nota); // XML não assinado
validateDpsXmlAgainstXsd(xml);               // lança DpsXsdValidationError se violar o XSD
```

Para validar o JSON sem lançar erro, use `validateDpsJsonRequest(nota)`: retorna
`valid`, `issues`, `warnings` e uma cópia `normalizedPayload`.

## Preparar e transmitir separadamente

Salve a DPS assinada antes de enviar; assim uma queda de conexão nunca deixa
você sem saber o que foi transmitido.

```ts
import { prepararNota, transmitirNotaPreparada } from '@useinvio/nfse-sdk';

const preparada = prepararNota(nota, certificado); // valida, assina e verifica a assinatura
await salvar(preparada.dpsId, preparada.signedXml);
const resultado = await transmitirNotaPreparada(preparada, certificado);
```

## Série e número da DPS

A SEFIN identifica uma DPS por prestador, município, `serie` e `nDPS`. Mantenha
uma `serie` fixa (em `prestador.serie` ou por emissão em `emissao.serie`) e
incremente `nDPS` a cada nova DPS: `1601/1`, `1601/2`, `1601/3`...

O Emissor Web usa séries como `70000`. Para emissão via API, use uma série
válida para API (ex.: `1601`) e controle o `nDPS` na sua aplicação.

## Regras que o SDK aplica

- Campos opcionais devem ser omitidos ou `undefined`; string vazia, `null` e
  tipos incorretos são rejeitados.
- Valores monetários são arredondados para duas casas; valores de serviço que
  arredondam para zero são rejeitados.
- Divergências entre `vServ` e a conversão cambial viram `warnings`, preservando
  o valor explícito.
- Ambiente para JSON: `options.ambiente` → `request.ambiente` → `restrita`.
- HTTP 2xx sem XML autorizado e chave de 50 dígitos consistente gera
  `EmitirNotaError` com `INVALID_AUTHORIZATION_RESPONSE`. Concilie antes de
  reenviar (veja [Recuperar uma emissão](recuperar-emissao.md)).

Exemplos testados: [`examples/payloads.ts`](../../examples/payloads.ts) traz um
cenário nacional e um de exportação.
