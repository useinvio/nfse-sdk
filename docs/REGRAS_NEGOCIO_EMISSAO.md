# Regras de negócio da emissão de NFS-e — cenário atual

**Data da análise:** 06/10/2026 · **Produto:** `@useinvio/nfse-sdk` 2.2.0 · **Código:** commit `0bfbefa` · **Leiaute local:** DPS 1.01.

Este relatório descreve o comportamento implementado no repositório: emissão nacional, emissão para o exterior, validações, exceções e limitações. A cobertura se refere às decisões existentes no SDK; não representa um catálogo de todas as legislações municipais. Aplicações consumidoras, cadastros de clientes e configurações de produção não estão neste repositório.

**Leitura das regras:** “aceito” significa que a entrada passa pela etapa indicada; somente a resposta da SEFIN confirma a autorização. Regras do SDK, restrições do XSD e enquadramento tributário são camadas distintas.

## 1. Visão do produto

O SDK recebe uma declaração de prestação de serviços (DPS), gera o XML, valida sua estrutura, assina com certificado digital e transmite à SEFIN Nacional. A SEFIN devolve a NFS-e autorizada ou uma rejeição.

A aplicação informa o enquadramento tributário. O SDK não determina o município de incidência, não escolhe CST ou alíquotas, não calcula os tributos nem consulta a situação cadastral do contribuinte. Seus cálculos se limitam à conversão cambial e ao arredondamento dos valores declarados.

Há duas categorias operacionais no JSON:

| Categoria | Como o sistema identifica | Consequência |
| --- | --- | --- |
| Nacional | Ausência de `emissao.comercioExterior` e `emissao.comExt` | Exige valor em reais; restringe o tomador a CPF/CNPJ e endereço nacional. |
| Exterior, tratado como exportação | Presença de um desses blocos, inclusive objeto vazio | Exige moeda, cotação, país do resultado e, por combinação das validações, `tribISSQN="3"`. |

**Principal limite de produto:** cliente estrangeiro, local da prestação, local do resultado e tratamento do ISSQN não são decisões independentes na implementação atual. A presença do bloco de comércio exterior determina o enquadramento operacional de exportação.

Para o ISS, a LC 116/2003 distingue exportação de serviço de serviço desenvolvido no Brasil cujo resultado aqui se verifica, ainda que pago por residente no exterior. Também prevê incidência sobre serviços provenientes do exterior. Logo, identificar um cliente estrangeiro não basta para concluir o enquadramento fiscal; o SDK não realiza essa análise. [Fonte: LC 116/2003, arts. 1º e 2º](https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp116.htm).

## 2. Caminho da emissão e responsabilidades

| Etapa | Comportamento atual | Responsável |
| --- | --- | --- |
| Preparar dados | Definir prestador, serviço, tomador, natureza tributária, retenções, valores, série e número | Aplicação consumidora |
| Montar JSON | `NfseClient.invoices.buildDpsJson` combina padrões e dados da chamada; não executa a validação fiscal completa | SDK |
| Validar JSON | `validateDpsJsonRequest` reúne problemas; `buildDpsFromJson` bloqueia entradas inválidas | SDK |
| Gerar DPS | Produz XML 1.01, identificador, datas e valores formatados | SDK |
| Validar XSD | `prepararNota` valida o XML com os esquemas locais e `xmllint` | SDK + infraestrutura |
| Assinar | Assina a DPS e verifica a assinatura com o certificado fornecido | SDK |
| Transmitir | Compacta em GZip/Base64 e envia por HTTPS com autenticação mTLS | SDK |
| Autorizar | Aplica validações oficiais e retorna a NFS-e ou rejeições | SEFIN |
| Persistir e acompanhar | Armazenar XML, chave, identificador, erros, numeração e estado da emissão | Aplicação consumidora |

`emitirNfse` executa preparação e transmissão. `buildDpsFromJson` retorna XML **sem assinatura e sem executar o XSD**. `prepararNota` permite obter o XML assinado antes do envio; não o persiste. `transmitirNotaPreparada` confia no objeto recebido e não refaz as validações.

**Entrada XML:** passa pelo XSD e pela assinatura, mas não pela matriz fiscal do JSON. Assim, uma restrição do builder não significa necessariamente proibição no leiaute. O XML externo precisa ser montado e validado pelo integrador.

Base: [fluxo de emissão](/Users/tiagofonseca/priv_repo/nfse-sdk/emissaoNota.ts:57), [builder](/Users/tiagofonseca/priv_repo/nfse-sdk/dpsJson.ts:475), [cliente](/Users/tiagofonseca/priv_repo/nfse-sdk/client.ts:88).

