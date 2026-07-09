# Metricas da SEFIN

O SDK pode medir a latencia das chamadas mTLS feitas contra a SEFIN Nacional. Essas metricas ajudam a responder perguntas como:

- qual e o P99 de `POST /nfse` no ambiente restrito?
- as consultas por chave estao ficando lentas?
- quantas chamadas externas falharam no processo atual?
- a lentidao vem da SEFIN ou da minha API?

As metricas sao emitidas pelo SDK, mas nao sao enviadas para nenhum servico automaticamente. A aplicacao que usa o SDK decide se quer guardar em memoria, registrar em logs, exportar para Prometheus, enviar para Datadog/New Relic/Grafana, ou expor em um endpoint interno.

## O que e medido

Cada chamada externa feita pelo `sefinClient.ts` pode emitir um evento com:

| Campo | Descricao |
|---|---|
| `operation` | Operacao logica do SDK. |
| `ambiente` | `restrita` ou `producao`, quando informado. |
| `method` | Metodo HTTP usado contra a SEFIN. |
| `pathTemplate` | Caminho sem dados sensiveis, por exemplo `/nfse/{chave}`. |
| `durationMs` | Tempo total do round-trip externo em milissegundos. |
| `status` | Status HTTP retornado pela SEFIN, quando houve resposta. |
| `success` | `true` para HTTP 2xx; `false` para HTTP nao 2xx, timeout ou erro de rede. |
| `errorName` | Nome do erro local, quando a chamada falha antes de uma resposta HTTP. |
| `errorMessage` | Mensagem do erro local, quando aplicavel. |

Operacoes emitidas:

| Operacao | Endpoint SEFIN |
|---|---|
| `transmitir_dps` | `POST /nfse` |
| `consultar_nfse` | `GET /nfse/{chave}` |
| `enviar_evento` | `POST /nfse/{chave}/eventos` |

## O que nao e medido

Essas metricas nao medem a latencia total da sua API. Elas medem apenas a dependencia externa SEFIN.

Exemplo:

```txt
Cliente -> sua API:                 20ms
sua API -> SEFIN -> sua API:      4200ms
sua API -> banco/logs/outros:       80ms
latencia total da sua API:        4300ms
latencia SEFIN medida pelo SDK:   4200ms
```

Tambem nao ha persistencia automatica. O agregador em memoria zera quando o processo Node reinicia.

## Uso basico

Registre um observer uma vez na inicializacao da aplicacao, antes de fazer chamadas como `emitirNfse`, `consultarNfse` ou `enviarEvento`.

```ts
import {
  createSefinLatencyTracker,
  setSefinRequestObserver,
} from '@useinvio/nfse-sdk';

export const sefinLatency = createSefinLatencyTracker({
  maxSamplesPerSeries: 1000,
});

setSefinRequestObserver((metric) => {
  sefinLatency.observe(metric);
});
```

Depois, leia o snapshot onde fizer sentido para sua aplicacao:

```ts
const snapshot = sefinLatency.snapshot();

console.log(snapshot.series);
```

Exemplo de retorno:

```ts
{
  generatedAt: '2026-07-09T12:00:00.000Z',
  series: [
    {
      operation: 'transmitir_dps',
      ambiente: 'restrita',
      count: 120,
      successCount: 118,
      errorCount: 2,
      sampleCount: 120,
      minMs: 180,
      maxMs: 8100,
      avgMs: 940.2,
      p50Ms: 430,
      p95Ms: 2200,
      p99Ms: 5100
    }
  ]
}
```

## Como interpretar P99

`p99Ms` significa que 99% das chamadas observadas naquela serie foram mais rapidas ou iguais a esse valor.

Se `transmitir_dps` em `restrita` tem `p99Ms = 5100`, a leitura pratica e:

```txt
99% das transmissoes de DPS para a SEFIN restrita responderam em ate 5100ms.
```

Um `p99Ms` alto com `p50Ms` baixo indica cauda longa: a maioria das chamadas e rapida, mas uma pequena parte fica muito lenta. Em integracoes fiscais isso costuma aparecer por fila, instabilidade, timeout, validacao pesada ou oscilacao da dependencia externa.

## Series

O tracker agrega por:

```txt
operation + ambiente
```

Assim, `transmitir_dps` em `restrita` nao se mistura com `consultar_nfse` em `producao`.

## Janela movel

`maxSamplesPerSeries` controla quantas duracoes recentes ficam guardadas por serie.

```ts
const sefinLatency = createSefinLatencyTracker({
  maxSamplesPerSeries: 5000,
});
```

Com `5000`, cada combinacao `operation + ambiente` calcula os percentis usando no maximo as ultimas 5000 amostras daquela serie. O contador `count` continua acumulando o total observado desde o ultimo `reset`, mas `p50Ms`, `p95Ms`, `p99Ms`, `minMs`, `maxMs` e `avgMs` usam a janela de amostras mantida em memoria.

## Logs estruturados

Voce pode registrar cada chamada em log e tambem alimentar o tracker:

```ts
setSefinRequestObserver((metric) => {
  sefinLatency.observe(metric);

  logger.info({
    event: 'sefin_request',
    operation: metric.operation,
    ambiente: metric.ambiente,
    status: metric.status,
    success: metric.success,
    durationMs: metric.durationMs,
    errorName: metric.errorName,
  });
});
```

Evite registrar payload fiscal, XML, certificado, chave privada ou dados sensiveis. O SDK ja usa `pathTemplate` para evitar colocar a chave de acesso no nome da serie.

## Endpoint interno na sua API

Se quiser consultar essas metricas pela sua API, crie um endpoint protegido que retorne o snapshot:

```ts
import { sefinLatency } from './observability/sefinMetrics.js';

app.get('/internal/metrics/sefin', async (_request, reply) => {
  return reply.send(sefinLatency.snapshot());
});
```

Esse endpoint deve ser interno ou protegido por autenticacao forte. As metricas nao carregam XML nem certificado, mas podem revelar volume, estabilidade e comportamento operacional do seu sistema.

## Prometheus e outros coletores

O SDK nao depende de Prometheus. Para Prometheus, voce pode converter o snapshot para o formato esperado pela sua biblioteca de metricas.

Exemplo conceitual:

```txt
sefin_request_duration_p99_ms{operation="transmitir_dps",ambiente="restrita"} 5100
sefin_request_success_total{operation="transmitir_dps",ambiente="restrita"} 118
sefin_request_error_total{operation="transmitir_dps",ambiente="restrita"} 2
```

Se voce ja usa OpenTelemetry, Datadog, New Relic, Grafana Cloud ou outro coletor, use `setSefinRequestObserver` como ponto de saida e envie `durationMs`, `operation`, `ambiente`, `status` e `success`.

## Reset

O tracker pode ser zerado:

```ts
sefinLatency.reset();
```

Isso remove as series e amostras em memoria. Use com cuidado em producao, porque o snapshot perde a janela atual de percentis.

## Cuidados

- Registre o observer uma unica vez por processo.
- Nao crie um tracker novo a cada request HTTP.
- Use `maxSamplesPerSeries` conforme o volume esperado e a memoria disponivel.
- Lembre que processos diferentes tem snapshots diferentes. Em varios containers/replicas, cada processo enxerga apenas as chamadas que ele executou.
- Para historico entre deploys/restarts, envie as metricas para um sistema externo.
- Para saber os erros oficiais mais comuns da SEFIN, use a resposta de negocio e `extrairErros(body)` no seu fluxo. As metricas de latencia focam em tempo, status e sucesso/falha da chamada externa.

