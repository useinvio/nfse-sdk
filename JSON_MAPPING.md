# Mapeamento do JSON da DPS

Este documento descreve o formato aceito por `DpsJsonRequest`, usado por
`buildDpsFromJson` e por `emitirNota` quando a entrada e JSON declarativo.

O JSON e uma representacao tecnica da DPS Nacional. A aplicacao consumidora
continua responsavel por escolher codigos fiscais, CST, retencoes, serie,
numero da DPS e demais declaracoes tributarias.

## Visao geral

```ts
type DpsJsonRequest = {
  ambiente?: 'restrita' | 'producao';
  prestador: PrestadorProfile;
  servico: ServicoProfile;
  emissao: DpsJsonInput;
};
```

| Campo | Obrigatorio | Tipo | Descricao |
| --- | --- | --- | --- |
| `ambiente` | Nao | `'restrita' \| 'producao'` | Ambiente da NFS-e Nacional. Quando ausente, usa `restrita`. |
| `prestador` | Sim | `PrestadorProfile` | Dados tecnicos do prestador usados para identificar e emitir a DPS. |
| `servico` | Sim | `ServicoProfile` | Perfil padrao do servico prestado. Pode ser parcialmente sobrescrito em `emissao.servico`. |
| `emissao` | Sim | `DpsJsonInput` | Dados especificos da DPS que sera gerada. |

## `prestador`

| Campo | Obrigatorio | Tipo | Descricao |
| --- | --- | --- | --- |
| `cnpj` | Sim | `string` | CNPJ do prestador. O SDK remove nao digitos e completa com zeros a esquerda ao montar o `Id` da DPS. |
| `tpInsc` | Nao | `'1' \| '2' \| string` | Tipo de inscricao no `Id` da DPS. `1` = CPF, `2` = CNPJ. Quando ausente, usa `2`. |
| `cLocEmi` | Sim | `string` | Codigo IBGE do municipio de emissao. |
| `serie` | Sim | `string` | Serie padrao da DPS. Pode ser sobrescrita por `emissao.serie`. |
| `opSimpNac` | Sim | `string` | Opcao pelo Simples Nacional, serializada em `prest/regTrib/opSimpNac`. |
| `regEspTrib` | Sim | `string` | Regime especial de tributacao, serializado em `prest/regTrib/regEspTrib`. |

## `servico`

| Campo | Obrigatorio | Tipo | Descricao |
| --- | --- | --- | --- |
| `cTribNac` | Sim | `string` | Codigo de tributacao nacional do servico. |
| `xDescServ` | Sim | `string` | Descricao do servico. Pode ser sobrescrita por `emissao.servico.xDescServ` ou `emissao.xDescServ`. |
| `cLocPrestacao` | Sim | `string` | Codigo IBGE do local de prestacao. Pode ser sobrescrito por `emissao.servico.cLocPrestacao`. |
| `cNBS` | Nao | `string` | Codigo NBS do servico. Pode ser sobrescrito por `emissao.servico.cNBS`. |

## `emissao`

| Campo | Obrigatorio | Tipo | Descricao |
| --- | --- | --- | --- |
| `nDPS` | Sim | `string` | Numero da DPS dentro da serie. |
| `serie` | Nao | `string` | Serie desta DPS. Quando informado, sobrescreve `prestador.serie` apenas nesta emissao. |
| `dhEmi` | Nao | `string` | Data e hora da emissao em ISO com offset, por exemplo `2026-06-15T10:30:00-03:00`. Quando ausente, usa a data/hora atual. |
| `dCompet` | Nao | `string` | Data de competencia no formato `YYYY-MM-DD`. Quando ausente, usa a data de `dhEmi`. |
| `valores` | Condicional | `Valores` | Valores do servico, descontos e deducoes. Para calcular `vServ`, informe `valores.vServ` ou `valores.vServMoeda` + `valores.cotacao`. |
| `vServ` | Condicional | `string` | Atalho legado para o valor do servico. Usado quando `valores.vServ` nao foi informado. |
| `vServMoeda` | Condicional | `string` | Atalho legado para valor em moeda estrangeira. Usado com `cotacao` quando `vServ` nao foi informado. |
| `cotacao` | Condicional | `number` | Atalho legado para cotacao. Usado com `vServMoeda` quando `vServ` nao foi informado. |
| `servico` | Nao | `object` | Sobrescritas pontuais de `xDescServ`, `cLocPrestacao` e `cNBS` para esta DPS. |
| `tomador` | Nao | `Tomador` | Dados do tomador do servico. |
| `intermediario` | Nao | `Intermediario` | Dados do intermediario do servico. |
| `tributacaoMunicipal` | Nao | `TribMun` | Bloco de tributacao municipal. Quando ausente, o SDK ainda gera `tribMun` vazio. |
| `tributacaoFederal` | Nao | `TribFed` | Bloco de tributacao federal. |
| `tribNac` | Nao | `TribNac` | Bloco de IBS/CBS. |
| `comercioExterior` | Nao | `Partial<ComExt>` | Dados de comercio exterior. |
| `comExt` | Nao | `Partial<ComExt>` | Alias de `comercioExterior`. Usado somente quando `comercioExterior` nao foi informado. |
| `obra` | Nao | `Obra` | Dados de obra. |
| `evento` | Nao | `EventoServico` | Dados de atividade/evento associado ao servico. |
| `totTrib` | Nao | `TotTrib` | Totais aproximados de carga tributaria. |
| `xDescServ` | Nao | `string` | Atalho para sobrescrever a descricao do servico nesta DPS. |

