# Matriz fiscal da DPS v1.01

O SDK valida estas combinações antes de construir, assinar ou transmitir a DPS.

| Situação | Obrigatório | Proibido |
| --- | --- | --- |
| Serviço nacional | `vServ`; CPF ou CNPJ e `endNac` quando há tomador; `pTotTribFed`, `pTotTribEst` e `pTotTribMun` para não optante | `comercioExterior`, moeda/cotação estrangeira, país do resultado, NIF e `endExt` |
| Exportação | `comercioExterior`; valor e cotação estrangeiros; país do resultado; NIF ou `cNaoNIF`; `endExt` quando há tomador | CPF/CNPJ e `endNac` no tomador exterior |
| MEI (`opSimpNac=2`) | Somente `indTotTrib=0` | percentuais e `pTotTribSN` |
| ME/EPP (`opSimpNac=3`) | Somente `pTotTribSN` | `indTotTrib` e percentuais federal/estadual/municipal |

O SDK usa os XSDs NFS-e Nacional v1.01 distribuídos no pacote para validar a estrutura. A matriz não substitui a verificação contábil nem uma homologação no ambiente restrito da SEFIN.
