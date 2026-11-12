# Recuperar uma emissão após timeout

`POST /nfse` não é idempotente, por isso o SDK **nunca** repete uma emissão
automaticamente. Se a conexão cair sem resposta, a nota pode ter sido
autorizada ou não. Pergunte à SEFIN antes de reenviar:

```ts
import { prepararNota, recuperarNfsePorDps, transmitirNotaPreparada } from '@useinvio/nfse-sdk';

const nota = prepararNota(dps, certificado); // persista nota.dpsId e nota.signedXml antes de enviar
try {
  return await transmitirNotaPreparada(nota, certificado, { timeoutMs: 30_000 });
} catch (error) {
  if (error instanceof Error && error.name === 'EmitirNotaError') throw error; // rejeição real
  const existente = await recuperarNfsePorDps(nota.dpsId, certificado, nota.ambiente, { retries: 3 });
  return existente ?? transmitirNotaPreparada(nota, certificado); // null: a DPS não chegou à SEFIN
}
```

`recuperarNfsePorDps` chama `GET /dps/{id}` e, se a DPS foi processada,
`GET /nfse/{chave}`. O resultado é o mesmo de [`obterNfse`](consultar.md):

| Resultado | Significado | O que fazer |
|---|---|---|
| `NfseConsultada` | A nota foi autorizada antes da queda. | Use o resultado; não reenvie. |
| `null` | A SEFIN não conhece a DPS. | Reenvie a **mesma** DPS assinada (mesmo `Id`). |
| `ConsultaNfseError` | A consulta falhou. | Tente de novo mais tarde; não reenvie às cegas. |

Reenvie sempre a mesma DPS assinada, nunca uma DPS nova: o `Id` (prestador,
série e número) identifica a DPS na SEFIN, e um número novo geraria outra nota.

No cliente: `client.invoices.recover(dpsId)`. Exemplo completo em
[`examples/recover-emission.ts`](../../examples/recover-emission.ts).
