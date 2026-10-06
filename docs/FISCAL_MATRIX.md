# Matriz fiscal da DPS v1.01

O SDK valida estas combinações antes de construir, assinar ou transmitir a DPS.

| Situação | Obrigatório | Proibido |
| --- | --- | --- |
| Serviço nacional | `vServ`; CPF ou CNPJ e `endNac` quando há tomador; `pTotTribFed`, `pTotTribEst` e `pTotTribMun` para não optante | `comercioExterior`, moeda/cotação estrangeira, país do resultado, NIF e `endExt` |
| Exportação | `comercioExterior`; valor e cotação estrangeiros; país do resultado; NIF ou `cNaoNIF`; `endExt` quando há tomador | CPF/CNPJ e `endNac` no tomador exterior |
| MEI (`opSimpNac=2`) | Somente `indTotTrib=0` | percentuais e `pTotTribSN` |
| ME/EPP (`opSimpNac=3`) | Somente `pTotTribSN` | `indTotTrib` e percentuais federal/estadual/municipal |

O SDK usa os XSDs NFS-e Nacional v1.01 distribuídos no pacote para validar a estrutura. A matriz não substitui a verificação contábil nem uma homologação no ambiente restrito da SEFIN.


## Resolucao e validacao tecnica

- A matriz usa a mesma resolucao por campo do builder: `valores` prevalece sobre os atalhos legados. `comercioExterior` prevalece integralmente sobre `comExt`.
- Divergencias cambiais sao avisos em `warnings`; valores explicitos continuam prevalecendo. Somente erros em `issues` bloqueiam a geracao.
- A carga por regime e a classificacao nacional/exterior acima permanecem inalteradas. Nao foram adicionadas dependencias fiscais de retencao ou proibicao de pais `BR` na exportacao.
- Valores de servico devem continuar positivos depois do arredondamento; codigos e limites numericos seguem os XSD locais. Campos opcionais vazios ou nulos sao invalidos.
- Intermediario estrangeiro, IBS/CBS, descontos, deducoes e prestacao por pais continuam fora do modelo suportado.

Veja [CORRECOES_EMISSAO.md](CORRECOES_EMISSAO.md) para ambiente, certificados, respostas e compatibilidade. [REGRAS_NEGOCIO_EMISSAO.md](REGRAS_NEGOCIO_EMISSAO.md) permanece o diagnostico historico anterior a essas correcoes.