## `valores`

| Campo | Obrigatorio | Tipo | Descricao |
| --- | --- | --- | --- |
| `vServ` | Condicional | `string` | Valor do servico em reais. Preferencial para gerar `vServ`. |
| `vServMoeda` | Condicional | `string` | Valor em moeda estrangeira. Usado com `cotacao` quando `vServ` nao existe. |
| `cotacao` | Condicional | `number` | Cotacao usada para converter `vServMoeda` em `vServ`. |
| `vDesc` | Nao | `string` | Valor de desconto. |
| `vDedRed` | Nao | `string` | Valor de deducao ou reducao. |

Regra condicional: para gerar a DPS, o SDK precisa obter `vServ`. Informe
`valores.vServ` ou informe o par `valores.vServMoeda` + `valores.cotacao`.
Os atalhos `emissao.vServ`, `emissao.vServMoeda` e `emissao.cotacao` tambem sao
aceitos, mas o formato com `valores` e preferencial.

## `emissao.servico`

| Campo | Obrigatorio | Tipo | Descricao |
| --- | --- | --- | --- |
| `xDescServ` | Nao | `string` | Sobrescreve `servico.xDescServ`. |
| `cLocPrestacao` | Nao | `string` | Sobrescreve `servico.cLocPrestacao`. |
| `cNBS` | Nao | `string` | Sobrescreve `servico.cNBS`. |

## `tomador`

| Campo | Obrigatorio | Tipo | Descricao |
| --- | --- | --- | --- |
| `CNPJ` | Nao | `string` | CNPJ do tomador. |
| `CPF` | Nao | `string` | CPF do tomador. |
| `NIF` | Nao | `string` | Numero de identificacao fiscal estrangeiro. |
| `cNaoNIF` | Nao | `string` | Motivo/codigo de nao informacao do NIF. |
| `xNome` | Nao | `string` | Nome ou razao social do tomador. |
| `end` | Nao | `Record<string, string>` | Endereco. Cada chave vira uma tag XML dentro de `end`. |
| `fone` | Nao | `string` | Telefone. |
| `email` | Nao | `string` | Email. |

## `intermediario`

| Campo | Obrigatorio | Tipo | Descricao |
| --- | --- | --- | --- |
| `CNPJ` | Nao | `string` | CNPJ do intermediario. |
| `CPF` | Nao | `string` | CPF do intermediario. |
| `xNome` | Nao | `string` | Nome ou razao social do intermediario. |

## `tributacaoMunicipal`

| Campo | Obrigatorio | Tipo | Descricao |
| --- | --- | --- | --- |
| `tribISSQN` | Nao | `string` | Indicador de tributacao do ISSQN. |
| `cPaisResult` | Nao | `string` | Codigo do pais de resultado da prestacao. |
| `tpRetISSQN` | Nao | `string` | Tipo de retencao do ISSQN. |
| `vISSQN` | Nao | `string` | Valor do ISSQN. Serializado com duas casas decimais. |
| `vBC` | Nao | `string` | Base de calculo do ISSQN. Serializada com duas casas decimais. |
| `pAliq` | Nao | `string` | Aliquota do ISSQN. Serializada com quatro casas decimais. |
| `tpImunidade` | Nao | `string` | Tipo de imunidade. |

## `tributacaoFederal`

| Campo | Obrigatorio | Tipo | Descricao |
| --- | --- | --- | --- |
| `piscofins` | Nao | `object` | Bloco de PIS/COFINS. Quando informado, `piscofins.CST` e obrigatorio. |
| `vRetCP` | Nao | `string` | Valor retido de contribuicao previdenciaria. Serializado com duas casas decimais. |
| `vRetIRRF` | Nao | `string` | Valor retido de IRRF. Serializado com duas casas decimais. |
| `vRetCSLL` | Nao | `string` | Valor retido de CSLL. Serializado com duas casas decimais. |

### `tributacaoFederal.piscofins`

