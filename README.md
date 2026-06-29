# @nfse-tools/nfse-sdk

SDK TypeScript para a camada tecnica de integracao com a NFS-e Nacional.

O pacote cuida apenas do protocolo de comunicacao com o ambiente nacional da
NFS-e: certificado A1, assinatura XML, gzip/base64, mTLS, envio, consulta,
eventos e normalizacao de respostas. Ele nao acessa banco de dados, nao guarda
certificados e nao implementa regras comerciais da aplicacao que o consome.

## Status

Este repositorio publica o pacote npm:

```text
@nfse-tools/nfse-sdk
```

Repositorio:

```text
https://github.com/nfse-tools/nfse-sdk
```

## Instalacao

Como pacote publicado:

```bash
npm install @nfse-tools/nfse-sdk
```

Durante desenvolvimento local:

```bash
npm install
npm run typecheck
npm run build
```

Tambem e possivel consumir a pasta localmente a partir de outro projeto:

```json
{
  "dependencies": {
    "@nfse-tools/nfse-sdk": "file:../nfse-sdk"
  }
}
```

## Responsabilidade

O SDK deve fazer:

- carregar ou receber certificado A1 em memoria;
- extrair chave privada e certificado em PEM;
- assinar XML com XMLDSIG;
- compactar XML em GZip e codificar Base64;
- descompactar respostas GZip/Base64;
- fazer requisicoes mTLS para a NFS-e Nacional;
- enviar DPS;
- consultar NFS-e por chave de acesso;
- enviar eventos fiscais, como cancelamento;
- normalizar erros oficiais retornados pela SEFIN;
- alternar entre producao restrita e producao.

## Escolhendo a entrada

| Caso | Entrada recomendada | Quando usar |
| --- | --- | --- |
| O sistema ja monta a DPS oficial | XML | ERP, sistema legado ou aplicacao propria ja produzem XML no layout nacional. |
| A aplicacao quer montar DPS a partir de dados de negocio | JSON declarativo | A aplicacao consumidora mantem prestador, catalogo de servicos e snapshot da emissao. |
| A aplicacao precisa controlar o transporte manualmente | Funcoes de baixo nivel | Fluxos customizados de assinatura, gzip/base64, envio, consulta ou evento. |

O JSON da SDK e uma representacao tecnica da DPS. A aplicacao consumidora ainda
e responsavel por escolher codigo de servico, CST, retencao, serie, numero da DPS
e demais declaracoes fiscais.

## Serie e numero da DPS

A SEFIN identifica a DPS pela combinacao de dados do prestador, municipio,
`serie` e `nDPS`. No XML, esses campos aparecem assim:

```xml
<serie>1601</serie>
<nDPS>4</nDPS>
```

Na SDK, a `serie` deve vir no perfil do prestador ou na emissao:

```ts
prestador: {
  serie: '1601',
}
```

```ts
emissao: {
  serie: '1601',
  nDPS: '4',
}
```

Quando `emissao.serie` existe, ela sobrescreve `prestador.serie` apenas para
aquela DPS. A regra operacional comum e manter uma `serie` fixa para cada
sequencia de emissao e incrementar o `nDPS` a cada nova DPS.

Exemplo:

```text
serie 1601, nDPS 4
serie 1601, nDPS 5
serie 1601, nDPS 6
```

O Emissor Web pode gerar XML com series proprias, como `70000`. Para emissao via
API, use uma serie propria valida para API, por exemplo `1601`, e controle o
proximo `nDPS` na aplicacao consumidora.

## Casos de uso

### 1. Emitir uma DPS em XML ja pronta

Use este caminho quando outro sistema ja gera o XML da DPS. A SDK recebe o XML,
assina, compacta, envia por mTLS e normaliza rejeicoes oficiais.

```ts
import { EmitirNotaError, emitirNota, loadPfx } from '@nfse-tools/nfse-sdk';

const pfx = loadPfx('./certificado.pfx', process.env.PFX_PASSWORD!);

try {
  const resultado = await emitirNota(dpsXml, pfx, { ambiente: 'restrita' });

  console.log(resultado.chaveAcesso);
  console.log(resultado.nfseXml);
} catch (error) {
  if (error instanceof EmitirNotaError) {
    console.error(error.status);
    console.error(error.erros);
  } else {
    throw error;
  }
}
```

### 2. Emitir a partir de JSON declarativo

Use este caminho quando a aplicacao consumidora tem perfis de prestador e de
servico, mas quer delegar a montagem tecnica da DPS para a SDK.

```ts
import { emitirNota, loadPfx, type DpsJsonRequest } from '@nfse-tools/nfse-sdk';

const nota: DpsJsonRequest = {
  ambiente: 'restrita',
  prestador: {
    cnpj: '38153016000107',
    tpInsc: '2',
    cLocEmi: '4106902',
    serie: '1601',
    opSimpNac: '1',
    regEspTrib: '0',
  },
  servico: {
    cTribNac: '010201',
    cNBS: '115022000',
    xDescServ: 'Desenvolvimento e manutencao de software',
    cLocPrestacao: '4106902',
  },
  emissao: {
    nDPS: '4',
    dhEmi: '2026-04-20T14:02:19-03:00',
    dCompet: '2026-03-27',
    valores: {
      vServ: '46895.59',
    },
    tributacaoMunicipal: {
      tribISSQN: '3',
      cPaisResult: 'US',
      tpRetISSQN: '1',
    },
    tributacaoFederal: {
      piscofins: { CST: '00' },
    },
    totTrib: {
      pTotTribFed: '11.33',
      pTotTribEst: '0.00',
      pTotTribMun: '5.00',
    },
  },
};

const pfx = loadPfx('./certificado.pfx', process.env.PFX_PASSWORD!);
const resultado = await emitirNota(nota, pfx);
```