## 3. Regras comuns a todas as emissões

### 3.1 Prestador, serviço e identificação

| ID | Regra implementada |
| --- | --- |
| COM-01 | Os blocos `prestador`, `servico` e `emissao` são obrigatórios no builder. |
| COM-02 | O prestador informa exatamente um identificador: `cnpj` com 14 dígitos ou `cpf` com 11. Não há verificação dos dígitos verificadores nem consulta cadastral. Pontuação e CNPJ alfanumérico são rejeitados pelo JSON atual. |
| COM-03 | `prestador.cLocEmi` tem 7 dígitos. O código não consulta a existência do município nem sua habilitação para emitir. |
| COM-04 | `prestador.serie` é obrigatória, com 1 a 5 dígitos, mesmo quando `emissao.serie` a sobrescreve. Não há restrição local de faixas reservadas por canal. |
| COM-05 | `emissao.nDPS` contém de 1 a 15 dígitos, começa de 1 a 9 e não aceita zero inicial. O SDK não incrementa nem reserva números. |
| COM-06 | O ID tem 45 caracteres: `DPS` + município (7) + tipo de inscrição (1) + CPF/CNPJ (14) + série (5) + número (15). Segmentos são completados com zeros à esquerda. `tpInsc` é derivado do documento; o campo legado informado é ignorado. |
| COM-07 | `servico.cTribNac` tem 6 dígitos. A descrição efetiva é obrigatória e não pode ser apenas espaços. `cNBS` é opcional, com 9 dígitos quando presente. Não se valida a correspondência entre descrição, código nacional e NBS. |
| COM-08 | `cLocPrestacao` exige 7 dígitos, inclusive na exportação. O builder não oferece `cPaisPrestacao`, embora o XSD permita essa alternativa. |
| COM-09 | A DPS sempre usa `tpEmit="1"`, emissão pelo prestador. Emissão por tomador/intermediário não é configurável no JSON. |

O serviço possui um único bloco, sem lista de itens. Não há modelagem de múltiplos serviços com códigos ou tratamentos fiscais distintos na mesma entrada.

### 3.2 Datas, ambiente e precedência

| Campo | Regra |
| --- | --- |
| `dhEmi` | Opcional. Sem valor, usa data/hora de São Paulo e offset `-03:00`. Quando informado, a pré-validação exige formato com offset numérico; `Z` é rejeitado. Essa etapa verifica formato, não toda a validade cronológica. |
| `dCompet` | Opcional. Sem valor, usa a parte da data de `dhEmi`. Quando informado, verifica uma data de calendário válida `AAAA-MM-DD`. |
| Relação entre datas | Não existe regra local para competência futura, competência posterior à emissão ou prazo retroativo. |
| Ambiente | `restrita` é o padrão e gera `tpAmb=2`; `producao` gera `tpAmb=1`. O cliente também aceita `sandbox` e `production`. |
| Série | `emissao.serie` prevalece sobre `prestador.serie`. |
| Descrição | `emissao.servico.xDescServ` prevalece sobre `emissao.xDescServ`, que prevalece sobre `servico.xDescServ`. |
| Local e NBS | Campos de `emissao.servico` prevalecem sobre os de `servico`. O código nacional continua vindo de `servico.cTribNac`. |
| Comércio exterior | `comercioExterior` prevalece sobre `comExt`; os dois objetos não são combinados. |
| Padrões do cliente | A chamada prevalece sobre os padrões. A combinação é superficial: informar `emissao.valores` substitui todo esse objeto, sem preservar seus campos internos anteriores. |

**Atenção ao ambiente:** na função direta `emitirNfse`, `options.ambiente` escolhe o destino, mas o XML JSON é construído usando `request.ambiente`. Valores diferentes podem gerar `tpAmb` incompatível com o destino. No cliente, `invoices.get` usa o ambiente do construtor, mesmo que uma emissão tenha sobrescrito o ambiente.

Base: [cadastros e datas](/Users/tiagofonseca/priv_repo/nfse-sdk/fiscalValidation.ts:186), [identificador](/Users/tiagofonseca/priv_repo/nfse-sdk/dpsJson.ts:290), [precedências](/Users/tiagofonseca/priv_repo/nfse-sdk/client.ts:88).

## 4. Matriz nacional × exterior

As regras desta seção descrevem o formato canônico, com valores dentro de `emissao.valores`. Há inconsistências com atalhos legados descritas na seção 10.

