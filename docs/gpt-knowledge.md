# `@useinvio/nfse-sdk` knowledge pack

Resumo compacto para assistentes de IA que ajudam na implementacao e documentacao desta SDK.

## Posicionamento

`@useinvio/nfse-sdk` e um SDK TypeScript para integracao tecnica com a NFS-e Nacional em Node.js.

Ele cuida da camada protocolar:

- montar DPS/XML a partir de JSON;
- validar estrutura minima e combinacoes tecnicas;
- assinar XML com XMLDSIG;
- compactar XML em GZip/Base64;
- transmitir por mTLS para a SEFIN;
- consultar NFS-e por chave de acesso;
- enviar eventos quando o XML de evento ja esta preparado;
- normalizar erros oficiais da SEFIN.

Ele nao e motor fiscal:

- nao calcula regra municipal;
- nao escolhe codigo de servico;
- nao escolhe CST;
- nao decide retencao;
- nao calcula carga tributaria;
- nao substitui contador, ERP ou validacao fiscal/contabil.

## Instalacao

```bash
npm install @useinvio/nfse-sdk
```

Node.js 20+.

## Principais exports

- `emitirNfse(input, pfx, options?)`
- `NfseClient`
- `buildDpsFromJson(nota)`
- `buildDpsId(prestador, nDPS, serie)`
- `consultarNfse(chaveAcesso, pfx, ambiente?)`
- `enviarEvento(xmlGzipB64, pfx, chaveAcesso, ambiente?)`
- `EmitirNotaError`
- `DpsFiscalValidationError`
- `validateDpsJsonRequest`
- `loadPfx(path, password)`
- `loadPfxFromBuffer(buffer, password)`
- `signDps`
- `signEnveloped`
- `verifyDps`
- `gzipBase64`
- `gunzipBase64`
- `resolveSefinBaseUrl`

## Pontos de entrada

Use `emitirNfse(notaJson, pfx)` quando a aplicacao tem dados em JSON e quer que a SDK monte, assine, compacte e envie a DPS.

Use `new NfseClient(...).invoices.create(...)` quando quiser configurar ambiente, certificado e defaults uma vez.

Use `emitirNfse(dpsXml, pfx, { ambiente, dpsId })` quando outro sistema ja gera XML da DPS.

Use `buildDpsFromJson(nota)` para gerar XML sem assinar nem transmitir.

Use `consultarNfse(chaveAcesso, pfx, ambiente)` para consultar NFS-e emitida.

Use `enviarEvento(...)` para enviar evento fiscal quando o XML de evento ja foi preparado, assinado e compactado.

## Contrato JSON

Formato base:

```ts
type DpsJsonRequest = {
  ambiente?: 'restrita' | 'producao';
  prestador: PrestadorProfile;
  servico: ServicoProfile;
  emissao: DpsJsonInput;
};
```

`prestador` contem dados tecnicos do emissor:

- `cnpj`
- `tpInsc`
- `cLocEmi`
- `serie`
- `opSimpNac`
- `regApTribSN`
- `regEspTrib`

`servico` contem o perfil padrao do servico:

- `cTribNac`
- `xDescServ`
- `cLocPrestacao`
- `cNBS`

`emissao` contem dados da DPS:

- `nDPS`
- `serie`
- `dhEmi`
- `dCompet`
- `valores`
- `servico`
- `tomador`
- `intermediario`
- `tributacaoMunicipal`
- `tributacaoFederal`
- `totTrib`
- `comercioExterior` ou `comExt`
- `obra`
- `xDescServ`

Campos fiscais importantes:

- `emissao.tributacaoMunicipal` e obrigatorio.
- `emissao.tributacaoMunicipal.tribISSQN` e obrigatorio.
- `emissao.tributacaoMunicipal.tpRetISSQN` e obrigatorio.
- `emissao.totTrib` e obrigatorio.
- A SDK nao assume esses campos por default.

## `totTrib`

`totTrib` representa o total aproximado de carga tributaria e deve seguir a regra de escolha do layout. Informe apenas um grupo coerente, por exemplo:

```ts
totTrib: {
  pTotTribFed: '0.00',
  pTotTribEst: '0.00',
  pTotTribMun: '5.00',
}
```

ou:

```ts
totTrib: {
  indTotTrib: '0',
}
```

Nao inventar carga tributaria. Se a aplicacao nao tem esse dado, deve buscar a fonte fiscal correta.

## Exemplo com `emitirNfse`

```ts
import { EmitirNotaError, emitirNfse, loadPfx, type DpsJsonRequest } from '@useinvio/nfse-sdk';

const pfx = loadPfx('./certificado.pfx', process.env.PFX_PASSWORD!);

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
  console.log(resultado.chaveAcesso);
  console.log(resultado.nfseXml);
} catch (error) {
  if (!(error instanceof EmitirNotaError)) throw error;

  for (const rejeicao of error.erros) {
    console.error(rejeicao.Codigo, rejeicao.Descricao);
  }
}
```

## Exemplo com `NfseClient`

```ts
import { NfseClient } from '@useinvio/nfse-sdk';

const client = new NfseClient({
  environment: 'sandbox',
  certificate: {
    content: process.env.NFSE_CERTIFICATE_BASE64!,
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
      xDescServ: 'Desenvolvimento de software',
      cLocPrestacao: '4106902',
      cNBS: '115022000',
    },
  },
});

const invoice = await client.invoices.create({
  emissao: {
    nDPS: '1',
    valores: { vServ: '1000.00' },
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
```

## Serie e `nDPS`

A SEFIN identifica uma DPS pela combinacao de prestador, municipio, `serie` e `nDPS`.

- `serie`: serie de emissao usada para agrupar/sequenciar DPS.
- `nDPS`: numero da DPS dentro daquela serie.

Padrao comum:

```text
serie 1601, nDPS 1
serie 1601, nDPS 2
serie 1601, nDPS 3
```

A aplicacao consumidora deve controlar a sequencia de `nDPS`.

## Ambientes

- `restrita`: ambiente de producao restrita/homologacao.
- `producao`: ambiente de producao.
- No `NfseClient`, `sandbox` e alias de `restrita`.
- No `NfseClient`, `production` e alias de `producao`.

## Erros

`emitirNfse` lanca `EmitirNotaError` quando a SEFIN rejeita a emissao ou retorna resposta sem XML autorizado.

Campos uteis:

- `error.status`
- `error.dpsId`
- `error.erros`
- `error.body`

`error.erros` contem rejeicoes normalizadas:

- `Codigo`
- `Descricao`
- `Complemento`

## Campos nao suportados ou cuidados

- `tribNac` esta tipado por compatibilidade, mas e rejeitado em runtime porque IBS/CBS no layout v1.01 exige bloco RTC `IBSCBS` ainda nao implementado.
- `evento` no JSON da DPS ainda nao deve ser usado como shape de evento fiscal.
- `valores.vDesc` e `valores.vDedRed` sao bloqueados ate refletirem os grupos oficiais corretos do layout.
- `obra.cCM` e legado e bloqueado.
- `cPaisResult` em `tributacaoMunicipal` deve ser usado apenas quando `tribISSQN = '3'`.
- `tpImunidade` deve ser usado apenas quando `tribISSQN = '2'`.
- `pAliq` e bloqueado quando `prestador.opSimpNac = '1'`.

## Boas respostas do assistente

Ao ajudar implementacao, o assistente deve:

- escolher o ponto de entrada correto;
- manter os nomes do JSON da SDK;
- mostrar TypeScript copiavel;
- apontar campos faltantes;
- separar questoes tecnicas de decisoes fiscais;
- nao escolher regra tributaria pelo usuario;
- orientar a usar README, JSON_MAPPING e exemplos.

Ao ajudar documentacao, o assistente deve:

- preservar o posicionamento de SDK protocolar;
- explicar limites fiscais;
- dar exemplos curtos;
- incluir tratamento de erro;
- citar `serie` vs `nDPS` quando relevante.
