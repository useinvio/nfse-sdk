# Consultar uma NFS-e e baixar o DANFSe

## Pela chave de acesso

```ts
import { ConsultaNfseError, obterNfse } from '@useinvio/nfse-sdk';

try {
  const nota = await obterNfse(chaveAcesso, certificado, 'restrita');
  console.log(nota.resumo.nNFSe, nota.resumo.cStat, nota.resumo.valores.vLiq);
  console.log(nota.nfseXml); // XML autorizado, já descompactado
} catch (error) {
  if (error instanceof ConsultaNfseError && error.notFound) console.log('NFS-e não existe neste ambiente');
  else throw error;
}
```

`resumo` (`NfseResumo`) traz:

| Campo | Conteúdo |
|---|---|
| `chaveAcesso`, `nNFSe`, `nDFSe` | Identificação da nota. |
| `cStat`, `dhProc` | Situação e data/hora de processamento. |
| `ambiente` | `restrita` ou `producao`, lido do `tpAmb` da DPS. |
| `emitente`, `tomador` | `CNPJ`/`CPF`/`NIF`, `IM`, `xNome`. |
| `dps` | `id`, `serie`, `nDPS`, `dhEmi`, `dCompet` da DPS de origem. |
| `valores` | `vServ`, `vBC`, `pAliqAplic`, `vISSQN`, `vTotalRet`, `vLiq`. |
| `xLocEmi`, `xLocPrestacao`, `cLocIncid`, `xLocIncid`, `xTribNac` | Locais e descrição da tributação. |

Os valores ficam como strings, exatamente como no XML. Para ler um XML que você
já tem, use `lerNfse(xml)`. No cliente: `client.invoices.retrieve(chave)`.

A resposta crua (`{ status, body }`) continua em `consultarNfse(...)` e
`client.invoices.get(...)`.

## Pelo Id da DPS

`consultarDps(dpsId, certificado)` chama `GET /dps/{id}` e devolve a chave de
acesso gerada. Para o fluxo completo depois de um timeout, use
[`recuperarNfsePorDps`](recuperar-emissao.md).

## DANFSe em PDF

```ts
import { writeFile } from 'node:fs/promises';
import { baixarDanfse } from '@useinvio/nfse-sdk';

const danfse = await baixarDanfse(chaveAcesso, certificado, 'restrita');
if (danfse.pdf) await writeFile(`danfse-${chaveAcesso}.pdf`, danfse.pdf);
else console.error(danfse.status, danfse.body);
```

O PDF oficial vem do ADN (`GET /danfse/{chave}`). No cliente:
`client.invoices.danfse(chave)`.
