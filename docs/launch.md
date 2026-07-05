# Launch kit

Material curto para divulgar `@useinvio/nfse-sdk` sem prometer que o SDK substitui a camada fiscal da aplicacao.

## Posicionamento

`@useinvio/nfse-sdk` e um SDK TypeScript para integrar com a NFS-e Nacional a partir de Node.js. Ele recebe JSON, monta DPS/XML, assina com XMLDSIG, compacta em GZip/Base64, transmite por mTLS e preserva os erros oficiais da SEFIN em formato estruturado.

O foco e a camada protocolar. O SDK nao calcula regra municipal, nao escolhe CST, nao decide retencao e nao substitui a validacao fiscal/contabil do produto que o consome.

## Frases curtas

- Emita NFS-e Nacional a partir de JSON.
- Pare de escrever XML fiscal na mao.
- TypeScript SDK para DPS, XMLDSIG, GZip/Base64, mTLS e SEFIN.
- Um SDK protocolar para ERPs, SaaS financeiros, contabilidades digitais e plataformas de cobranca.

## Post para LinkedIn

Lancei o `@useinvio/nfse-sdk`, um SDK TypeScript para quem precisa integrar com a NFS-e Nacional em Node.js.

A ideia e simples: voce envia um JSON tipado e o SDK cuida da parte protocolar chata da emissao:

- montagem da DPS/XML;
- validacoes estruturais;
- assinatura XMLDSIG;
- compactacao GZip/Base64;
- transporte mTLS;
- consulta de NFS-e;
- erros oficiais da SEFIN em formato estruturado.

Ele nao tenta ser motor fiscal e nao escolhe regra tributaria por voce. Codigo de servico, CST, retencoes, carga tributaria, serie e numero da DPS continuam sendo responsabilidade da aplicacao/ERP/contador.

O objetivo e reduzir a friccao tecnica para times que ja sabem o que precisam declarar, mas nao querem manter XML, assinatura digital e transporte SEFIN do zero.

GitHub: https://github.com/useinvio/nfse-sdk
npm: https://www.npmjs.com/package/@useinvio/nfse-sdk

```bash
npm install @useinvio/nfse-sdk
```

## Post tecnico

Titulo sugerido:

Como emitir NFS-e Nacional em Node.js sem escrever XML fiscal na mao

Estrutura:

1. Explique a dor: DPS, XML, certificado A1, XMLDSIG, GZip/Base64, mTLS e rejeicoes SEFIN.
2. Mostre o comando de instalacao.
3. Mostre um exemplo minimo com `emitirNfse`.
4. Mostre como inspecionar o XML com `buildDpsFromJson`.
5. Explique os limites: o SDK nao calcula tributos nem substitui regra fiscal.
6. Feche com links para GitHub, npm, `JSON_MAPPING.md` e `examples/`.

## README curto para compartilhar em grupos

Criei um SDK TypeScript open source para NFS-e Nacional:

`@useinvio/nfse-sdk`

Ele ajuda a sair de JSON para DPS/XML assinado e enviado para a SEFIN, incluindo XMLDSIG, GZip/Base64, mTLS, consulta e erros estruturados.

Nao e motor fiscal; e a camada protocolar para quem ja tem as informacoes fiscais corretas na aplicacao.

GitHub: https://github.com/useinvio/nfse-sdk
npm: https://www.npmjs.com/package/@useinvio/nfse-sdk

## Prompt para Lovable

Crie uma landing page enxuta e chamativa para devs para o produto open source `@useinvio/nfse-sdk`.

Contexto:
- E um SDK TypeScript para integracao com a NFS-e Nacional do Brasil.
- Publico-alvo: devs Node.js/TypeScript, ERPs, SaaS financeiros, contabilidades digitais e plataformas de cobranca.
- Proposta central: emitir NFS-e Nacional a partir de JSON sem escrever XML fiscal na mao.
- O SDK cuida da camada protocolar: DPS/XML, validacao estrutural, XMLDSIG, GZip/Base64, mTLS, consulta e erros estruturados da SEFIN.
- Ele nao e motor fiscal, nao calcula tributos, nao escolhe CST, nao decide retencao e nao substitui validacao contabil.

Objetivo da pagina:
- Fazer um dev entender em menos de 10 segundos o que o SDK resolve.
- Levar para GitHub e npm.
- Mostrar um exemplo de codigo real logo no primeiro viewport.

Tom visual:
- Moderno, tecnico, direto, confiavel.
- Aparencia de ferramenta de infraestrutura/devtool, nao SaaS corporativo generico.
- Fundo claro ou escuro bem contrastado, tipografia limpa, blocos de codigo bonitos.
- Evite ilustracoes genericas. Use visual inspirado em terminal, JSON, XML, certificado digital e pipeline de protocolo.

Estrutura desejada:
1. Hero com headline: "NFS-e Nacional em TypeScript, a partir de JSON."
2. Subheadline: "Monte DPS/XML, assine com XMLDSIG, compacte em GZip/Base64 e transmita por mTLS para a SEFIN sem manter a camada protocolar do zero."
3. CTAs: "Ver no GitHub" e "Instalar via npm".
4. Bloco de codigo com:
   `npm install @useinvio/nfse-sdk`
   e um snippet curto usando `emitirNfse`.
5. Secao "O que ele resolve" com cards pequenos:
   - JSON para DPS/XML
   - Assinatura XMLDSIG
   - GZip/Base64
   - mTLS com certificado A1
   - Consulta de NFS-e
   - Erros SEFIN estruturados
6. Secao "O que ele nao faz" com destaque honesto:
   "Nao calcula regra municipal, nao escolhe CST, nao decide retencoes e nao substitui sua validacao fiscal."
7. Secao final com links para GitHub, npm, README e exemplos.

Conteudo tecnico para usar:
- Package: `@useinvio/nfse-sdk`
- Install: `npm install @useinvio/nfse-sdk`
- GitHub: `https://github.com/useinvio/nfse-sdk`
- npm: `https://www.npmjs.com/package/@useinvio/nfse-sdk`
- Exemplo curto:

```ts
import { emitirNfse, loadPfx } from '@useinvio/nfse-sdk';

const pfx = loadPfx('./certificado.pfx', process.env.PFX_PASSWORD!);
const resultado = await emitirNfse(notaJson, pfx);

console.log(resultado.chaveAcesso);
console.log(resultado.nfseXml);
```

Requisitos:
- A primeira tela deve mostrar o nome do pacote, a promessa principal, CTAs e codigo.
- A pagina deve ser responsiva.
- Use layout enxuto, sem muitas secoes.
- Nao invente features alem das listadas.
- Nao prometa "compliance fiscal automatico".
- Nao diga que substitui contador ou ERP.