Campos `pTotTribFed`, `pTotTribEst` e `pTotTribMun` sao percentuais de carga
tributaria e sao serializados com duas casas decimais, por exemplo `11.33`.
Eles nao usam a mesma escala de quatro casas das aliquotas como `pAliq`.

### 3. Gerar XML para inspecao antes do envio

Use este caminho para comparar a DPS gerada com um XML de referencia, salvar um
snapshot ou depurar rejeicoes de schema antes de chamar a SEFIN.

```ts
import { buildDpsFromJson } from '@nfse-tools/nfse-sdk';

const { id, xml } = buildDpsFromJson(nota);

console.log(id);
console.log(xml);
```

### 4. Tratar rejeicoes oficiais da SEFIN

`emitirNota` lanca `EmitirNotaError` quando a SEFIN retorna HTTP fora da faixa
2xx ou uma resposta sem XML autorizado. A lista `erros` preserva os campos
oficiais quando eles estao presentes.

```ts
import { EmitirNotaError, emitirNota } from '@nfse-tools/nfse-sdk';

try {
  await emitirNota(nota, pfx);
} catch (error) {
  if (!(error instanceof EmitirNotaError)) throw error;

  for (const rejeicao of error.erros) {
    console.log(rejeicao.Codigo);
    console.log(rejeicao.Descricao);
    console.log(rejeicao.Complemento);
  }
}
```

### 5. Consultar uma NFS-e emitida

Use este caminho quando a aplicacao ja tem a chave de acesso e quer buscar o
estado atual na NFS-e Nacional.

```ts
import { consultarNfse } from '@nfse-tools/nfse-sdk';

const resposta = await consultarNfse(chaveAcesso, pfx, 'restrita');

if (resposta.status !== 200) {
  console.log(resposta.body);
}
```

## Referencia rapida

### Carregar certificado A1

```ts
import { loadPfx } from '@nfse-tools/nfse-sdk';

const pfx = loadPfx('./certificado.pfx', process.env.PFX_PASSWORD!);
```

Tambem e possivel carregar o certificado a partir de um buffer, por exemplo
depois de descriptografar um certificado armazenado pela aplicacao consumidora.

```ts
import { loadPfxFromBuffer } from '@nfse-tools/nfse-sdk';

const pfx = loadPfxFromBuffer(pfxBuffer, password);
```

### Enviar evento

```ts
import { enviarEvento, gzipBase64, signEnveloped } from '@nfse-tools/nfse-sdk';

const signedEventXml = signEnveloped(pedRegXml, pedRegId, 'infPedReg', pfx);
const pedRegXmlGZipB64 = gzipBase64(signedEventXml);

const resposta = await enviarEvento(
  pedRegXmlGZipB64,
  pfx,
  chaveAcesso,
  'restrita',
);
```

### Normalizar rejeicoes

```ts
import { extrairErros } from '@nfse-tools/nfse-sdk';

const erros = extrairErros(resposta.body);
```

## Ambientes

Ambientes suportados:

- `restrita`: `https://sefin.producaorestrita.nfse.gov.br/SefinNacional`
- `producao`: `https://sefin.nfse.gov.br/SefinNacional`

```ts
import { resolveSefinBaseUrl } from '@nfse-tools/nfse-sdk';

const baseUrl = resolveSefinBaseUrl('restrita');
```

## API publica

```ts
export {
  DEFAULT_AMBIENTE,
  EmitirNotaError,
  SEFIN_BASE_URL,
  TP_AMB,
  buildDpsFromJson,
  buildDpsId,
  consultarNfse,
  emitirNota,
  enviarEvento,
  extrairErros,
  gzipBase64,
  gunzipBase64,
  loadPfx,
  loadPfxFromBuffer,
  resolveSefinBaseUrl,
  signDps,
  signEnveloped,
  verifyDps,
};
```

Tipos exportados:

```ts
export type {
  Ambiente,
  DpsJsonInput,
  DpsJsonRequest,
  EmitirNotaOptions,
  NotaInput,
  PfxMaterial,
  PrestadorProfile,
  ResultadoEmissaoNota,
  SefinErro,
  SefinResposta,
  ServicoProfile,
};
```

## Desenvolvimento

Scripts:

```bash
npm run typecheck
npm run build
npm test
```

O SDK deve manter testes unitarios para:

- gzip/base64;
- normalizacao de erros;
- montagem de requisicoes sem acessar a rede real;
- assinatura XML;
- parsing de certificado PFX com fixture segura.

Testes de integracao contra a NFS-e Nacional devem ficar separados dos testes
unitarios e exigir certificado real e ambiente configurado explicitamente.

## Publicacao no npm

Antes da primeira publicacao, confirme que a organizacao `@nfse-tools` existe no
npm e que o usuario autenticado tem permissao para publicar nela.

Checklist local:

```bash
npm install
npm run typecheck
npm run build
npm pack --dry-run
```

Publicacao:

```bash
npm publish
```

O pacote usa `publishConfig.access = public`, necessario para publicar um pacote
escopado publico no npm.

## Principios de design

- Sem dependencia de uma aplicacao especifica.
- Sem import de config, Supabase ou rotas internas.
- Sem estado global de tenant.
- Funcoes pequenas, testaveis e reutilizaveis.
- Erros oficiais devem ser preservados, nao escondidos.
- O SDK transporta declaracoes fiscais; ele nao julga se elas estao contabilmente corretas.

## Roadmap

1. Expandir cobertura de testes unitarios do SDK.
2. Criar exemplos executaveis em `examples/` para XML, JSON e eventos.
3. Publicar pacote npm.