| Situação | Dados necessários | Resultado local |
| --- | --- | --- |
| Nacional, pessoa jurídica | `vServ`, CNPJ, nome e `endNac` | Aceito com demais blocos válidos. |
| Nacional, pessoa física | `vServ`, CPF, nome e `endNac` | Aceito com demais blocos válidos. |
| Nacional sem tomador | `vServ`; omitir todo o bloco `tomador` | Aceito. O SDK não define quando identificar o tomador é legalmente dispensável. |
| Nacional com tomador sem endereço | CPF/CNPJ e nome, sem `endNac` | Rejeitado. |
| Nacional com NIF ou endereço exterior | Mesmo que tenha valor em reais | Rejeitado. |
| Nacional com moeda/cotação ou país do resultado | Qualquer desses campos | Rejeitado no formato canônico. |
| Exportação com NIF | Comércio exterior completo, valor estrangeiro, cotação, país do resultado, NIF, nome e `endExt` | Aceito. |
| Exportação sem NIF, com justificativa | Trocar NIF por `cNaoNIF="1"` ou `"2"` | Aceito. `1` = dispensado; `2` = não exigência. |
| Exportação com `cNaoNIF="0"` | Não informado na nota de origem | Rejeitado pelo SDK, embora exista no XSD local. |
| Exportação sem tomador | Omitir todo o bloco `tomador` | Aceito localmente. |
| Exportação com CPF/CNPJ ou `endNac` | Identificação/endereço nacional no tomador | Rejeitado. |
| Exportação sem valor estrangeiro ou cotação | Mesmo que `vServ` esteja informado | Rejeitado. |
| Exportação com resultado `BR` | `tribISSQN="3"` e `cPaisResult="BR"` | Aceito pelo JSON e XSD; não há verificação material de exportação. |
| Cliente estrangeiro, operação tributável no Brasil | Tomador estrangeiro com `tribISSQN="1"` | Sem fluxo coerente no builder: sem comércio exterior o tomador é rejeitado; com o bloco, a matriz exige país do resultado, que só é permitido com código `3`. |
| Exportação com preço somente em reais | Apenas `vServ`, sem moeda/cotação | Sem suporte nesse formato. A exigência é do SDK, não uma conclusão sobre a legalidade da operação. |
| Serviço executado fisicamente no exterior | Local da prestação por país | Não representável por `cPaisPrestacao` no JSON atual. |
| Importação ou emissão pelo tomador | Prestador estrangeiro/emissor tomador | Não modelada pelo builder atual. |

### Identificação e endereço do tomador

Quando `tomador` existe, `xNome` e exatamente um entre `CNPJ`, `CPF`, `NIF` e `cNaoNIF` são exigidos. Informar dois identificadores é erro, mesmo que ambos sejam válidos.

| Endereço | Campos obrigatórios |
| --- | --- |
| Nacional | `endNac.cMun` (7 dígitos), `endNac.CEP` (8 dígitos), `xLgr`, `nro`, `xBairro` |
| Exterior | `endExt.cPais` (duas letras maiúsculas), `cEndPost`, `xCidade`, `xEstProvReg`, `xLgr`, `nro`, `xBairro` |

`xCpl`, telefone e e-mail são opcionais. `endNac` e `endExt` são mutuamente exclusivos. A pré-validação verifica o formato do país, mas não sua existência em catálogo, nem se é diferente de `BR`. País do tomador e país do resultado não precisam coincidir para passar localmente.

**Intermediário:** opcional; a interface pública e o XML suportam CPF ou CNPJ e nome. O validador genérico também reconhece NIF/`cNaoNIF`, mas o builder do intermediário não os serializa. Portanto, intermediário estrangeiro não tem suporte completo, mesmo que um objeto JavaScript passe pela pré-validação.

Base: [pessoas](/Users/tiagofonseca/priv_repo/nfse-sdk/fiscalValidation.ts:223), [matriz operacional](/Users/tiagofonseca/priv_repo/nfse-sdk/fiscalValidation.ts:409).

## 5. ISSQN, regimes e carga tributária

### 5.1 Natureza do ISSQN

`tributacaoMunicipal`, `tribISSQN` e `tpRetISSQN` são obrigatórios. Não existem valores fiscais padrão.

| `tribISSQN` | Significado no XSD local | Obrigatório | Proibido | Combinação atual |
| --- | --- | --- | --- | --- |
| `1` | Operação tributável | Tipo de retenção | País do resultado e tipo de imunidade | Nacional |
| `2` | Imunidade | Tipo de retenção e `tpImunidade` | País do resultado | Nacional |
| `3` | Exportação de serviço | Tipo de retenção e `cPaisResult` | Tipo de imunidade | Comércio exterior obrigatório pela matriz |
| `4` | Não incidência | Tipo de retenção | País do resultado e tipo de imunidade | Nacional |

