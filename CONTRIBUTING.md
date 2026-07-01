# Contributing

Obrigado por contribuir com o `@useinvio/nfse-sdk`.

Este SDK cuida da integracao tecnica com a NFS-e Nacional: montagem de XML,
assinatura, compactacao, mTLS, envio, consulta e normalizacao de respostas da
SEFIN. Ele nao deve virar um motor fiscal paralelo. Regras de negocio como
codigo de servico, CST, retencoes, enquadramento tributario, serie e numero da
DPS continuam sendo responsabilidade da aplicacao integradora e da validacao
oficial da SEFIN.

## Ambiente local

Use Node.js 20 ou superior.

```bash
npm install
npm run typecheck
npm run build
npm test
```

Antes de abrir uma mudanca, rode pelo menos:

```bash
npm test
```

Para mudancas de empacotamento, API publica ou publicacao:

```bash
npm run typecheck
npm run build
npm test
npm pack --dry-run
```

## Escopo das mudancas

Mantenha o SDK protocolar e reutilizavel.

Bom escopo:

- montar DPS/NFS-e conforme o layout nacional;
- assinar XML com XMLDSIG;
- compactar e descompactar GZip/Base64;
- fazer transporte mTLS para a SEFIN;
- normalizar erros e respostas oficiais;
- validar formato, dominios pequenos do XSD e combinacoes tecnicamente invalidas;
- documentar campos e exemplos de uso.

Fora de escopo:

- calcular impostos para o usuario;
- escolher codigo de servico, CST, aliquotas ou retencoes;
- substituir regras oficiais da SEFIN;
- manter uma matriz fiscal paralela como fonte da verdade;
- bloquear cenarios que a SEFIN ja valida, exceto erros tecnicos claros.

## Mudancas no JSON da DPS

O JSON declarativo e uma entrada tecnica para gerar XML. Ao alterar
`DpsJsonRequest`, `DpsJsonInput` ou o builder em `dpsJson.ts`:

- atualize `JSON_MAPPING.md`;
- adicione ou ajuste testes em `test/dpsJson.test.ts`;
- garanta que o XML gerado continue validando contra o XSD oficial;
- preserve os mesmos nomes de campos no cliente (`NfseClient`) sempre que possivel.

Nao adicione defaults fiscais silenciosos. Campos como `tributacaoMunicipal` e
`totTrib` devem ser informados explicitamente pelo integrador.

## XSD oficial

Os schemas oficiais ficam em:

```text
schemas/nfse/v1.01/Schemas/1.01
```

O teste `test/xsdValidation.test.ts` valida uma DPS gerada contra
`DPS_v1.01.xsd` usando `xmllint`.

Se atualizar schemas oficiais:

- baixe os artefatos da documentacao oficial da NFS-e Nacional;
- preserve a estrutura original dos arquivos;
- registre a versao/data no caminho ou no nome do artefato;
- rode `npm test`;
- explique no PR qual documentacao oficial motivou a atualizacao.

O teste pode preparar uma copia temporaria dos schemas para compatibilidade com
ferramentas locais, mas os arquivos oficiais versionados no repo devem ficar
inalterados.

## Testes

Use `node:test` e `assert` como no restante do projeto.

Adicione testes quando a mudanca afetar:

- XML gerado;
- validacoes fiscais minimas;
- assinatura, compactacao ou transporte;
- cliente `NfseClient`;
- exports publicos;
- documentacao de campos obrigatorios ou condicionais.

Preferimos testes pequenos e objetivos, com payloads reais o suficiente para
pegar regressao de schema.

## API publica

Evite multiplicar pontos de entrada. O fluxo principal deve continuar simples:

- `buildDpsFromJson` para montar XML sem enviar;
- `emitirNfse` para montar, assinar, compactar e transmitir;
- `NfseClient` como fachada fina usando o mesmo shape JSON.

Ao exportar algo novo, atualize:

- `index.ts`;
- `README.md`, se for parte da API de usuario;
- testes de build/tipo, quando aplicavel.

## Documentacao

Exemplos devem ser copiaveis e honestos sobre responsabilidade fiscal. Quando
um campo for condicional, explique a condicao. Quando algo ainda nao for
suportado, documente explicitamente em vez de sugerir suporte parcial.

## Pull requests

Um bom PR inclui:

- resumo curto do problema;
- descricao da solucao;
- impacto na API publica, se houver;
- comandos executados;
- observacoes sobre XSD ou documentacao oficial usada.

Exemplo:

```text
Testes:
- npm run typecheck
- npm run build
- npm test
- npm pack --dry-run
```

## Seguranca e certificados

Nao commite certificados, chaves privadas, senhas, XMLs reais com dados
sensiveis ou respostas completas de producao. Use fixtures anonimizadas.
