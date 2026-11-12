# Ambientes

| Chave | Alias no `NfseClient` | SEFIN (emissão, consulta, eventos) | ADN (DANFSe, distribuição, parâmetros) |
|---|---|---|---|
| `restrita` (padrão) | `sandbox` | `https://sefin.producaorestrita.nfse.gov.br/SefinNacional` | `https://adn.producaorestrita.nfse.gov.br` |
| `producao` | `production` | `https://sefin.nfse.gov.br/SefinNacional` | `https://adn.nfse.gov.br` |

```ts
import { resolveAdnBaseUrl, resolveSefinBaseUrl, TP_AMB } from '@useinvio/nfse-sdk';

resolveSefinBaseUrl('restrita'); // URL da SEFIN
resolveAdnBaseUrl('producao');   // URL do ADN
TP_AMB.restrita;                 // '2', valor de <tpAmb> no XML
```

- `restrita` é a produção restrita oficial: as notas não têm validade jurídica,
  mas passam pelas mesmas validações. Use-a para testes e homologação.
- O `tpAmb` dentro do XML precisa coincidir com o ambiente de envio; o SDK
  recusa a divergência antes de transmitir.
- No `NfseClient`, o ambiente segue: opção da chamada → `defaults.ambiente` →
  `environment` do construtor. O cliente não lembra o ambiente da última emissão.

## Endpoints usados

| Operação | Método e caminho | Serviço |
|---|---|---|
| Emitir | `POST /nfse` | SEFIN |
| Consultar NFS-e | `GET /nfse/{chave}` | SEFIN |
| Consultar DPS | `GET /dps/{id}` | SEFIN |
| Registrar evento | `POST /nfse/{chave}/eventos` | SEFIN |
| Consultar evento | `GET /nfse/{chave}/eventos/{tpEvento}/{nSeqEvento}` | SEFIN |
| DANFSe | `GET /danfse/{chave}` | ADN |
| Distribuição | `GET /contribuintes/DFe/{nsu}` | ADN |
| Eventos por chave | `GET /contribuintes/NFSe/{chave}/Eventos` | ADN |
| Parâmetros municipais | `GET /parametrizacao/...` | ADN |