`tpImunidade` aceita `0` a `5`: não especificada na origem; recíproca; templos; entidades previstas na alínea c; livros/jornais/periódicos; fonogramas/videofonogramas, respectivamente, conforme descrições do XSD. O SDK não comprova elegibilidade para nenhuma hipótese.

| `tpRetISSQN` | Declaração | Validação adicional existente |
| --- | --- | --- |
| `1` | Não retido | Nenhuma associação ao regime ou à natureza. |
| `2` | Retido pelo tomador | Não exige a presença do tomador. |
| `3` | Retido pelo intermediário | Não exige a presença do intermediário. |

A combinação de exportação, imunidade ou não incidência com retenção não é barrada pela pré-validação. Aceitar o código não confirma que a retenção se aplica ao caso.

`pAliq` é proibida para não optante (`opSimpNac="1"`). Para MEI e ME/EPP, passa na pré-validação se for decimal não negativo e não ultrapassar `9.99`; é serializada com duas casas. Esse limite é estrutural, não uma autorização fiscal de qualquer alíquota até esse valor. `vBC` e `vISSQN` nesse bloco são rejeitados: o SDK não os transmite como campos da DPS.

### 5.2 Regime do prestador e total aproximado de tributos

| `opSimpNac` | Perfil | Única forma de `totTrib` aceita pelo JSON |
| --- | --- | --- |
| `1` | Não optante | Os três percentuais: `pTotTribFed`, `pTotTribEst`, `pTotTribMun` |
| `2` | MEI | Somente `indTotTrib="0"` |
| `3` | ME/EPP do Simples | Somente `pTotTribSN` |

A tabela vale tanto para nacional quanto para exterior. `totTrib` ausente, vazio, com modalidades misturadas ou com percentual federal/estadual/municipal incompleto é rejeitado.

Embora os tipos e o builder tenham `vTotTribFed/Est/Mun`, **nenhum dos três regimes válidos permite essa modalidade no validador JSON atual**. A restrição por regime é mais estreita que a escolha estrutural do XSD.

A carga aproximada não é o ISS devido nem o valor líquido da nota. O SDK não a busca em tabelas, não a calcula e não a zera automaticamente na exportação. Também não valida a soma dos percentuais ou sua adequação ao serviço.

`regApTribSN` é opcional e permitido somente para ME/EPP: `1` = tributos federais e ISS no Simples; `2` = federais no Simples e ISS fora; `3` = ambos fora. O valor não altera a regra de `totTrib`, que continua exigindo `pTotTribSN`.

`regEspTrib` é obrigatório e aceita: `0` nenhum; `1` ato cooperado; `2` estimativa; `3` microempresa municipal; `4` notário/registrador; `5` autônomo; `6` sociedade de profissionais; `9` outros. Não há cruzamento com serviço, município ou opção pelo Simples.

Base: [ISSQN](/Users/tiagofonseca/priv_repo/nfse-sdk/fiscalValidation.ts:297), [totais](/Users/tiagofonseca/priv_repo/nfse-sdk/fiscalValidation.ts:336), [domínios locais](/Users/tiagofonseca/priv_repo/nfse-sdk/schemas/nfse/v1.01/Schemas/1.01/tiposSimples_v1.01.xsd:996).

## 6. Valores e comércio exterior

### 6.1 Conversão e arredondamento

| ID | Regra |
| --- | --- |
| VAL-01 | `vServ`, `vServMoeda` e cotação, quando usados na validação de valores, precisam ser decimais maiores que zero. Não se aceitam vírgula decimal, sinal negativo ou notação exponencial. |
| VAL-02 | Se `vServ` estiver informado, ele prevalece. Caso contrário, calcula-se `vServMoeda × cotacao`, arredondado para duas casas. |
| VAL-03 | A multiplicação usa inteiros de precisão arbitrária após converter as entradas em texto. A cotação tem tipo `number`: a precisão já perdida antes de chegar ao SDK não é recuperada. |
| VAL-04 | Valores monetários, alíquotas e percentuais normalmente são arredondados para duas casas, com metade para cima. Exemplo: `1.005 → 1.01`. |
| VAL-05 | Exceção: `comExt.vServMoeda` é transmitido como recebido, sem arredondamento. Três casas podem passar no JSON e falhar no XSD. |
| VAL-06 | Não se confere se `vServ` corresponde ao produto da moeda pela cotação. Não se confere se o valor estrangeiro de `comercioExterior` coincide com o usado na conversão. |
| VAL-07 | A cotação não é transmitida em uma tag própria, não é consultada externamente e não tem fonte/data registradas pelo SDK. |
| VAL-08 | Um valor positivo muito pequeno pode arredondar para zero: `0.001 → 0.00`. Não existe segunda validação de positividade após arredondar. |

