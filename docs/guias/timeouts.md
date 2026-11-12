# Timeouts, novas tentativas e cancelamento

Toda função de rede aceita um último argumento `SefinRequestOptions`:

| Opção | Padrão | Efeito |
|---|---|---|
| `timeoutMs` | `60000` | Tempo máximo de cada requisição. |
| `retries` | `0` | Novas tentativas com backoff exponencial (0,5 s, 1 s, 2 s, até 4 s, com jitter). |
| `signal` | – | `AbortSignal` que cancela a requisição e as tentativas pendentes. |

`retries` vale só para GETs e só para falhas transitórias: erro de rede e HTTP
429, 502, 503 ou 504. Emissão (`POST /nfse`) e eventos nunca são repetidos,
mesmo que você passe `retries`, porque não são idempotentes. Para emissão, veja
[Recuperar uma emissão após timeout](recuperar-emissao.md).

```ts
import { obterNfse } from '@useinvio/nfse-sdk';

const nota = await obterNfse(chaveAcesso, certificado, 'producao', {
  timeoutMs: 15_000,
  retries: 3,
  signal: AbortSignal.timeout(60_000),
});
```

No cliente, configure uma vez para todas as chamadas:
`new NfseClient({ ..., request: { timeoutMs: 30_000, retries: 2 } })`.

## Métricas de latência

Com `NFSE_SEFIN_LATENCY_METRICS=1`, o SDK emite uma métrica por requisição
(operação, ambiente, status e duração) para o observador registrado em
`setSefinRequestObserver`. O guia completo está em [METRICS.md](../METRICS.md).
