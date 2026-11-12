# Distribuição e parâmetros municipais (ADN)

O Ambiente de Dados Nacional (ADN) distribui documentos fiscais e publica os
parâmetros de cada município conveniado. Todas as funções usam o mesmo
certificado A1 e devolvem a resposta crua `{ status, body }`.

## Documentos e eventos

| Função | Endpoint |
|---|---|
| `distribuirDfePorNsu(nsu, certificado, ambiente?, { cnpjConsulta?, lote? })` | `GET /contribuintes/DFe/{nsu}` |
| `consultarEventosPorChaveAdn(chave, certificado, ambiente?)` | `GET /contribuintes/NFSe/{chave}/Eventos` |

Para sincronizar notas emitidas e recebidas, guarde o último NSU processado e
chame `distribuirDfePorNsu` a partir dele. Os documentos podem vir em Base64
simples ou duplo; `gunzipBase64Flexivel(b64)` decodifica os dois.

## Parâmetros municipais

| Função | Endpoint |
|---|---|
| `consultarConvenio(codMun, ...)` | `GET /parametrizacao/{codMun}/convenio` |
| `consultarAliquota(codMun, codServico, competencia, ...)` | `GET /parametrizacao/{codMun}/{codServico}/{competencia}/aliquota` |
| `consultarHistoricoAliquotas(codMun, codServico, ...)` | `GET /parametrizacao/{codMun}/{codServico}/historicoaliquotas` |
| `consultarRegimesEspeciais(codMun, codServico, competencia, ...)` | `GET /parametrizacao/{codMun}/{codServico}/{competencia}/regimes_especiais` |
| `consultarRetencoes(codMun, competencia, ...)` | `GET /parametrizacao/{codMun}/{competencia}/retencoes` |
| `consultarBeneficio(codMun, numeroBeneficio, competencia, ...)` | `GET /parametrizacao/{codMun}/{numeroBeneficio}/{competencia}/beneficio` |

`codMun` é o código IBGE de 7 dígitos, `codServico` o código do serviço (ex.:
`01.01.01`) e `competencia` uma data `AAAA-MM-DD`.

```ts
import { consultarAliquota, consultarConvenio } from '@useinvio/nfse-sdk';

const convenio = await consultarConvenio('4106902', certificado, 'restrita');
const aliquota = await consultarAliquota('4106902', '01.01.01', '2026-11-01', certificado, 'restrita');
console.log(convenio.status, aliquota.body);
```

Os parâmetros de caminho são validados antes de qualquer chamada de rede e
geram `SefinParametroInvalidoError` quando o formato está errado.

> Os caminhos seguem o ADN em uso pelos clientes abertos mais adotados. Um dos
> manuais oficiais lista os parâmetros em `/parametros_municipais/...`. Se o seu
> ambiente responder 404, abra uma issue com o retorno.

## No cliente

`client.distribution.byNsu(nsu, { cnpjConsulta, lote })`,
`client.events.listByAccessKey(chave)` e `client.municipalParameters.agreement`,
`.rate`, `.rateHistory`, `.specialRegimes`, `.withholdings`, `.benefit`.