Exemplo confirmado: `9000.00 × 5.210621 = 46895.59` no XML. Informar simultaneamente `vServ="1.00"` e os mesmos dados cambiais faz o SDK transmitir `1.00`, sem apontar divergência.

### 6.2 Dados de comércio exterior

Todos os campos abaixo são obrigatórios quando o bloco está presente, exceto o valor dentro do próprio bloco, que pode vir de `valores.vServMoeda`. O preenchimento apenas de `comercioExterior.vServMoeda` não satisfaz a exigência de valor/cotação da matriz operacional.

| Campo | Domínio do XSD local | Aplicação da regra |
| --- | --- | --- |
| `mdPrestacao` | `0`, `1`, `2`, `3`, `4` | Modo de prestação. Há divergência nas descrições dos códigos `3` e `4` entre os dois arquivos XSD; não usar o exemplo do repositório como escolha fiscal automática. |
| `vincPrest` | `0` sem vínculo; `1` controlada; `2` controladora; `3` coligada; `4` matriz; `5` filial/sucursal; `6` outro; `9` desconhecido | Relação entre as partes. |
| `tpMoeda` | Três dígitos, código de moeda conforme tabela BACEN | O SDK não consulta o catálogo; não recebe `USD`/`EUR` nesse campo. |
| `vServMoeda` | Decimal do leiaute, até 15 dígitos inteiros e escala prevista no XSD | Prefere o valor do bloco; na ausência, usa o valor da emissão. |
| `mecAFComexP` | `00` a `08` | Apoio/fomento do prestador; `01` significa nenhum. |
| `mecAFComexT` | `00` a `26` | Apoio/fomento do tomador; `01` significa nenhum. |
| `movTempBens` | `0` desconhecido; `1` não; `2` vinculado à declaração de importação; `3` vinculado à declaração de exportação | O JSON não oferece `nDI` nem `nRE`, existentes no XSD. |
| `mdic` | `0` não compartilhar; `1` compartilhar | Declaração de compartilhamento com a Secretaria de Comércio Exterior. |

A pré-validação exige presença desses códigos; a verificação dos respectivos domínios fica principalmente no XSD. `comercioExterior.cPaisResult` existe no tipo, mas é ignorado na geração do XML: o campo efetivo fica em `tributacaoMunicipal.cPaisResult`.

Base: [cálculo](/Users/tiagofonseca/priv_repo/nfse-sdk/dpsJson.ts:243), [comércio exterior](/Users/tiagofonseca/priv_repo/nfse-sdk/dpsJson.ts:459), [estrutura local](/Users/tiagofonseca/priv_repo/nfse-sdk/schemas/nfse/v1.01/Schemas/1.01/tiposComplexos_v1.01.xsd:1364).

## 7. Tributos federais e funcionalidades especiais

`tributacaoFederal` é opcional. Quando `piscofins` existe, `CST` é obrigatório; base, alíquotas, valores e retenção são opcionais na pré-validação.

| Informação | Comportamento |
| --- | --- |
| CST de PIS/COFINS | Aceita `00–09`, `49–56`, `60–67`, `70–75`, `98` e `99`. Não escolhe o CST conforme nacional/exterior nem verifica a adequação à operação. |
| Base, alíquotas, PIS e COFINS | Valida decimais não negativos e formata com duas casas. Não calcula `base × alíquota`, nem exige os campos conforme o CST. |
| `tpRetPisCofins` | Transmitido quando informado; domínio `0–9` validado pelo XSD, sem cruzamento local com os valores. |
| `vRetCP`, `vRetIRRF`, `vRetCSLL` | Transmitidos e arredondados; não passam pela mesma validação fiscal antecipada dos valores de PIS/COFINS. Conteúdo inválido pode falhar posteriormente no builder/XSD. |
| Valor líquido | Não calculado; retenções não são automaticamente subtraídas de `vServ`. |

