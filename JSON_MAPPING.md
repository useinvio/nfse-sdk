# Mapeamento do JSON da DPS

Este documento descreve o formato aceito por `DpsJsonRequest`, usado por
`buildDpsFromJson` e por `emitirNfse` quando a entrada e JSON declarativo.
O `NfseClient` tambem usa esse mesmo formato em `client.invoices.create` e
`client.invoices.buildDpsJson`.

O JSON e uma representacao tecnica da DPS Nacional. A aplicacao consumidora
continua responsavel por escolher codigos fiscais, CST, retencoes, serie,
numero da DPS e demais declaracoes tributarias. Antes de gerar XML, a SDK faz
validacoes minimas de formato, dominios pequenos do XSD e combinacoes obvias,
mas nao calcula tributos nem substitui a validacao oficial da SEFIN.

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
| `regApTribSN` | Nao | `string` | Regime de apuracao do Simples Nacional. So deve ser informado quando `opSimpNac = "3"`. |
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
| `tributacaoMunicipal` | Sim | `TribMun` | Bloco de tributacao municipal. A SDK nao assume `tribISSQN` nem `tpRetISSQN` por default. |
| `tributacaoFederal` | Nao | `TribFed` | Bloco de tributacao federal. |
| `tribNac` | Nao suportado | `TribNac` | Shape legado bloqueado por validacao. IBS/CBS no layout v1.01 exige o bloco RTC `IBSCBS` oficial, ainda nao implementado. |
| `comercioExterior` | Nao | `Partial<ComExt>` | Dados de comercio exterior. |
| `comExt` | Nao | `Partial<ComExt>` | Alias de `comercioExterior`. Usado somente quando `comercioExterior` nao foi informado. |
| `obra` | Nao | `Obra` | Dados de obra. |
| `evento` | Nao suportado | `EventoServico` | Shape legado bloqueado por validacao ate refletir `xNome`, `dtIni`, `dtFim` e `idAtvEvt`/endereco do XSD. |
| `totTrib` | Sim | `TotTrib` | Totais aproximados de carga tributaria. A SDK nao preenche carga tributaria por default. |
| `xDescServ` | Nao | `string` | Atalho para sobrescrever a descricao do servico nesta DPS. |

## `valores`

| Campo | Obrigatorio | Tipo | Descricao |
| --- | --- | --- | --- |
| `vServ` | Condicional | `string` | Valor do servico em reais. Preferencial para gerar `vServ`. |
| `vServMoeda` | Condicional | `string` | Valor em moeda estrangeira. Usado com `cotacao` quando `vServ` nao existe. |
| `cotacao` | Condicional | `number` | Cotacao usada para converter `vServMoeda` em `vServ`. |
| `vDesc` | Nao suportado | `string` | Shape legado bloqueado por validacao ate ser mapeado para os grupos oficiais de desconto do layout v1.01. |
| `vDedRed` | Nao suportado | `string` | Shape legado bloqueado por validacao ate ser mapeado para os grupos oficiais de deducao/reducao do layout v1.01. |

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
| `xNome` | Sim, se `tomador` existir | `string` | Nome ou razao social do tomador. |
| `end` | Nao | `Record<string, string>` | Endereco. Cada chave vira uma tag XML dentro de `end`. |
| `fone` | Nao | `string` | Telefone. |
| `email` | Nao | `string` | Email. |

Quando `tomador` for informado, use exatamente um identificador entre `CNPJ`,
`CPF`, `NIF` e `cNaoNIF`.

## `intermediario`

| Campo | Obrigatorio | Tipo | Descricao |
| --- | --- | --- | --- |
| `CNPJ` | Nao | `string` | CNPJ do intermediario. |
| `CPF` | Nao | `string` | CPF do intermediario. |
| `xNome` | Sim, se `intermediario` existir | `string` | Nome ou razao social do intermediario. |

Quando `intermediario` for informado, use exatamente um identificador entre
`CNPJ` e `CPF`.

## `tributacaoMunicipal`

| Campo | Obrigatorio | Tipo | Descricao |
| --- | --- | --- | --- |
| `tribISSQN` | Sim | `string` | Indicador de tributacao do ISSQN (`1`, `2`, `3` ou `4`). |
| `cPaisResult` | Condicional | `string` | Codigo ISO-3166 alpha-2 do pais de resultado. Obrigatorio somente quando `tribISSQN = "3"` exportacao. |
| `tpRetISSQN` | Sim | `string` | Tipo de retencao do ISSQN (`1`, `2` ou `3`). |
| `vISSQN` | Nao | `string` | Valor do ISSQN. Serializado com duas casas decimais. |
| `vBC` | Nao | `string` | Base de calculo do ISSQN. Serializada com duas casas decimais. |
| `pAliq` | Nao | `string` | Aliquota do ISSQN. Serializada com quatro casas decimais. |
| `tpImunidade` | Condicional | `string` | Tipo de imunidade. Obrigatorio somente quando `tribISSQN = "2"`. |

