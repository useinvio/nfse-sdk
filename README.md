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

O SDK nao deve fazer:

- autenticar usuarios;
- gerenciar tenants;
- guardar certificados;
- acessar banco de dados;
- conhecer emitentes cadastrados;
- conhecer catalogo de servicos;
- montar snapshot de emissao;
- operar fila, retry de negocio ou auditoria;
- enviar webhooks;
- calcular imposto devido;
- decidir codigo de tributacao, aliquota, CST ou retencao;
- substituir validacoes da API nacional.

## Uso basico

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

### Assinar uma DPS

O SDK assina XML. Ele nao decide nem monta os dados fiscais da DPS.

```ts
import { signDps } from '@nfse-tools/nfse-sdk';

const signedXml = signDps(dpsXml, dpsId, pfx);
```

### Enviar uma DPS

```ts
import { enviarDps, gzipBase64 } from '@nfse-tools/nfse-sdk';

const dpsXmlGZipB64 = gzipBase64(signedXml);

const resposta = await enviarDps(dpsXmlGZipB64, pfx, 'restrita');
```

### Consultar NFS-e

```ts
import { consultarNfse } from '@nfse-tools/nfse-sdk';

const resposta = await consultarNfse(
  '00000000000000000000000000000000000000000000000000',
  pfx,
  'restrita',
);
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
  SEFIN_BASE_URL,
  consultarNfse,
  enviarDps,
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
export type { Ambiente, PfxMaterial, SefinErro, SefinResposta };
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
2. Criar exemplos minimos.
3. Publicar pacote npm.