No XSD, os tipos de retenção federal são: `0` nenhum dos três tributos retido; `1` PIS/COFINS retidos; `2` PIS/COFINS não retidos; `3` os três retidos; `4` PIS/COFINS retidos e CSLL não; `5` somente PIS; `6` somente COFINS; `7` COFINS/CSLL; `8` somente CSLL; `9` PIS/CSLL. Os códigos `1` e `2` não detalham CSLL como os demais.

| Caso especial | Suporte atual no JSON |
| --- | --- |
| IBS/CBS | `tribNac` é rejeitado. O grupo oficial `IBSCBS` não é construído. |
| Descontos | `valores.vDesc` é rejeitado, inclusive zero. |
| Deduções/reduções | `valores.vDedRed` é rejeitado, inclusive zero. |
| Obra com `cObra` | Pode gerar XML válido. |
| Obra vazia ou somente inscrição imobiliária | Passa pela pré-validação, mas falta identificação exigida pelo XSD. |
| Obra com `cObra` e `inscImobFisc` | O builder coloca os elementos na ordem errada; falha no XSD. |
| Obra com `cCM` preenchido | Rejeitada; `cCIB` e endereço da obra não são oferecidos pelo builder. |
| Atividade/evento artístico, cultural etc. | `emissao.evento` é rejeitado; o formato legado não representa o grupo oficial. |
| Suspensão de exigibilidade, benefício municipal, código tributário municipal e informações complementares | Não há campos correspondentes no modelo JSON atual. |
| Cancelamento e outros eventos fiscais | Existe envio de XML de evento pronto; não há regra de elegibilidade, prazo, motivo ou builder de cancelamento. Não confundir com `emissao.evento`. |
| Substituição de NFS-e | Sem fluxo dedicado/modelagem no JSON. |

A ausência de suporte a IBS/CBS não permite concluir que sua omissão seja válida em qualquer emissão atual. O portal oficial mantém documentação de produção, esquemas e anexos próprios; esta análise verificou o código e os esquemas locais, sem certificar aderência integral a todas as atualizações publicadas. [Fonte: documentação técnica de produção da NFS-e](https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/documentacao-atual).

Base: [validação federal e funcionalidades bloqueadas](/Users/tiagofonseca/priv_repo/nfse-sdk/fiscalValidation.ts:384), [serialização de tributos](/Users/tiagofonseca/priv_repo/nfse-sdk/dpsJson.ts:385), [obra no XSD](/Users/tiagofonseca/priv_repo/nfse-sdk/schemas/nfse/v1.01/Schemas/1.01/tiposComplexos_v1.01.xsd:1517).

## 8. Autorização, erros e continuidade

| Resultado | Como identificar | Tratamento de produto recomendado |
| --- | --- | --- |
| JSON inválido | Relatório `valid=false` ou `DpsFiscalValidationError` | Mostrar campo e motivo; corrigir antes do envio. |
| XML incompatível | `DpsXsdValidationError` | Corrigir estrutura/formato ou a geração do XML. |
| Validador indisponível | `XmllintUnavailableError` | Tratar como falha de infraestrutura, sem atribuí-la ao preenchimento do usuário. |
| Falha de assinatura/certificado | Erro na leitura do PFX, assinatura ou verificação | Corrigir o material do certificado; a rotina fiscal específica precisa ser chamada explicitamente. |
| Rejeição da SEFIN | `EmitirNotaError` com status, DPS, corpo e erros normalizados | Preservar `Codigo`, `Descricao` e `Complemento`; apresentar ação conforme o motivo. |
| Sucesso HTTP sem XML da nota | Também gera `EmitirNotaError` | Não marcar como autorizada apenas pelo HTTP 2xx. |
| Sucesso com XML compactado | HTTP 2xx + `nfseXmlGZipB64`/`NfseXmlGZipB64`; descompactação bem-sucedida | Guardar XML, chave e DPS. |
| Falha de rede/timeout | Erro de transporte; timeout configurado em 60 segundos | Tratar o resultado como potencialmente indeterminado; conciliar antes de decidir um novo envio. |

O relatório fiscal tem `code`, `path`, severidade, origem, mensagem e, em alguns casos, sugestão. Atualmente todos os problemas gerados têm severidade `error`, origem `sdk`, e `warnings` vem vazio. `normalizedPayload` é a entrada original, sem normalização efetiva. A API pressupõe os blocos estruturais tipados; JSON arbitrário pode provocar erro comum antes de produzir relatório.

A chave é lida do corpo da resposta ou do atributo `Id="NFS..."` do XML. Se não for encontrada, o retorno ainda pode ser considerado sucesso com chave vazia. O SDK não verifica a assinatura da NFS-e recebida nem impõe validação da chave retornada.