Regras adicionais:

- `pAliq` e bloqueado quando `prestador.opSimpNac = "1"`.
- `cPaisResult` e bloqueado quando `tribISSQN` nao for exportacao (`"3"`).
- `tpImunidade` e bloqueado quando `tribISSQN` nao for imunidade (`"2"`).

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

`tribNac` esta tipado por compatibilidade, mas e rejeitado em runtime. O layout
NFS-e Nacional v1.01 modela IBS/CBS dentro do bloco RTC `IBSCBS`, com estrutura
propria de situacao/classificacao tributaria, valores e totalizadores. Esta SDK
ainda nao implementa esse bloco.

## `comercioExterior` / `comExt`

| Campo | Obrigatorio | Tipo | Descricao |
| --- | --- | --- | --- |
| `mdPrestacao` | Sim, se `comercioExterior` existir | `string` | Modo de prestacao. |
| `vincPrest` | Sim, se `comercioExterior` existir | `string` | Vinculo da prestacao. |
| `tpMoeda` | Sim, se `comercioExterior` existir | `string` | Tipo/codigo da moeda. |
| `vServMoeda` | Condicional | `string` | Valor do servico na moeda estrangeira. Quando ausente, usa `valores.vServMoeda` ou `emissao.vServMoeda`. |
| `mecAFComexP` | Sim, se `comercioExterior` existir | `string` | Mecanismo de apoio/fomento de comercio exterior do prestador. |
| `mecAFComexT` | Sim, se `comercioExterior` existir | `string` | Mecanismo de apoio/fomento de comercio exterior do tomador. |
| `movTempBens` | Sim, se `comercioExterior` existir | `string` | Indicador de movimentacao temporaria de bens. |
| `mdic` | Sim, se `comercioExterior` existir | `string` | Indicador relacionado ao MDIC. |
| `cPaisResult` | Nao | `string` | Campo tipado no SDK, mas ainda nao serializado no XML por esta versao. |

## `obra`

| Campo | Obrigatorio | Tipo | Descricao |
| --- | --- | --- | --- |
| `cObra` | Nao | `string` | Codigo da obra. |
| `inscImobFisc` | Nao | `string` | Inscricao imobiliaria fiscal. |
| `cCM` | Nao suportado | `string` | Campo legado bloqueado por validacao; nao existe como filho de `obra` no XSD v1.01. |

## `evento`

| Campo | Obrigatorio | Tipo | Descricao |
| --- | --- | --- | --- |
| `xDesc` | Nao | `string` | Descricao da atividade ou evento. |
| `dtEvento` | Nao | `string` | Data do evento. |

## `totTrib`

| Campo | Obrigatorio | Tipo | Descricao |
| --- | --- | --- | --- |
| `pTotTribFed` | Condicional | `string` | Percentual aproximado de tributos federais. Serializado com duas casas decimais. |
| `pTotTribEst` | Condicional | `string` | Percentual aproximado de tributos estaduais. Serializado com duas casas decimais. |
| `pTotTribMun` | Condicional | `string` | Percentual aproximado de tributos municipais. Serializado com duas casas decimais. |
| `vTotTrib` | Condicional | `string` | Valor total aproximado de tributos. Serializado com duas casas decimais. |
| `pTotTribSN` | Condicional | `string` | Percentual aproximado de tributos no Simples Nacional. Nao informe quando `prestador.opSimpNac = "1"`. |
| `indTotTrib` | Condicional | `string` | Indicador oficial para nao informar valor estimado. Use `0` quando nao houver estimativa aproximada. |

Informe ao menos uma forma de totalizacao: `vTotTrib`, grupo `pTotTrib*`,
`pTotTribSN` ou `indTotTrib=0`.

## Regras de formatacao

- Valores monetarios sao serializados com duas casas decimais.
- Aliquotas sao serializadas com quatro casas decimais.
- Percentuais de carga tributaria em `totTrib` sao serializados com duas casas decimais.
- Campos vazios, `undefined` ou `null` nao geram tags XML opcionais.
- Campos obrigatorios ausentes geram erro antes da DPS ser retornada.
- `comercioExterior` tem prioridade sobre `comExt` quando os dois forem informados.
- O XML gerado nos testes e validado contra `schemas/nfse/v1.01/Schemas/1.01/DPS_v1.01.xsd`.