| Campo | Obrigatorio | Tipo | Descricao |
| --- | --- | --- | --- |
| `CST` | Sim, se `piscofins` existir | `string` | CST de PIS/COFINS. |
| `vBCPisCofins` | Nao | `string` | Base de calculo de PIS/COFINS. Serializada com duas casas decimais. |
| `pAliqPis` | Nao | `string` | Aliquota de PIS. Serializada com quatro casas decimais. |
| `pAliqCofins` | Nao | `string` | Aliquota de COFINS. Serializada com quatro casas decimais. |
| `vPis` | Nao | `string` | Valor de PIS. Serializado com duas casas decimais. |
| `vCofins` | Nao | `string` | Valor de COFINS. Serializado com duas casas decimais. |
| `tpRetPisCofins` | Nao | `string` | Tipo de retencao de PIS/COFINS. |

## `tribNac`

| Campo | Obrigatorio | Tipo | Descricao |
| --- | --- | --- | --- |
| `IBS` | Nao | `object` | Bloco de IBS. Quando informado, `IBS.CST` e obrigatorio. |
| `CBS` | Nao | `object` | Bloco de CBS. Quando informado, `CBS.CST` e obrigatorio. |

### `tribNac.IBS`

| Campo | Obrigatorio | Tipo | Descricao |
| --- | --- | --- | --- |
| `CST` | Sim, se `IBS` existir | `string` | CST do IBS. |
| `vBC` | Nao | `string` | Base de calculo. Serializada com duas casas decimais. |
| `pAliqEstado` | Nao | `string` | Aliquota estadual. Serializada com quatro casas decimais. |
| `pAliqMunicipio` | Nao | `string` | Aliquota municipal. Serializada com quatro casas decimais. |
| `vIBSEstado` | Nao | `string` | Valor do IBS estadual. Serializado com duas casas decimais. |
| `vIBSMunicipio` | Nao | `string` | Valor do IBS municipal. Serializado com duas casas decimais. |

### `tribNac.CBS`

| Campo | Obrigatorio | Tipo | Descricao |
| --- | --- | --- | --- |
| `CST` | Sim, se `CBS` existir | `string` | CST da CBS. |
| `vBC` | Nao | `string` | Base de calculo. Serializada com duas casas decimais. |
| `pAliq` | Nao | `string` | Aliquota. Serializada com quatro casas decimais. |
| `vCBS` | Nao | `string` | Valor da CBS. Serializado com duas casas decimais. |

## `comercioExterior` / `comExt`

| Campo | Obrigatorio | Tipo | Descricao |
| --- | --- | --- | --- |
| `mdPrestacao` | Nao | `string` | Modo de prestacao. |
| `vincPrest` | Nao | `string` | Vinculo da prestacao. |
| `tpMoeda` | Nao | `string` | Tipo/codigo da moeda. |
| `vServMoeda` | Nao | `string` | Valor do servico na moeda estrangeira. Quando ausente, usa `valores.vServMoeda`, `emissao.vServMoeda` ou `0.00`. |
| `mecAFComexP` | Nao | `string` | Mecanismo de apoio/fomento de comercio exterior do prestador. |
| `mecAFComexT` | Nao | `string` | Mecanismo de apoio/fomento de comercio exterior do tomador. |
| `movTempBens` | Nao | `string` | Indicador de movimentacao temporaria de bens. |
| `mdic` | Nao | `string` | Indicador relacionado ao MDIC. |
| `cPaisResult` | Nao | `string` | Campo tipado no SDK, mas ainda nao serializado no XML por esta versao. |

## `obra`

| Campo | Obrigatorio | Tipo | Descricao |
| --- | --- | --- | --- |
| `cObra` | Nao | `string` | Codigo da obra. |
| `inscImobFisc` | Nao | `string` | Inscricao imobiliaria fiscal. |
| `cCM` | Nao | `string` | Codigo de cadastro mobiliario. |

## `evento`

| Campo | Obrigatorio | Tipo | Descricao |
| --- | --- | --- | --- |
| `xDesc` | Nao | `string` | Descricao da atividade ou evento. |
| `dtEvento` | Nao | `string` | Data do evento. |

## `totTrib`

| Campo | Obrigatorio | Tipo | Descricao |
| --- | --- | --- | --- |
| `pTotTribFed` | Nao | `string` | Percentual aproximado de tributos federais. Serializado com duas casas decimais. |
| `pTotTribEst` | Nao | `string` | Percentual aproximado de tributos estaduais. Serializado com duas casas decimais. |
| `pTotTribMun` | Nao | `string` | Percentual aproximado de tributos municipais. Serializado com duas casas decimais. |
| `vTotTrib` | Nao | `string` | Valor total aproximado de tributos. Serializado com duas casas decimais. |

## Regras de formatacao

- Valores monetarios sao serializados com duas casas decimais.
- Aliquotas sao serializadas com quatro casas decimais.
- Percentuais de carga tributaria em `totTrib` sao serializados com duas casas decimais.
- Campos vazios, `undefined` ou `null` nao geram tags XML opcionais.
- Campos obrigatorios ausentes geram erro antes da DPS ser retornada.
- `comercioExterior` tem prioridade sobre `comExt` quando os dois forem informados.