Não existem armazenamento, estados persistentes, idempotência, controle de concorrência, fila ou retentativa automática. A consulta exposta usa chave de acesso; não há método de consulta por ID da DPS. A aplicação precisa definir como conciliar uma emissão cujo envio teve resposta incerta.

**Certificado:** `assertCertificateForProvider` verifica vigência e busca o CPF/CNPJ do prestador nos dados do certificado, mas não é chamada por `emitirNfse`, `prepararNota` ou `transmitirNotaPreparada`. A verificação criptográfica da assinatura não substitui essa checagem de titularidade/vigência.

Base: [respostas](/Users/tiagofonseca/priv_repo/nfse-sdk/emissaoNota.ts:89), [certificado](/Users/tiagofonseca/priv_repo/nfse-sdk/certificateValidation.ts:15), [XSD](/Users/tiagofonseca/priv_repo/nfse-sdk/xsdValidation.ts:67), [transporte e erros](/Users/tiagofonseca/priv_repo/nfse-sdk/sefinClient.ts:205).

## 9. Catálogo de cenários para produto e QA

Os eixos abaixo são combináveis. A aceitação local de uma combinação não equivale à autorização fiscal.

| Eixo | Casos a distinguir | Cobertura atual |
| --- | --- | --- |
| Prestador | CPF; CNPJ; ambos; nenhum; formato inválido | Aceita exatamente um documento numérico no formato previsto. |
| Regime | Não optante; MEI; ME/EPP; código desconhecido | Três regimes válidos, cada um com modalidade exclusiva de `totTrib`. |
| Operação | Nacional tributável; imune; não incidência; exportação; estrangeiro tributável; importação | Primeiros quatro representáveis; últimos dois sem fluxo JSON adequado. |
| Tomador nacional | PJ; PF; ausente; documento duplicado; endereço ausente/exterior | PJ/PF com endereço nacional ou bloco ausente. |
| Tomador exterior | NIF; dispensado; não exigido; ausente; CPF/CNPJ; endereço ausente/nacional | NIF ou justificativas `1/2` com endereço exterior, ou bloco ausente. |
| Retenção ISS | Sem retenção; tomador; intermediário | Códigos aceitos sem dependência de existência do responsável. |
| Valores | Reais; conversão; ambos; zero; negativo; vírgula; excesso de casas; divergência cambial | Ver regras VAL-01 a VAL-08. |
| Países | Resultado exterior; resultado Brasil; código malformado; país do tomador diferente | Verifica formato; não resolve a classificação material. |
| Tributos federais | Bloco ausente; CST isolado; base/alíquotas/valores; retenções | Representação declaratória, sem cálculo ou cruzamento tributário. |
| Recursos especiais | Obra; evento; desconto; dedução; IBS/CBS; cancelamento; substituição | Suporte parcial ou ausente, conforme seção 7. |
| Ciclo operacional | Preparação; falha local; autorização; rejeição; rede incerta; consulta; evento | SDK transporta e retorna dados; aplicação gerencia o ciclo. |

**Duas configurações de referência, sem prescrever enquadramento fiscal:**

- Nacional: prestador e serviço válidos; `vServ="1000.00"`; tomador CNPJ + nome + endereço nacional; `tribISSQN="1"`, `tpRetISSQN="1"`; modalidade de `totTrib` correspondente ao regime.
- Exterior: mesmos blocos comuns; tomador NIF + nome + endereço exterior; `vServMoeda="1000.00"`, cotação `5`; comércio exterior com códigos aplicáveis; `tribISSQN="3"`, país do resultado `US`, `tpRetISSQN="1"`; modalidade de `totTrib` correspondente ao regime. Sem `vServ` explícito, gera `5000.00` reais.

Os números e códigos ilustram formatos. A escolha fiscal continua dependendo da operação e do cadastro efetivos.

## 10. Lacunas confirmadas e decisões prioritárias

As ações desta seção são recomendações; não representam mudanças implementadas nesta análise.

