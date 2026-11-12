# Cancelar uma NFS-e

## Cancelamento (e101101)

```ts
import { cancelarNfse, RegistrarEventoError } from '@useinvio/nfse-sdk';

try {
  const evento = await cancelarNfse(
    {
      ambiente: 'restrita',
      chaveAcesso,
      cMotivo: '1', // 1 = erro na emissão, 2 = serviço não prestado, 9 = outros
      xMotivo: 'Nota emitida com valor incorreto', // 15 a 255 caracteres
      // autor: { CNPJ: '...' } // padrão: CNPJ/CPF do titular do certificado
    },
    certificado,
  );
  console.log(evento.pedRegEventoId, evento.eventoXml);
} catch (error) {
  if (error instanceof RegistrarEventoError) console.error(error.status, error.erros);
  else throw error;
}
```

O SDK monta o `pedRegEvento` v1.01, valida contra o XSD oficial, assina
`infPedReg`, compacta e envia em `pedidoRegistroEventoXmlGZipB64`. Guarde
`evento.pedRegEventoXml` (o pedido assinado) junto com a resposta.

As constantes `MOTIVO_CANCELAMENTO` e `MOTIVO_SUBSTITUICAO` têm os códigos com
nomes legíveis, por exemplo `MOTIVO_CANCELAMENTO.servicoNaoPrestado`.

## Cancelamento por substituição (e105102)

Emita primeiro a nota substituta, depois cancele a original apontando para ela:

```ts
import { cancelarNfsePorSubstituicao, MOTIVO_SUBSTITUICAO } from '@useinvio/nfse-sdk';

await cancelarNfsePorSubstituicao(
  {
    chaveAcesso: chaveOriginal,
    chaveSubstituta,
    cMotivo: MOTIVO_SUBSTITUICAO.outros,
    xMotivo: 'Correcao do valor do servico prestado', // opcional
  },
  certificado,
);
```

## Consultar eventos

- `consultarEvento(chave, TP_EVENTO.cancelamento, certificado)`: SEFIN,
  `GET /nfse/{chave}/eventos/{tpEvento}/{nSeqEvento}` (`nSeqEvento` padrão 1).
- `consultarEventosPorChaveAdn(chave, certificado)`: ADN, todos os eventos da nota.

## Montar sem enviar

`buildCancelamentoFromJson(...)` e `buildCancelamentoPorSubstituicaoFromJson(...)`
devolvem `{ id, xml }` não assinado. `validatePedRegEventoXmlAgainstXsd(xml)`
confere contra o XSD; `registrarEvento(built, certificado)` assina e envia.

## No cliente

```ts
await client.invoices.cancel({ chaveAcesso, cMotivo: '2', xMotivo: 'Servico nao foi prestado ao tomador' });
await client.invoices.cancelBySubstitution({ chaveAcesso, chaveSubstituta, cMotivo: '99' });
```

Eventos são POSTs e nunca são repetidos automaticamente, mesmo com `retries`.
