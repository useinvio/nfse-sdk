# Tratar rejeições e erros

Cada etapa lança um erro tipado. Use `instanceof` para decidir o que fazer.

```ts
import {
  CertificateValidationError,
  DpsFiscalValidationError,
  DpsXsdValidationError,
  EmitirNotaError,
  emitirNfse,
} from '@useinvio/nfse-sdk';

try {
  await emitirNfse(nota, certificado);
} catch (error) {
  if (error instanceof DpsFiscalValidationError) {
    // JSON inválido antes de gerar XML: corrija a entrada
    for (const issue of error.issues) console.log(issue.code, issue.path, issue.message);
  } else if (error instanceof DpsXsdValidationError) {
    // XML viola o XSD oficial: error.details traz o diagnóstico do libxml2
  } else if (error instanceof CertificateValidationError) {
    // senha, leitura ou vigência do A1: error.code
  } else if (error instanceof EmitirNotaError) {
    // a SEFIN respondeu com rejeição (ou com resposta 2xx incompleta)
    for (const rejeicao of error.erros) {
      console.log(rejeicao.Codigo, rejeicao.Descricao, rejeicao.Complemento);
    }
  } else {
    throw error; // rede, timeout, XsdEngineUnavailableError: o resultado é incerto
  }
}
```

## Rejeição da SEFIN ou resultado incerto?

| Erro | A nota foi emitida? | Ação |
|---|---|---|
| `DpsFiscalValidationError`, `DpsXsdValidationError`, `CertificateValidationError` | Não: nada foi enviado. | Corrija a entrada ou o certificado. |
| `EmitirNotaError` com `status` 4xx | Não. | Corrija conforme `erros` e envie de novo. |
| `EmitirNotaError` com `INVALID_AUTHORIZATION_RESPONSE` | Talvez. | [Recupere pela DPS](recuperar-emissao.md) antes de reenviar. |
| Erro de rede ou timeout | Talvez. | [Recupere pela DPS](recuperar-emissao.md) antes de reenviar. |
| `XsdEngineUnavailableError` | Não: falha local de infraestrutura. | Tente de novo; não é rejeição fiscal. |

## Explicar um código

```ts
import { explicarErros, explicarRejeicao } from '@useinvio/nfse-sdk';

explicarRejeicao('E0014');
// { codigo: 'E0014', conhecida: true, mensagemOficial: 'Conjunto de Série, Número, ...',
//   regra: '...', campo: 'NFSe/infNFSe/DPS/infDPS/serie', nivel: 1, fonte: { documento, url } }

explicarErros(error.erros); // uma explicação por erro de EmitirNotaError ou RegistrarEventoError
```

O catálogo tem as regras de rejeição dos anexos oficiais publicados em
gov.br/nfse (Anexo I v1.01 de 09/02/2026, DPS e NFS-e; Anexo II v1.01 de
22/01/2026, eventos), com o texto oficial sem alterações. Um código fora do
catálogo volta com `conhecida: false`: não há causa inventada.
`buscarRejeicao(codigo)` e `listarRejeicoes()` dão acesso direto às regras.

## Normalizar o corpo da resposta

`extrairErros(body)` normaliza os formatos de erro da SEFIN (`erros`, `Erros`,
`erro`, objeto único) para `{ Codigo, Descricao, Complemento? }`.

A lista completa de classes e códigos está em [Erros](../referencia/erros.md).