| Prioridade | Achado | Evidência / impacto | Decisão recomendada |
| --- | --- | --- | --- |
| Alta | Comércio exterior implica exportação de ISS | Não há caminho JSON coerente para estrangeiro tributável; `cPaisResult=BR` passa como exportação | Separar país do cliente, local da prestação, local do resultado e tratamento do ISS. |
| Alta | Valores cambiais podem divergir | `vServ=1.00` pode coexistir com `1000.00 × 5`; valor estrangeiro do bloco também pode ser diferente | Definir fonte única dos valores e política explícita de divergência. |
| Alta | Ambiente do XML pode divergir do destino | `options.ambiente` sobrescreve o envio depois da geração | Resolver um único ambiente antes de construir a DPS e manter a consulta consistente. |
| Alta | Validação de certificado desconectada | Rotina existe, mas não integra emissão/preparação/transmissão | Definir política de titularidade/representação e aplicar a checagem no ponto apropriado. |
| Alta | Cobertura incompleta do leiaute | IBS/CBS, prestação por país, descontos, deduções e outros grupos ausentes | Definir escopo comercial suportado e evolução do modelo a partir dos cenários reais. |
| Média | Atalhos e `valores` não seguem a mesma regra | A matriz usa o objeto `valores` inteiro; outras validações usam fallback campo a campo. Nacional com atalhos de câmbio pode passar; exportação com dados divididos pode falhar | Normalizar a entrada antes de validar. |
| Média | Obra com inscrição gera ordem inválida | `cObra` é serializado antes de `inscImobFisc`; XSD exige a ordem inversa | Corrigir ordem e validar o grupo antes da geração. |
| Média | Pré-validação aceita valores que falham depois | Moeda estrangeira com três casas e obra vazia passam no JSON e falham no XSD | Alinhar a validação antecipada à saída efetiva. |
| Média | Retenção não exige responsável | Retido pelo tomador/intermediário é aceito sem essas pessoas | Explicitar dependências conforme regras oficiais aplicáveis. |
| Média | Sucesso pode vir sem chave | HTTP 2xx com XML válido para descompressão pode retornar chave vazia | Definir resultado incompleto e validações mínimas da resposta. |
| Média | Documentação diverge do código | README usa exportação sem comércio exterior e país `BR`; exemplo do cliente omite endereço. JSON_MAPPING descreve CNPJ obrigatório, `tpInsc` e totais de forma incompatível com a implementação | Atualizar exemplos e tabelas a partir de casos executáveis. |
| Média | Descrições de modo de prestação divergem nos XSD locais | Tipos simples e complexos atribuem significados diferentes aos códigos `3/4` | Conferir o domínio oficial aplicável antes de publicar rótulos de produto. |

Além dessas lacunas, a camada consumidora precisa assumir decisões ainda inexistentes: elegibilidade cadastral e municipal, correlação entre códigos fiscais, justificativa da natureza tributária, política cambial, numeração concorrente, persistência, conciliação e tratamento de rejeições.

## 11. Evidência e limites da verificação

A análise cruzou validadores, builders, transmissão, cliente, testes, documentação interna e os XSD 1.01 distribuídos no repositório. Em divergências, o comportamento executável foi usado como referência do produto atual.

**Verificações executadas:**

- **25 testes existentes passaram**, cobrindo JSON, XSD, erros de infraestrutura do validador, ambientes e compactação.
- **83 cenários adicionais foram executados:** 63 combinações de operação, regime, retenção e identificação do tomador; 20 casos de borda. Os resultados confirmaram as aceitações e rejeições descritas, incluindo país `BR` em exportação, divergências cambiais, atalhos mistos, obra e arredondamento para zero.
- Os cenários aceitos pela pré-validação também foram submetidos ao XSD, distinguindo sucesso no JSON de sucesso estrutural.

`npm test` não pôde ser executado pelo comando padrão: o ambiente não tinha `npm` nem as dependências do projeto instaladas. Os 25 testes foram executados em cópia temporária, com remoção de tipos pelo Node disponível no aplicativo e exportação dos módulos necessários. Isso não substitui compilação TypeScript nem a suíte completa de assinatura, certificado, cliente e transporte.

Nenhuma nota foi transmitida, nenhum certificado real foi utilizado e não houve homologação com a SEFIN. As evidências demonstram comportamento local, não aceitação em produção. O código de emissão não foi alterado.

**Referências de manutenção:** [validador fiscal](/Users/tiagofonseca/priv_repo/nfse-sdk/fiscalValidation.ts), [modelo e XML](/Users/tiagofonseca/priv_repo/nfse-sdk/dpsJson.ts), [testes de regras](/Users/tiagofonseca/priv_repo/nfse-sdk/test/dpsJson.test.ts), [testes de XSD](/Users/tiagofonseca/priv_repo/nfse-sdk/test/xsdValidation.test.ts), [matriz interna anterior](/Users/tiagofonseca/priv_repo/nfse-sdk/docs/FISCAL_MATRIX.md), [mapeamento anterior](/Users/tiagofonseca/priv_repo/nfse-sdk/JSON_MAPPING.md).
