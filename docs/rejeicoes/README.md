# Códigos de rejeição da NFS-e Nacional

Os 496 códigos de rejeição dos anexos oficiais publicados em gov.br/nfse, um por página,
com a mensagem, a regra e o campo oficiais. Gerado a partir do catálogo do
[`@useinvio/nfse-sdk`](../../README.md), o mesmo usado por `explicarRejeicao` e pela
ferramenta MCP `explain_rejection`.

Fontes:

- [Anexo I - Leiaute e Regras de Negocio DPS/NFS-e v1.01 (09/02/2026)](https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/documentacao-atual/anexo_i-sefin_adn-dps_nfse-snnfse-v1-01-20260209.xlsx)
- [Anexo II - Leiaute e Regras de Negocio de Eventos v1.01 (22/01/2026)](https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/documentacao-atual/anexo_ii-sefin_adn-pedregevt_evt-snnfse-v1-01-20260122.xlsx)

## DPS e NFS-e

| Código | Mensagem oficial |
|---|---|
| [E0001](E0001.md) | O prazo de aceitação da versão do leiaute da DPS expirou. |
| [E0004](E0004.md) | Conteúdo do identificador informado na DPS difere da concatenação dos campos correspondentes. |
| [E0006](E0006.md) | Ambiente informado diverge do ambiente de recebimento para o qual o emitente enviou a DPS. |
| [E0008](E0008.md) | A data e hora de emissão da DPS deve ser anterior ou igual à data do seu processamento (dhProc) pelo Sistema Nacional NFS-e. |
| [E0010](E0010.md) | A série informada na DPS não pertence à faixa definida para o tipo de emissor utilizado para a sua emissão. |
| [E0014](E0014.md) | Conjunto de Série, Número, Código do Município Emissor e CNPJ/CPF informado nesta DPS já existe em uma NFS-e gerada a partir de uma DPS env… |
| [E0015](E0015.md) | A data de competência informada na DPS não pode ser posterior à data de emissão (dhEmi) da DPS. |
| [E0016](E0016.md) | A data de competência deve ser igual ou posterior à data de ativação do convênio do município emissor informado na DPS, exceto quando o emi… |
| [E0018](E0018.md) | A data de competência informada na DPS deve ser igual ou posterior à data de inscrição do CNPJ do emitente no cadastro CNPJ. |
| [E0020](E0020.md) | A data de competência informada na DPS deve ser igual ou posterior à data de inscrição do CPF do emitente no cadastro CPF. |
| [E0023](E0023.md) | A data de competência informada na DPS deve ser igual ou posterior à data do indicador municipal, registrada no CNC do município correspond… |
| [E0025](E0025.md) | A data de competência informada na DPS deve ser igual ou posterior à data autorizasção de uso do emissores, registrada no CNC do município… |
| [E0029](E0029.md) | O motivo da emissão não pode ser preenchido se o emitente for o prestador de serviço. |
| [E0031](E0031.md) | Não pode haver retenção do ISSQN pelo tomador quando o município de incidência não for o do tomador. |
| [E0032](E0032.md) | Não pode haver retenção do ISSQN pelo intermediário quando o município de incidência não for o do intermediário. |
| [E0034](E0034.md) | Somente é permitido o preenchimento do campo de chave de acesso de NFS-e rejeitada se o tipo de emitente for Tomador ou Intermediário e o m… |
| [E0035](E0035.md) | A chave de acesso de NFS-e informada nesta DPS não possui a ela vinculada o evento de manifestação de rejeição emitido pelo mesmo emitente… |
| [E0037](E0037.md) | O código do município emissor informado na DPS é inexistente no cadastro de convênio municipal do sistema nacional. |
| [E0038](E0038.md) | A situação do convênio do município emissor informado na DPS deve ser "ATIVO" no cadastro de convênio municipal do sistema nacional. |
| [E0039](E0039.md) | O município emissor informado na DPS deve estar parametrizado para utilizar os emissores públicos nacionais, conforme parametrização do mun… |
| [E0041](E0041.md) | O município emissor não corresponde ao município do emitente MEI no CNPJ. |
| [E0042](E0042.md) | Chave de NFS-e a ser substituída é inválida. |
| [E0044](E0044.md) | NFS-e não existe na base de dados do autorizador de NFS-e nacional. Informe uma chave de NFS-e existente. |
| [E0046](E0046.md) | Uma NFS-e cancelada não pode ser substituída. Informe uma chave de NFS-e não cancelada anteriormente. |
| [E0050](E0050.md) | Uma NFS-e não pode ser substituída fora do prazo estabelecido pelo município emissor da NFS-e. |
| [E0056](E0056.md) | NFS-e não pode ser substituída pois não possui identificação do tomador. |
| [E0058](E0058.md) | Não poderá ocorrer a substituição de NFS-e com alteração da identificação do não emitente, conforme parametrização do município emissor da… |
| [E0060](E0060.md) | Os campos data de competência, subitem da lista nacional de serviços, código complementar municipal e local da prestação não podem ser alte… |
| [E0061](E0061.md) | Os campos identificação do Tomador (se identificado na DPS), data de competência (dCompet), e valor do serviço (vServ), não podem ser alter… |
| [E0065](E0065.md) | Não é possível substituição da NFS-e que tenha sido gerada em ambientes geradores diferentes. |
| [E0068](E0068.md) | Não é possível a substituição desta NFS-e pois a mesma possui registro de Evento de Solicitação de Análise Fiscal para Cancelamento de NFS-… |
| [E0070](E0070.md) | Não é possível a substituição desta NFS-e pois já ocorreu uma manifestação de confirmação de serviço. Para mais informações, consultar a Ad… |
| [E0072](E0072.md) | Não é possível a substituição desta NFS-e pois já ocorreu uma manifestação tácita da NFS-e. Para mais informações, consultar a Administraçã… |
| [E0074](E0074.md) | Não é permitido realizar a substituição para NFS-e que possua Evento de Tributos Recolhidos vinculado, conforme parametrização do município… |
| [E0076](E0076.md) | Não é permitido realizar a substituição para NFS-e que possua Evento de Bloqueio de Ofício para o Evento de Cancelamento de NFS-e por Subst… |
| [E0078](E0078.md) | Quando o campo cMotivo = 99, o campo xMotivo deve informado obrigatoriamente. |
| [E0080](E0080.md) | CNPJ do prestador informado na DPS é inválido. |
| [E0082](E0082.md) | CNPJ do emitente prestador não encontrado no cadastro CNPJ na data de competência. |
| [E0084](E0084.md) | CNPJ do emitente prestador não possui estabelecimento ou domicílio em um município correspondente ao município emissor, na data de competên… |
| [E0096](E0096.md) | CPF do prestador informado na DPS é inválido. |
| [E0098](E0098.md) | CPF do emitente prestador não encontrado no cadastro CPF na data de competência. |
| [E0099](E0099.md) | CPF do emitente prestador não possui estabelecimento ou domicílio em um município correspondente ao município emissor, na data de competênc… |
| [E0112](E0112.md) | O prestador de serviço, quando emitente da DPS, não pode ser identificado pelo NIF. |
| [E0113](E0113.md) | O NIF ou cNaoNIF do prestador deve ser informado quando o grupo de informações de endereço no exterior do prestador de serviços foi informa… |
| [E0114](E0114.md) | O prestador de serviço, quando emitente da DPS, somente pode ser identificado pelo CNPJ ou CPF. |
| [E0115](E0115.md) | Valor 0 para o motivo da não informação do NIF do prestador não é permitido na Sefin do Sistema Nacional NFS-e. |
| [E0116](E0116.md) | A IM deve ser informada para o emitente prestador do serviço na DPS, conforme informações complementares registradas no CNC NFS-e do municí… |
| [E0119](E0119.md) | IM do emitente prestador não está autorizado a emitir NFS-e, conforme informações complementares registradas no CNC NFS-e do município emis… |
| [E0120](E0120.md) | IM do prestador não deve ser informado, pois não existem informações complementares registradas no CNC NFS-e do município emissor informado… |
| [E0121](E0121.md) | O nome ou razão social do prestador não deve ser informado quando o emitente da DPS for o próprio prestador. |
| [E0122](E0122.md) | O nome ou razão social do prestador deve ser informado quando o emitente da DPS não for o próprio prestador. |
| [E0123](E0123.md) | O preenchimento do nome empresarial é obrigatório quando o prestador for identificado com NIF. |
| [E0124](E0124.md) | O IM informado está inativo no CNC NFS-e do município emissor para a data de competência informada na DPS. |
| [E0125](E0125.md) | O endereço nacional do prestador do serviço deve ser informado na DPS quando for identificado pelo CNPJ ou CPF e o emitente da DPS for o to… |
| [E0128](E0128.md) | O endereço do prestador do serviço não deve ser informado na DPS quando o próprio prestador for o emitente da DPS. |
| [E0129](E0129.md) | O endereço do prestador deve ser informado na DPS quando o prestador não for o emitente da DPS. |
| [E0130](E0130.md) | O código do município para o endereço do prestador do serviço não existe conforme tabela de município do IBGE. |
| [E0132](E0132.md) | O código do município informado na DPS para o endereço do prestador do serviço, identificado pelo CNPJ, não corresponde ao município regist… |
| [E0134](E0134.md) | O código do município informado na DPS para o endereço do prestador do serviço, identificado pelo CPF, não corresponde ao município registr… |
| [E0138](E0138.md) | O CEP informado para o endereço nacional do prestador do serviço não existente ou não pertence ao município informado na DPS. Informe um CE… |
| [E0142](E0142.md) | O grupo de informações de endereço no exterior deve ser informado obrigatoriamente quando o prestador for identificado pelo NIF e o emitent… |
| [E0146](E0146.md) | O código de país informado para o endereço no exterior do prestador do serviço não existe ou é igual ao código do Brasil. Informe um código… |
| [E0148](E0148.md) | Email inválido. |
| [E0160](E0160.md) | No mês de competência da NFS-e, a opção de situação perante o Simples Nacional, do prestador, informada na DPS não está de acordo com o cad… |
| [E0161](E0161.md) | NFS-e cujo emitente for MEI somente poderá ser compartilhada pelo município com o ADN se a data de competência, informada na NFS-e, for men… |
| [E0162](E0162.md) | Não é permitido ao não optante do Simples Nacional e o MEI preencherem o campo de indicação do regime de apuração dos tributos apurados. |
| [E0166](E0166.md) | É obrigatorio o preenchimento do campo de regime de apuração dos tributos do SN para o optante do Simples Nacional ME/EPP. |
| [E0172](E0172.md) | O Regime Especial de Tributação deve ser "Nenhum" (regEspTrib = 0) quando o serviço prestado for diferente de Tributável (tribISSQN = 1), o… |
| [E0174](E0174.md) | Quando o prestador da NFS-e é MEI (opSimpNac = 2) o regime especial de tributação deve ser "Nenhum" (regEspTrib = 0). |
| [E0175](E0175.md) | Quando o prestador optante pelo Simples Nacional tiver o regime de apuração dos tributos ocorrendo também pelo Simples Nacional, o regime e… |
| [E0176](E0176.md) | É permitido informar Profissional Autônomo na DPS somente se o prestador de serviço estiver parametrizado como Profissional Autônomo, na da… |
| [E0177](E0177.md) | Regime especial de tributação informado na DPS não é admitido na parametrização do município de incidência do ISSQN. |
| [E0178](E0178.md) | Regime especial de tributação não permitido para o prestador do serviço com código de tributação na data de competência, informados na DPS,… |
| [E0187](E0187.md) | O grupo de informações relativas ao tomador/adquirente do serviço é obrigatório para o indicador de operação informado. |
| [E0188](E0188.md) | CNPJ do tomador informado na DPS é inválido. |
| [E0190](E0190.md) | CNPJ do tomador não encontrado no cadastro CNPJ. |
| [E0194](E0194.md) | CNPJ do emitente tomador não possui estabelecimento ou domicílio em um município correspondente ao município emissor, na data de competênci… |
| [E0202](E0202.md) | Na emissão da NFS-e não é permitido que o prestador do serviço seja igual ao tomador do serviço. |
| [E0204](E0204.md) | CNPJ ou CPF do tomador não foi informado, mas existe uma indicação para retenção do ISSQN na DPS no campo de tipo de "Retenção do ISSQN". |
| [E0206](E0206.md) | CPF do tomador informado na DPS é inválido. |
| [E0207](E0207.md) | CPF do tomador não encontrado no cadastro CPF. |
| [E0212](E0212.md) | CPF do emitente tomador não possui estabelecimento ou domicílio em um município correspondente ao município emissor, na data de competência… |
| [E0222](E0222.md) | O tomador de serviço, quando emitente da DPS, não pode ser identificado pelo NIF. |
| [E0223](E0223.md) | O NIF ou cNaoNIF do tomador deve ser informado quando o grupo de informações de endereço no exterior do tomador de serviços foi informado. |
| [E0224](E0224.md) | O tomador de serviço, quando emitente da DPS, somente pode ser identificado pelo CNPJ ou CPF. |
| [E0226](E0226.md) | Valor 0 para o motivo da não informação do NIF do tomador não é permitido na Sefin do Sistema Nacional NFS-e. |
| [E0228](E0228.md) | A IM deve ser informada para o emitente tomador do serviço na DPS, conforme informações complementares registradas no CNC NFS-e do municípi… |
| [E0229](E0229.md) | O IM informado está inativo no CNC NFS-e do município emissor para a data de competência informada na DPS. |
| [E0231](E0231.md) | IM do emitente tomador não está autorizado a emitir NFS-e, conforme informações complementares registradas no CNC NFS-e do município emisso… |
| [E0232](E0232.md) | IM do tomador não deve ser informado, pois não existem informações complementares registradas no CNC NFS-e do município emissor informado n… |
| [E0233](E0233.md) | O nome tomador deve ser preenchido obrigatoriamente quando o NIF do tomador for preenchido. |
| [E0234](E0234.md) | O endereço do tomador é obrigatório para o indicador de operação informado ou quando a incidência do ISSQN definida para o serviço prestado… |
| [E0235](E0235.md) | O endereço nacional do tomador do serviço deve ser informado na DPS quando o tomador for identificado pelo CNPJ. |
| [E0236](E0236.md) | O endereço nacional do tomador do serviço não deve ser informado na DPS quando o próprio tomador do serviço for o emitente da DPS. |
| [E0237](E0237.md) | O endereço nacional do tomador do serviço deve ser informado na DPS quando o valor do ISSQN for retido pelo tomador, exceto se o emitente d… |
| [E0238](E0238.md) | O código do município informado na DPS para o endereço do tomador do serviço não existe conforme tabela de município do IBGE. |
| [E0240](E0240.md) | O CEP informado para o endereço nacional do tomador do serviço não existe ou não pertence ao município do endereço do tomador. |
| [E0242](E0242.md) | O grupo de informações de endereço no exterior deve ser informado obrigatoriamente quando o tomador for identificado pelo NIF e o emitente… |
| [E0246](E0246.md) | O código de país informado para o endereço no exterior do tomador do serviço não existe ou é igual ao código do Brasil. Informe um código d… |
| [E0247](E0247.md) | Email inválido. |
| [E0248](E0248.md) | CNPJ do intermediário informado na DPS é inválido. |
| [E0250](E0250.md) | CNPJ do intermediário não encontrado no cadastro CNPJ. |
| [E0254](E0254.md) | CNPJ do emitente intermediário não possui estabelecimento ou domicílio em um município correspondente ao município emissor, na data de comp… |
| [E0262](E0262.md) | Na emissão da NFS-e não é permitido que o prestador do serviço seja igual ao intermediário do serviço. |
| [E0264](E0264.md) | CNPJ ou CPF do intermediário não foi informado, mas existe uma indicação para retenção do ISSQN na DPS no campo de tipo de "Retenção do ISS… |
| [E0266](E0266.md) | CPF do intermediário informado na DPS é inválido. |
| [E0268](E0268.md) | CPF do intermediário não encontrado no cadastro CPF. |
| [E0272](E0272.md) | CPF do emitente intermediário não possui estabelecimento ou domicílio em um município correspondente ao município emissor, na data de compe… |
| [E0280](E0280.md) | O intermediário de serviço, quando emitente da DPS, não pode ser identificado pelo NIF. |
| [E0281](E0281.md) | O NIF ou cNaoNIF do intermediário deve ser informado quando o grupo de informações de endereço no exterior do intermediário de serviços foi… |
| [E0284](E0284.md) | O intermediário de serviço, quando emitente da DPS, somente pode ser identificado pelo CNPJ ou CPF. |
| [E0286](E0286.md) | Valor 0 para o motivo da não informação do NIF do intermediário não é permitido na Sefin do Sistema Nacional NFS-e. |
| [E0287](E0287.md) | A IM não foi informada para o emitente intermediário do serviço na DPS. |
| [E0288](E0288.md) | O IM informado está inativo no CNC NFS-e do município emissor para a data de competência informada na DPS. |
| [E0289](E0289.md) | IM do emitente intermediário não está autorizado a emitir NFS-e, conforme informações complementares registradas no CNC NFS-e do município… |
| [E0290](E0290.md) | IM do intermediário não deve ser informado, pois não existem informações complementares registradas no CNC NFS-e do município emissor infor… |
| [E0291](E0291.md) | O endereço nacional do intermediário do serviço não deve ser informado na DPS quando o próprio tomador do serviço for o emitente da DPS. |
| [E0292](E0292.md) | O nome intermediário deve ser preenchido obrigatoriamente quando o NIF do intermediário for preenchido. |
| [E0293](E0293.md) | O endereço nacional do intermediário do serviço deve ser informado na DPS quando o valor do ISSQN for retido pelo intermediário, exceto se… |
| [E0294](E0294.md) | O código do município informado na DPS para o endereço do intermediário do serviço não existe conforme tabela de município do IBGE. |
| [E0296](E0296.md) | O CEP informado para o endereço nacional do intermediário do serviço não existe ou não pertence ao município do endereço do intermediário. |
| [E0298](E0298.md) | O grupo de informações de endereço no exterior deve ser informado obrigatoriamente quando o intermediário for identificado pelo NIF e o emi… |
| [E0299](E0299.md) | O código de país informado para o endereço no exterior do intermediário do serviço não existe ou é igual ao código do Brasil. Informe um có… |
| [E0300](E0300.md) | Email inválido. |
| [E0302](E0302.md) | O código do local da prestação do serviço não existe conforme a tabela de municípios IBGE disponibilizada no ANEXO_A-MUNICIPIO_IBGE-PAISES_… |
| [E0304](E0304.md) | Informe um código de país existente e diferente de Brasil (BR), conforme tabela de país do ANEXO_A-MUNICIPIO_IBGE-PAISES_ISO2-SNNFSe-ESPEC. |
| [E0310](E0310.md) | O código de tributação nacional informado não existe conforme a lista de serviços nacional do Sistema Nacional NFS-e. |
| [E0312](E0312.md) | O código de tributação nacional informado não está administrado pelo município de incidência do ISSQN na data de competência informada na D… |
| [E0314](E0314.md) | O código de tributação municipal informado não existe ou não está administrado pelo município de incidência do ISSQN na data de competência… |
| [E0315](E0315.md) | Não é permitido informar 000 para o codigo de tributação municipal na DPS. |
| [E0316](E0316.md) | Código da lista NBS informado inexistente tabela de NBS do sistema. |
| [E0318](E0318.md) | É obrigatório informar na DPS um item da NBS para casos de exportação de serviço. |
| [E0320](E0320.md) | É obrigatório informar na DPS um item da NBS para casos de importação de serviço. |
| [E0322](E0322.md) | É obrigatório informar na DPS um item da NBS se for declarada qualquer informação de IBS/CBS. |
| [E0330](E0330.md) | É obrigatório prestar informações de comércio exterior para as situações de exportação de serviços. |
| [E0331](E0331.md) | É obrigatório prestar informações de comércio exterior para as situações de importação de serviços. |
| [E0333](E0333.md) | Valor 0 para o modo de prestação não é permitido na Sefin do Sistema Nacional NFS-e. |
| [E0341](E0341.md) | Valor 0 para o Mecanismo de apoio/fomento ao Comércio Exterior utilizado pelo prestador do serviço não é permitido na Sefin do Sistema Naci… |
| [E0343](E0343.md) | Valor 0 para o Mecanismo de apoio/fomento ao Comércio Exterior utilizado pelo tomador do serviço não é permitido na Sefin do Sistema Nacion… |
| [E0345](E0345.md) | Valor 0 para o Vínculo da Operação à Movimentação Temporária de Bens não é permitido na Sefin do Sistema Nacional NFS-e. |
| [E0352](E0352.md) | O preenchimento do campo nDI (Número da Declaração de Importação) é obrigatório quando o campo (movTempBens) Vínculo da Operação à Moviment… |
| [E0354](E0354.md) | O preenchimento dos campos nDI (Número da Declaração de Importação) ou do nRE (úmero do Registro de Exportação) não é permitido quando o ca… |
| [E0356](E0356.md) | O preenchimento do campo nRE (úmero do Registro de Exportação) é obrigatório quando o campo (movTempBens) Vínculo da Operação à Movimentaçã… |
| [E0370](E0370.md) | O grupo de informações de obra é obrigatório quando o código de tributação nacional pertencer a um dos subitens 07.02.01, 07.02.02, 07.04.0… |
| [E0372](E0372.md) | O grupo de informações de obra não é permitido quando o código de tributação nacional não pertencer a algum dos subitens 07.02.01, 07.02.02… |
| [E0373](E0373.md) | Código CIB inválido. |
| [E0380](E0380.md) | Informe um CEP correspondente ao município do local da prestação do serviço informado nesta DPS para indicar corretamente o endereço da obr… |
| [E0382](E0382.md) | O CEP não deve ser informado quando o endereço da obra ocorrer no exterior do país. |
| [E0384](E0384.md) | O grupo de informações de endereço da atividade de obra ocorrido no exterior deve ser informado quando o país do local da prestação for inf… |
| [E0386](E0386.md) | O grupo de informações de endereço da atividade de obra ocorrido no exterior não deve ser informado quando o município do local da prestaçã… |
| [E0390](E0390.md) | O grupo de informações de Atividade/Evento é obrigatório quando o código de tributação nacional pertencer ao item 12 da lista de serviços. |
| [E0392](E0392.md) | O grupo de informações de Atividade/Evento não é permitido quando o código de tributação nacional não pertencer ao item 12 da lista de serv… |
| [E0398](E0398.md) | Informe um CEP correspondente ao município do local da prestação do serviço informado nesta DPS para indicar corretamente o endereço da ati… |
| [E0400](E0400.md) | O CEP não deve ser informado quando o endereço da atividade de evento ocorrer no exterior do país. |
| [E0402](E0402.md) | O grupo de informações de endereço da atividade de evento ocorrido no exterior deve ser informado quando o país do local da prestação for i… |
| [E0404](E0404.md) | O grupo de informações de endereço da atividade de evento ocorrido no exterior não deve ser informado quando o município do local da presta… |
| [E0420](E0420.md) | O documento de referência deve ser obrigatoriamente informado quando o emitente da DPS for o tomador ou intermediário do serviço. |
| [E0423](E0423.md) | O valor recebido deve ser informado na DPS quando o intermediário do serviço for o emitente da DPS. |
| [E0424](E0424.md) | O valor recebido não deve ser informado na DPS quando o prestador ou tomador do serviço for o emitente da DPS. |
| [E0425](E0425.md) | O valor recebido não pode ser menor que o valor do serviço informado na DPS. |
| [E0427](E0427.md) | O valor do serviço deve ser maior ou igual ao somatório dos valores informados para Desconto Incondicionado, Deduções/Reduções e Benefício… |
| [E0428](E0428.md) | O valor do serviço deve ser maior ou igual ao somatório dos valores informados para Desconto Incondicionado, Desconto Condicionado, Deduçõe… |
| [E0429](E0429.md) | O ISSQN não pode ser objeto de redução de base de cálculo que resulte em carga tributária menor que a decorrente da aplicação da alíquota m… |
| [E0431](E0431.md) | O valor do desconto incondicionado informado na DPS deve ser menor que o valor do serviço e maior que zero. |
| [E0432](E0432.md) | O valor do desconto condicionado informado na DPS deve ser menor que o valor do serviço e maior que zero. |
| [E0435](E0435.md) | Não é permitido o preenchimento dos campos do grupo de informações relativas à Dedução/Redução do ISSQN quando ocorrer Imunidade, Exportaçã… |
| [E0436](E0436.md) | Não é permitido o preenchimento dos campos do grupo de informações relativas à Dedução/Redução do ISSQN quando o prestador de serviço é MEI. |
| [E0438](E0438.md) | Não é permitido o preenchimento dos campos do grupo de informações relativas à Dedução/Redução do ISSQN, quando o prestador de serviço tive… |
| [E0439](E0439.md) | Não é permitido o preenchimento dos campos do grupo de informações relativas à Dedução/Redução do ISSQN, quando o benefício municipal infor… |
| [E0440](E0440.md) | O tipo de dedução/redução informado na DPS não é permitida pelo município de incidência do ISSQN, conforme parametrizações do código de ser… |
| [E0441](E0441.md) | Não é permitido o preenchimento de informações relativas à Dedução/Redução para o prestador de serviço ME/EPP, apurando pelo SN conforme pa… |
| [E0442](E0442.md) | O tipo de dedução/redução informado na DPS não é permitida para o prestador de serviço ME/EPP, apurando pelo SN. |
| [E0444](E0444.md) | O valor percentual  de dedução/redução informado na DPS não pode reduzir o valor da BC de forma que resulte no valor do ISSQN a uma alíquot… |
| [E0446](E0446.md) | Código de serviço informado na DPS não permite dedução/redução na base de cálculo do ISSQN por valor monetário. |
| [E0447](E0447.md) | O valor de dedução/redução informado na DPS não pode reduzir o valor da BC de forma que resulte no valor do ISSQN a uma alíquota efetiva me… |
| [E0449](E0449.md) | Código de serviço informado na DPS não permite dedução/redução na base de cálculo do ISSQN por documento informado. |
| [E0453](E0453.md) | O valor percentual para dedução/redução deve ser maior que 0 e menor ou igual a 100%. |
| [E0454](E0454.md) | Código de serviço informado na DPS não permite dedução/redução na base de cálculo do ISSQN por percentual. |
| [E0455](E0455.md) | Informe uma chave de NFS-e válida. |
| [E0456](E0456.md) | NFS-e não existe na base de dados do autorizador de NFS-e nacional. Informe uma chave de NFS-e existente. |
| [E0458](E0458.md) | Uma NFS-e cancelada não pode ser informada para dedução/redução. |
| [E0460](E0460.md) | Informe uma chave de NF-e válida. |
| [E0462](E0462.md) | NF-e não existe na base de dados do autorizador de NF-e nacional. Informe uma chave de NF-e existente. |
| [E0464](E0464.md) | Uma NF-e cancelada não pode ser informada para dedução/redução. |
| [E0466](E0466.md) | Informe um código de município existente para o documento de nota, conforme tabela de municípios do IBGE. |
| [E0468](E0468.md) | Informar, obrigatoriamente, o campo de descrição no caso ideDedRed igual a 99 – Outras deduções. |
| [E0470](E0470.md) | Não informar o campo de descrição no caso ideDedRed diferente a 99 – Outras deduções. |
| [E0472](E0472.md) | A data de emissão do documento informado na DPS não pode ser posterior à data de competência da DPS. |
| [E0474](E0474.md) | O valor de dedução/redução não pode ser superior ao valor dedutível/redutível. |
| [E0476](E0476.md) | O valor de dedução/redução informado na DPS não pode ser superior ao valor do serviço. |
| [E0477](E0477.md) | O grupo de informações para o fornecedor deve ser informado obrigatoriamente para o tipo de documento de dedução/redução informado na DPS. |
| [E0478](E0478.md) | CNPJ do fornecedor informado na DPS é inválido. |
| [E0482](E0482.md) | CNPJ do fornecedor informado na DPS não encontrado no cadastro CNPJ. |
| [E0484](E0484.md) | CPF do fornecedor informado na DPS é inválido. |
| [E0488](E0488.md) | CPF do fornecedor informado na DPS não encontrado no cadastro CPF. |
| [E0490](E0490.md) | Valor 0 para o motivo da não informação do NIF do fornecedor não é permitido na Sefin do Sistema Nacional NFS-e. |
| [E0492](E0492.md) | O grupo de informações de endereço nacional deve ser informado obrigatoriamente quando o fornecedor for identificado pelo CPF ou CNPJ. |
| [E0494](E0494.md) | O código do município informado na DPS para o endereço do fornecedor do serviço não existe conforme tabela de município do IBGE. |
| [E0496](E0496.md) | O CEP informado para o endereço nacional do fornecedor não existe ou não pertence ao município do endereço do fornecedor. |
| [E0498](E0498.md) | O grupo de informações de endereço no exterior deve ser informado obrigatoriamente quando o fornecedor for identificado pelo NIF. |
| [E0499](E0499.md) | O código de país informado para o endereço no exterior do fornecedor não existe ou é igual ao código do Brasil. Informe um código de país e… |
| [E0529](E0529.md) | O sistema considera este cenário para a prestação de serviço informada na DPS uma operação tributável. Não é permitido ao emitente da DPS i… |
| [E0530](E0530.md) | O sistema considera este cenário para a prestação de serviço informada na DPS uma exportação de serviço. Não é permitido ao emitente da DPS… |
| [E0532](E0532.md) | O campo que informa sobre a tributação do ISSQN deve ser "4 - Não Incidência", quando houver o serviço prestado for 99.01.01 - Serviços sem… |
| [E0533](E0533.md) | Não é permitido informar Benefício Municipal (BM deve ser nulo) quando o serviço prestado diferente de Tributável (tribISSQN = 1), ou seja,… |
| [E0534](E0534.md) | Não é permitido o preenchimento de informações relativas à benefício municipal para o prestador de serviço MEI. |
| [E0535](E0535.md) | Não é permitido informar benefício municipal quando o prestador de serviço tiver um regime especial de tributação, ou seja, o campo que ind… |
| [E0536](E0536.md) | Não é permitido o preenchimento de informações relativas à benefício municipal para o prestador de serviço ME/EPP, apurando pelo SN, confor… |
| [E0537](E0537.md) | Não é permitido informar benefício municipal (BM deve ser nulo) quando o município de incidência do ISSQN não está "Ativo" no Sistema Nacio… |
| [E0539](E0539.md) | Não é permitido informar não incidência do ISSQN = 4 (Não Incidência) para qualquer subitem da lista nacional de serviço informado na DPS,… |
| [E0540](E0540.md) | Não há incidência do ISSQN (tribISSQN = 4) pois a parametrização do muncípio de incidência do ISSQN indica que o código de serviço prestado… |
| [E0541](E0541.md) | Não existe o código de identificação do benefício municipal informado na DPS para o municipío de incidência do ISSQN. |
| [E0544](E0544.md) | Período de vigência expirado para o código de identificação do Benefício Municipal no municipío de incidência do ISSQN para a data de compe… |
| [E0548](E0548.md) | O Benefício Municipal informado na DPS não permite benefício para prestadores de serviço que não estejam estabelecidos no município de inci… |
| [E0550](E0550.md) | O código de identificação de Benefício Municipal, informada na DPS, não permite benefício para o código de tributação e/ou prestador (CPF o… |
| [E0565](E0565.md) | Não é permitido informar um valor monetário de redução de base de cálculo do ISSQN por benefício municipal, se o código de identificação do… |
| [E0567](E0567.md) | É obrigatório informar vRedBCBM quando o código de identificação do Benefício Municipal (nBM) for um benefício do tipo Redução de Base de C… |
| [E0574](E0574.md) | O valor monetário do benefício municipal informado na DPS não pode ser superior ao valor do serviço. |
| [E0575](E0575.md) | O valor monetário do benefício municipal informado na DPS não pode reduzir o valor da BC de forma que resulte no valor do ISSQN a uma alíqu… |
| [E0577](E0577.md) | Não é permitido informar um valor percentual de redução de base de cálculo do ISSQN por benefício municipal, se o código de identificação d… |
| [E0579](E0579.md) | É obrigatório informar pRedBCBM quando o código de identificação do Benefício Municipal (nBM) for um benefício do tipo Redução de Base de C… |
| [E0580](E0580.md) | Não é permitido haver retenção quando o campo referente à tributação do ISSQN indicar imunidade, exportação ou não incidência. |
| [E0583](E0583.md) | Não é permitido retenção do ISSQN para o prestador do serviço que seja MEI na data de competência informada na DPS. |
| [E0585](E0585.md) | Somente é permitido informar suspensão de exigibilidade quando a opção da tributação do ISSQN for uma operação tributável (tribISSQN = 1). |
| [E0586](E0586.md) | O valor percentual para redução da base de cálculo deve ser maior que 0 e menor ou igual ao percentual parametrizado pelo município de inci… |
| [E0587](E0587.md) | O valor percentual do benefício municipal informado na DPS não pode reduzir o valor da BC de forma que resulte no valor do ISSQN a uma alíq… |
| [E0588](E0588.md) | Não é permitido retenção do ISSQN para o prestador do serviço que tenha algum regime especial de tributação na data de competência informad… |
| [E0590](E0590.md) | É obrigatório informar o código do país onde ocorreu o resultado do serviço prestado para os cenários 2, 30, 58, 62, 72, 76, conforme a pla… |
| [E0591](E0591.md) | Não é permitido informar o código do país onde ocorreu o resultado do serviço prestado para os cenários diferentes de 2, 30, 58, 62, 72, 76… |
| [E0592](E0592.md) | O tipo de imunidade é obrigatório e deve ser informado somente quando o campo referente à tributação do ISSQN for igual a "2 - Imunidade". |
| [E0593](E0593.md) | Não permitido o valor "0 - Imunidade (tipo não informado na nota de origem)" na DPS quando utilizado os Emissores Públicos Nacionais para e… |
| [E0594](E0594.md) | Não é permitido retenção do ISSQN quando houver Benefício Municipal do tipo Isenção. |
| [E0595](E0595.md) | Não é permitido informar alíquota superior a 5%. |
| [E0596](E0596.md) | Não é permitido retenção do ISSQN quando o serviço prestado corresponder ao subitem 220101 - Serviço de exploração de rodovia da lista de s… |
| [E0600](E0600.md) | Não é permitido informar a alíquota para prestador de serviço optante do simples nacional do tipo MEI. |
| [E0602](E0602.md) | Não é permitido informar alíquota quando o campo referente à tributação do ISSQN indicar imunidade, exportação ou não incidência. |
| [E0604](E0604.md) | Não é permitido informar alíquota quando o prestador de serviço possui algum regime especial de tributação. |
| [E0612](E0612.md) | Não é permitido informar alíquota quando o benefício municipal informado na DPS for do tipo "Isenção" ou "Alíquota Diferenciada". |
| [E0617](E0617.md) | Não é permitido informar alíquota quando o prestador de serviço não é optante do simples nacional (opSimpNac = 1) na data de competência in… |
| [E0619](E0619.md) | É obrigatório informar alíquota quando o prestador de serviço não é optante do simples nacional (opSimpNac = 1) na data de competência info… |
| [E0621](E0621.md) | É obrigatório informar alíquota quando há indicação de retenção do ISSQN (tpRetISSQN = 2 ou 3) para o prestador de serviço ME/EPP (opSimpNa… |
| [E0625](E0625.md) | Não é permitido informar alíquota quando não há indicação de retenção do ISSQN (tpRetISSQN = 1) para o prestador de serviço ME/EPP (opSimpN… |
| [E0628](E0628.md) | É obrigatório informar alíquota quando o município de incidência do ISSQN não está Ativo no Sistema Nacional NFS-e, para o prestador de ser… |
| [E0631](E0631.md) | Não é permitido informar alíquota quando o município de incidência do ISSQN não está Ativo no Sistema Nacional NFS-e, para o prestador de s… |
| [E0635](E0635.md) | Não é permitido informar alíquota quando o convênio do município de incidência do ISSQN está ativo na data de competência informada na DPS,… |
| [E0640](E0640.md) | É obrigatório informar alíquota quando o prestador de serviço ME/EPP (opSimpNac = 3) na data de competência informada na DPS, com apuração… |
| [E0650](E0650.md) | Em caso de importação de serviço pelo tomador, o ISSQN deve ser retido pelo tomador. |
| [E0652](E0652.md) | Em caso de importação de serviço pelo intermediário, o ISSQN deve ser retido pelo intermediário. |
| [E0667](E0667.md) | Município da incidência do ISSQN não autoriza que o CPF do tomador informado na DPS seja indicado para retenção deste imposto. |
| [E0670](E0670.md) | Município da incidência do ISSQN não autoriza que o CPF do intermediário informado na DPS seja indicado para retenção deste imposto. |
| [E0672](E0672.md) | Não pode haver retenção do ISSQN se e o tomador for o emitente da DPS e estiver estabelecido em município diferente do município de incidên… |
| [E0673](E0673.md) | Não pode haver retenção do ISSQN se e o intermediário for o emitente da DPS e estiver estabelecido em município diferente do município de i… |
| [E0675](E0675.md) | Não é permitido a prestação de informações relativas aos tributos federais quando o emitente da DPS for identificado por um pessoa física (… |
| [E0676](E0676.md) | Não é permitido o preenchimento das informações relativas aos tributos federais quando o emitente for identificado como MEI na data de comp… |
| [E0677](E0677.md) | O valor da BC para Pis/Cofins deve ser menor ou igual ao valor do serviço informado na DPS. |
| [E0686](E0686.md) | A alíquota do Pis deve ser igual ou maior que 0 e menor ou igual a 100%. |
| [E0692](E0692.md) | A alíquota do Cofins deve ser igual ou maior que 0 e menor ou igual a 100%. |
| [E0694](E0694.md) | O valor do Pis informado não corresponde ao resultado da BC Pis/Cofins x Alíquota Pis, que foram informados na DPS. |
| [E0696](E0696.md) | O valor do Cofins informado não corresponde ao resultado da BC Pis/Cofins x Alíquota Cofins, que foram informados na DPS. |
| [E0699](E0699.md) | O valor do tributo CP deve ser maior que zero e menor que o valor do serviço informado na DPS. |
| [E0700](E0700.md) | O valor do tributo IRRF deve ser maior que zero e menor que o valor do serviço informado na DPS. |
| [E0701](E0701.md) | O valor do tributo CSLL deve ser maior que zero e menor que o valor do serviço informado na DPS. |
| [E0702](E0702.md) | Se o valor for informado, então deve ser igual ou maior que 0 e menor ou igual o valor do serviço. |
| [E0703](E0703.md) | Se o valor for informado, então deve ser igual ou maior que 0 e menor ou igual o valor do serviço. |
| [E0704](E0704.md) | Se o valor for informado, então deve ser igual ou maior que 0 e menor ou igual o valor do serviço. |
| [E0706](E0706.md) | Se a alíquota for informada, então deve ser igual ou maior que 0 e menor ou igual a 100%. |
| [E0707](E0707.md) | Se a alíquota for informada, então deve ser igual ou maior que 0 e menor ou igual a 100%. |
| [E0708](E0708.md) | Se a alíquota for informada, então deve ser igual ou maior que 0 e menor ou igual a 100%. |
| [E0710](E0710.md) | Para MEI pTotTribSN nunca poderá ser informado. |
| [E0712](E0712.md) | Para ME/EPP indTotTrib nunca poderá ser informado. |
| [E0713](E0713.md) | Para Não Optante do SN os campos, indicador de informação de valor total de tributos e  percentual aproximado do total dos tributos da alíq… |
| [E0714](E0714.md) | Arquivo enviado com erro na assinatura. |
| [E0715](E0715.md) | Certificado Digital da assinatura inválido. |
| [E0716](E0716.md) | Certificado Digital fora do padrão estabelecido. |
| [E0717](E0717.md) | A assinatura é obrigatória quando for enviado para o Web Service. |
| [E0718](E0718.md) | A assinatura deve ser feita com o certificado digital do emitente da DPS. |
| [E0720](E0720.md) | Se o tipo de retenção do PIS/COFINS for igual a "0 - PIS/COFINS/CSLL Não Retidos", então não é permitido informar o campo vRetCSLL. |
| [E0724](E0724.md) | Se o tipo de retenção do PIS/COFINS for diferente de "0 - PIS/COFINS/CSLL Não Retidos" ou de "2 - PIS/COFINS Não Retido", então é obrigatór… |
| [E0850](E0850.md) | É permitido declarar informações de IBS/CBS somente a partir da data de competência 01/01/2026. |
| [E0854](E0854.md) | Somente é permitio declarar informações de IBS/CBS a partir da versão 1,01 da DPS. |
| [E0901](E0901.md) | Código indicador da operação inexistente. |
| [E0903](E0903.md) | Código do tipo de Operação (tpOper) deve ser informado quando se tratar de uma compra governamental ou um dos serviços da LC 116/2003 lista… |
| [E0904](E0904.md) | Código do tipo de Operação (tpOper) não pode ser informado quando não se tratar de uma compra governamental ou um dos serviços da LC 116/20… |
| [E0905](E0905.md) | O grupo de documentos referenciados deve ser informado para o tipo de operação (tpOper). |
| [E0906](E0906.md) | O grupo de documentos referenciados não pode ser informado para o tipo de operação (tpOper). |
| [E0907](E0907.md) | NFS-e referenciada é inválida. |
| [E0910](E0910.md) | O destinatário não deve ser identificado para o código indicador indDest informado. |
| [E0911](E0911.md) | CNPJ do destinatário informado na DPS é inválido. |
| [E0912](E0912.md) | CNPJ do destinatário não encontrado no cadastro CNPJ na data de competência. |
| [E0913](E0913.md) | CPF do destinatário informado na DPS é inválido. |
| [E0914](E0914.md) | CPF do destinatário não encontrado no cadastro CPF na data de competência. |
| [E0920](E0920.md) | O código do município para o endereço do destinatário do serviço não existe conforme tabela de município do IBGE. |
| [E0921](E0921.md) | O código do município informado na DPS para o endereço do destinatário do serviço, identificado pelo CNPJ, não corresponde ao município reg… |
| [E0922](E0922.md) | O código do município informado na DPS para o endereço do destinatário do serviço, identificado pelo CPF, não corresponde ao município regi… |
| [E0928](E0928.md) | Não é permitido o grupo de informações relativo a imóvel quando o código de tributação nacional (cTribNac) não pertencer a algum dos subite… |
| [E0930](E0930.md) | E-mail inválido. |
| [E0931](E0931.md) | Não é permitido o grupo de informações relativo a imóvel quando o código de tributação nacional, relativo à construção civil, for infomado… |
| [E0932](E0932.md) | É obrigatório o grupo de informações relativo ao imóvel na DPS quando o código indicador da operação informado for relacionado à imóvel con… |
| [E0933](E0933.md) | Código CIB inválido. |
| [E0934](E0934.md) | O grupo de informações de endereço da atividade sobre bem imóvel ocorrido no exterior deve ser informado quando o país do local da prestaçã… |
| [E0935](E0935.md) | O grupo de informações de endereço da atividade sobre bem imóvel ocorrido no exterior não deve ser informado quando o município do local da… |
| [E0940](E0940.md) | Chave DF-e incorreta. |
| [E0942](E0942.md) | Outros documentos ficais fiscais não podem ser informados quando a data de competência for posterior a 31 de dezembro de 2025. |
| [E0943](E0943.md) | O código do município emissor do documento fiscal para fins de reembolso, repasse e ressarcimento que não está no repositório nacional está… |
| [E0945](E0945.md) | CNPJ do fornecedor de reembolso, repasse e ressarcimento informado na DPS é inválido. |
| [E0946](E0946.md) | CNPJ do fornecedor de reembolso, repasse e ressarcimento informado não encontrado no cadastro CNPJ na data de competência. |
| [E0947](E0947.md) | CPF do fornecedor de reembolso, repasse e ressarcimento informado informado na DPS é inválido. |
| [E0948](E0948.md) | CPF do fornecedor de reembolso, repasse e ressarcimento informado não encontrado no cadastro CPF na data de competência. |
| [E0950](E0950.md) | Data de emissão do documento tem que ser igual ou posterior à data de competência (dtCompDoc) |
| [E0951](E0951.md) | Data de competência do documento tem que ser igual ou anterior à data de emissão (dtEmiDoc) |
| [E0952](E0952.md) | A descrição do tipo de reembolso, repasse e ressarcimento não deve ser preenchida. |
| [E0953](E0953.md) | O valor reembolso, repasse e ressarcimento deve ser menor ou igual ao valor do serviço prestado. |
| [E0958](E0958.md) | cClassTrib para IBS/CBS incorreto para operação de prestação de serviços. |
| [E0959](E0959.md) | cClassTrib não pertence ao grupo CST indicado. |
| [E0964](E0964.md) | Grupo de tributação regular não deve ser informado. |
| [E0965](E0965.md) | Grupo de tributação regular deve ser informado. |
| [E0969](E0969.md) | cClassTribReg para IBS/CBS incorreto para operação de prestação de serviços. |
| [E0970](E0970.md) | cClassTribReg não pertence ao grupo CST indicado em CSTReg. |
| [E0971](E0971.md) | Grupo de diferimento para IBS/CBS não deve ser informado. |
| [E0972](E0972.md) | Grupo de diferimento para IBS/CBS deve ser informado. |
| [E1260](E1260.md) | O prazo de aceitação da versão do leiaute da NFS-e expirou. |
| [E1263](E1263.md) | Conteúdo informado no identificador da NFS-e difere da concatenação dos campos correspondentes que formam o identificador. |
| [E1268](E1268.md) | Chave de acesso informada para a NFS-e já foi compartilhada com o ADN. |
| [E1270](E1270.md) | A data de competência deve ser igual ou posterior à data de ativação do convênio do município emissor informado na DPS. |
| [E1272](E1272.md) | O código do município informado não existe ou não está ativo no convênio municipal na data de processamento de compartilhamento com o ADN. |
| [E1274](E1274.md) | O ambiente gerador da NFS-e não está de acordo com a definição 1 (Sistema Próprio do Município) ou 2 (Sefin Nacional). |
| [E1276](E1276.md) | A informação do processo de emissão de NFS-e é exclusiva para notas emitidas pela Sefin Nacional NFS-e. O município não deve informar este… |
| [E1278](E1278.md) | A data e hora do processamento (geração) da NFS-e deve ser anterior ou igual à data da recepção pelo Sistema Nacional NFS-e. |
| [E1280](E1280.md) | CNPJ informado para o emitente da NFS-e é inválido (verificar DV). |
| [E1282](E1282.md) | O CNPJ do emitente não corresponde ao CNPJ do informado conforme o tipo de emitente informado na DPS. |
| [E1284](E1284.md) | CPF informado para o emitente da NFS-e é inválido (verificar DV). |
| [E1285](E1285.md) | O CPF do emitente não corresponde ao CPF do informado conforme o tipo de emitente informado na DPS. |
| [E1286](E1286.md) | O código do município do emitente da NFS-e difere do código do municipio emissor informado na NFS-e. |
| [E1287](E1287.md) | O valor calculado de dedução/redução não corresponde aos valores de (valor do serviço x percentual de dedução/redução), quando pDR é inform… |
| [E1288](E1288.md) | O valor calculado do percentual de reduçãõ da base de cálculo por Benefício Municipal não corresponde aos valores de (valor do serviço x pe… |
| [E1289](E1289.md) | O produto do valor da base de cálculo pela alíquota aplicada, ambos informados na NFS-e compartilhada, não está de acordo com o resultado c… |
| [E1294](E1294.md) | Prazo para entrega da DF-e excedido. |
| [E1295](E1295.md) | O valor da base cálculo deve ser igual ao valor do serviço menos desconto incondicionado e, valores monetários de dedução/redução e benefíc… |
| [E1297](E1297.md) | O valor BC calculado não pode estar reduzida de forma que resulte para valor do ISSQN a uma alíquota efetiva menor que 2%, exceto para os c… |
| [E1300](E1300.md) | Não é permitido informar alíquota aplicada superior a 5%. |
| [E1301](E1301.md) | Não é permitido informar o código do local de incidência quando o campo referente à tributação do ISSQN indicar imunidade, exportação ou nã… |
| [E1302](E1302.md) | Exceto para o campo vLiq, não é permitido informar os demais campos do grupo valores para prestador de serviço optante do simples nacional… |
| [E1303](E1303.md) | Exceto para o campo vLiq, não é permitido informar os demais campos do grupo valores quando o campo referente à tributação do ISSQN indicar… |
| [E1304](E1304.md) | O código do município emissor da NFS-e não existe conforme tabela do IBGE ou difere do código do municipio que está compartilhando o docume… |
| [E1305](E1305.md) | É obrigatório informar  o código do local de incidência quando o campo referente à tributação do ISSQN indicar Operação Tributável. |
| [E1307](E1307.md) | Exceto para o campo vLiq, não é permitido informar os demais campos do grupo valores quando o prestador de serviço possui algum regime espe… |
| [E1308](E1308.md) | NFS-e a ser substituída não possui um evento de Cancelamento por substituição compartilhado com o ADN e por isso não pode ser substituída. |
| [E1309](E1309.md) | O código do local de incidência do ISSQN não existe conforme a tabela de municípios IBGE ou tabela de concessões de rodovia ou tabela de lo… |
| [E1310](E1310.md) | O identificador desta NFS-e substituta não está referenciado no evento de Cancelamento por substituição da NFS-e substituída. |
| [E1311](E1311.md) | Exceto para o campo vLiq, não é permitido informar os demais campos do grupo valores quando a exigibilidade da tributação do ISSQN estiver… |
| [E1313](E1313.md) | A localidade de incidência para o ISSQN deve corresponder ao município do estabelecimento/domicílio do prestador do serviço, quando não for… |
| [E1317](E1317.md) | O local de incidência do ISSQN deve ser igual ao município da prestação do serviço (NFSe/infNFSe/DPS/infDPS/serv/locPrest/cLocPrestacao) do… |
| [E1321](E1321.md) | O local de incidência do ISSQN deve ser igual ao município do endereço do tomador do serviço informado na NFS-e compartilhada pelo municípi… |
| [E1325](E1325.md) | O local de incidência do ISSQN deve ser igual ao município do endereço do prestador (NFSe/infNFSe/DPS/infDPS/prest/end/endNac/cMun) do serv… |
| [E1327](E1327.md) | É obrigatório informar a descrição do local de incidência quando o código do local de incidência (cLocIncid) for informado. |
| [E1329](E1329.md) | Não é permitido informar a descrição do local de incidência quando o código do local de incidência (cLocIncid) não for informado. |
| [E1388](E1388.md) | O endereço nacional do intermediário do serviço deve ser informado na DPS quando o intermediário for identificado pelo CNPJ. |
| [E1402](E1402.md) | Quando é informado o subitem 200101 para o código de tributação nacional (cTribNac), não é permitido informar 0000000, que representa "Água… |
| [E1506](E1506.md) | O valor total de tributos retidos da NFS-e não pode ser inferior a zero. |
| [E1508](E1508.md) | O valor líquido da NFS-e não pode ser inferior a zero. |
| [E1515](E1515.md) | É obrigatório informar o grupo de informações de IBS/CBS da NFS-e quando o grupo de informações de IBS/CBS da DPS for informado. |
| [E1517](E1517.md) | Não é permitido informar o grupo de informações de IBS/CBS da NFS-e quando o grupo de informações de IBS/CBS da DPS não for informado. |
| [E1521](E1521.md) | Código da localidade de incidência diverge do que deveria ser informado de acordo com a tabela de indicador da operação. |
| [E1522](E1522.md) | O percentual redutor para compras governamentais (IBS/CBS) não deve ser informado. |
| [E1523](E1523.md) | O percentual redutor para compras governamentais (IBS/CBS) deve ser informado. |
| [E1530](E1530.md) | Valor da Base de cálculo para IBS/CBS incorreto. |
| [E1531](E1531.md) | O valor objeto de reembolso, repasse ou ressarcimento já tributados que não integram da base de cálculo do ISSQN, do IBS e da CBS (vCalcRee… |
| [E1533](E1533.md) | O valor objeto de reembolso, repasse ou ressarcimento já tributados que não integram da base de cálculo do ISSQN, do IBS e da CBS (vCalcRee… |
| [E1534](E1534.md) | O valor objeto de reembolso, repasse ou ressarcimento já tributados que não integram da base de cálculo do ISSQN, do IBS e da CBS (vCalcRee… |
| [E1535](E1535.md) | O valor objeto de reembolso, repasse ou ressarcimento já tributados que não integram da base de cálculo do ISSQN, do IBS e da CBS (vCalcRee… |
| [E1538](E1538.md) | O NIF ou cNaoNIF do fornecedor deve ser informado quando o grupo de informações de endereço no exterior do fornecedor de serviços for infor… |
| [E1539](E1539.md) | Alíquota da UF para IBS incorreta. |
| [E1540](E1540.md) | O percentual redutor de alíquota para o IBS estadual não deve ser informado para o código da classificação tributária - cClassTribIBSCBS in… |
| [E1541](E1541.md) | O percentual redutor de alíquota para o IBS estadual deve ser informado para o código da classificação tributária - cClassTribIBSCBS inform… |
| [E1543](E1543.md) | O percentual redutor de alíquota para o IBS estadual informado difere do indicado para o o código da classificação tributária - cClassTribI… |
| [E1545](E1545.md) | O percentual redutor de alíquota para o IBS municipal não deve ser informado para o código da classificação tributária - cClassTribIBSCBS i… |
| [E1546](E1546.md) | O percentual redutor de alíquota para o IBS municipal deve ser informado para o código da classificação tributária - cClassTribIBSCBS infor… |
| [E1547](E1547.md) | O percentual redutor de alíquota para o IBS municipal informado difere do indicado para o o código da classificação tributária - cClassTrib… |
| [E1548](E1548.md) | Percentual de redução de alíquota municipal incorreto. |
| [E1549](E1549.md) | Alíquota efetiva do Município para IBS incorreta. |
| [E1550](E1550.md) | O percentual redutor de alíquota para a CBS não deve ser informado para o código da classificação tributária - cClassTribIBSCBS informado n… |
| [E1551](E1551.md) | O percentual redutor de alíquota para a CBS deve ser informado para o código da classificação tributária - cClassTribIBSCBS informado na DP… |
| [E1552](E1552.md) | O percentual redutor de alíquota para a CBS informado difere do indicado para o o código da classificação tributária - cClassTribIBSCBS inf… |
| [E1553](E1553.md) | Percentual redutor de alíquota para a CBS incorreto. |
| [E1554](E1554.md) | Alíquota efetiva da União para CBS incorreta. |
| [E1555](E1555.md) | Valor total da NFS-e está incorreto. |
| [E1556](E1556.md) | Valor total do IBS incorreto. |
| [E1557](E1557.md) | Percentual redutor de alíquota para o IBS estadual incorreto. |
| [E1558](E1558.md) | Alíquota da União para CBS incorreta. |
| [E1560](E1560.md) | Grupo crédito presumido para IBS não deve ser informado. |
| [E1561](E1561.md) | Grupo crédito presumido para IBS deve ser informado. |
| [E1565](E1565.md) | Valor do diferimento para o IBS estadual não deve ser informado. |
| [E1566](E1566.md) | Valor do diferimento para o IBS estadual deve ser informado. |
| [E1567](E1567.md) | Valor do diferimento para o IBS estadual incorreto. |
| [E1568](E1568.md) | Valor total do IBS estadual incorreto. |
| [E1569](E1569.md) | Valor do diferimento para o IBS municipal não deve ser informado. |
| [E1570](E1570.md) | Valor do diferimento para o IBS municipal deve ser informado. |
| [E1571](E1571.md) | Valor do diferimento para o IBS municipal incorreto. |
| [E1572](E1572.md) | Valor total do IBS municipal incorreto. |
| [E1575](E1575.md) | Grupo crédito presumido para CBS não deve ser informado. |
| [E1576](E1576.md) | Grupo crédito presumido para CBS deve ser informado. |
| [E1577](E1577.md) | Alíquota efetiva da UF para IBS incorreta. |
| [E1578](E1578.md) | Alíquota do Município para IBS incorreta. |
| [E1580](E1580.md) | Valor do diferimento para a CBS deve ser informado. |
| [E1581](E1581.md) | Valor do diferimento para a CBS incorreto. |
| [E1582](E1582.md) | Valor total da CBS da União incorreto. |
| [E1583](E1583.md) | Grupo de tributação regular não deve ser informado para o cClassTribIBSCBS indicado. |
| [E1584](E1584.md) | Grupo de tributação regular deve ser informado para o cClassTribIBSCBS indicado. |
| [E1585](E1585.md) | Alíquota efetiva de tributação regular do IBS estadual incorreta. |
| [E1586](E1586.md) | Valor da tributação regular do IBS estadual incorreto. |
| [E1587](E1587.md) | Alíquota efetiva de tributação regular do IBS municipal incorreta. |
| [E1588](E1588.md) | Valor da tributação regular do IBS municipal incorreto. |
| [E1589](E1589.md) | Alíquota efetiva de tributação regular da CBS incorreta. |
| [E1590](E1590.md) | Valor da tributação regular da CBS incorreto. |
| [E1600](E1600.md) | Grupo de compras governamentais não deve ser informando quando o tpEnteGov não foi informado na DPS. |
| [E1601](E1601.md) | Grupo de compras governamentais deve ser informando quando o tpEnteGov não foi informado na DPS. |
| [E1602](E1602.md) | Alíquota do IBS de competência do Estado incorreta. |
| [E1603](E1603.md) | Valor do Tributo do IBS da UF incorreto. |
| [E1604](E1604.md) | Alíquota do IBS de competência do Município incorreta. |
| [E1605](E1605.md) | Valor do Tributo do IBS do Município incorreto. |
| [E1606](E1606.md) | Alíquota da CBS incorreta. |
| [E1607](E1607.md) | Valor do Tributo da CBS incorreto. |
| [E1630](E1630.md) | Arquivo enviado com erro na assinatura. |
| [E1632](E1632.md) | Certificado Digital da assinatura inválido. |
| [E1634](E1634.md) | Certificado Digital fora do padrão estabelecido. |
| [E1636](E1636.md) | A assinatura é obrigatória quando for enviado paraa API. |
| [E1638](E1638.md) | A assinatura deve ser feita com o certificado digital do municiípio emissor da NFS-e. |
| [E9996](E9996.md) | Nesta versão da aplicação, não é permitida a emissão de NFS-e pelo tomador ou intermediário. |

## Eventos (cancelamento e outros)

| Código | Mensagem oficial |
|---|---|
| [E0802](E0802.md) | Já existe um documento fiscal eletrônico identificado com este id no Sistema Nacional NFS-e. |
| [E0812](E0812.md) | O CNPJ do autor do pedido de registro de evento não corresponde à base do CNPJ informada no certificado digital da assinatura do pedido. |
| [E0813](E0813.md) | O CNPJ autor informado no pedido de registro de evento não corresponde ao "AUTOR DO PEDIDO DE REGISTRO DE EVENTO" indicado na planilha "Tip… |
| [E0815](E0815.md) | O CPF do autor do pedido de registro de evento não corresponde ao CPF informado no certificado digital da assinatura do pedido. |
| [E0816](E0816.md) | O CPF autor informado no pedido de registro de evento não corresponde ao "AUTOR DO PEDIDO DE REGISTRO DE EVENTO" indicado na planilha "Tipo… |
| [E0822](E0822.md) | O prazo para o cancelamento da NFS-e expirou, conforme parametrização do município emissor da NFS-e. |
| [E0823](E0823.md) | Valor da NFS-e a ser cancelada acima do permitido, conforme parametrização do município emissor da NFS-e. |
| [E0824](E0824.md) | NFS-e sem indentificação do tomador do serviço não pode ser cancelada, conforme parametrização do município emissor da NFS-e. |
| [E0827](E0827.md) | Não é permitido realizar um Evento de Cancelamento para NFS-e que possua Evento de Tributos Recolhidos vinculado, conforme parametrização d… |
| [E0831](E0831.md) | O pedido de registro deste evento de NFS-e deve ser enviado para o ambiente que gerou a NFS-e referenciada no pedido. |
| [E0840](E0840.md) | O Sistema Nacional NFS-e não pode recepecionar o EVENTO DE CANCELAMENTO DE NFS-e pois, o evento de <nome_evento_vinculado_a_NFS-e> já está… |
| [E0845](E0845.md) | O Sistema Nacional NFS-e não pode recepecionar o EVENTO DE CANCELAMENTO DE NFS-e POR SUBSTITUIÇÃO pois, o evento de <nome_evento_vinculado_… |
| [E0848](E0848.md) | O Sistema Nacional NFS-e não pode recepecionar o EVENTO DE SOLICITAÇÃO DE ANÁLISE FISCAL PARA CANCELAMENTO DE NFS-e pois, o evento de <nome… |
| [E0852](E0852.md) | O Sistema Nacional NFS-e não pode recepecionar o EVENTO DE CANCELAMENTO DE NFS-e DEFERIDO POR ANÁLISE FISCAL pois, o evento de <nome_evento… |
| [E0853](E0853.md) | O Sistema Nacional NFS-e não pode recepecionar o EVENTO DE CANCELAMENTO DE NFS-e DEFERIDO POR ANÁLISE FISCAL pois não existe um EVENTO DE S… |
| [E0855](E0855.md) | O Sistema Nacional NFS-e não pode recepecionar o EVENTO DE CANCELAMENTO DE NFS-E INDEFERIDO POR ANÁLISE FISCAL pois, o evento de <nome_even… |
| [E0856](E0856.md) | O Sistema Nacional NFS-e não pode recepecionar o EVENTO DE CANCELAMENTO DE NFS-e INDEFERIDO POR ANÁLISE FISCAL pois não existe um EVENTO DE… |
| [E0860](E0860.md) | O Sistema Nacional NFS-e não pode recepecionar o EVENTO DE MANIFESTAÇÃO DE NFS-e - CONFIRMAÇÃO DO PRESTADOR pois, o evento de <nome_evento_… |
| [E0861](E0861.md) | O Sistema Nacional NFS-e não pode recepecionar o EVENTO DE MANIFESTAÇÃO DE NFS-e - CONFIRMAÇÃO DO TOMADOR pois, o evento de <nome_evento_vi… |
| [E0862](E0862.md) | O Sistema Nacional NFS-e não pode recepecionar o EVENTO DE MANIFESTAÇÃO DE NFS-e - CONFIRMAÇÃO DO INTERMEDIÁRIO pois, o evento de <nome_eve… |
| [E0863](E0863.md) | O Sistema Nacional NFS-e não pode recepecionar o EVENTO DE MANIFESTAÇÃO DE NFS-e - CONFIRMAÇÃO TÁCITA pois, o evento de <nome_evento_vincul… |
| [E0864](E0864.md) | O Sistema Nacional NFS-e não pode recepecionar o EVENTO DE MANIFESTAÇÃO DE NFS-e - REJEIÇÃO DO PRESTADOR pois, o evento de <nome_evento_vin… |
| [E0866](E0866.md) | O Sistema Nacional NFS-e não pode recepecionar o EVENTO DE MANIFESTAÇÃO DE NFS-e - REJEIÇÃO DO TOMADOR pois, o evento de <nome_evento_vincu… |
| [E0868](E0868.md) | O Sistema Nacional NFS-e não pode recepecionar o EVENTO DE MANIFESTAÇÃO DE NFS-e - REJEIÇÃO DO INTERMEDIÁRIO pois, o evento de <nome_evento… |
| [E0870](E0870.md) | O Sistema Nacional NFS-e não pode recepecionar o EVENTO DE MANIFESTAÇÃO DE NFS-e - ANULAÇÃO DA REJEIÇÃO pois, o evento de <nome_evento_vinc… |
| [E1802](E1802.md) | Conteúdo do identificador informado no identificador do evento difere da concatenação dos campos correspondentes. |
| [E1805](E1805.md) | Já existe um Evento com este identificador no ADN NFS-e. |
| [E1818](E1818.md) | Não é permitido o compartilhamento pelo município com o ADN dos eventos de manifestação de NFS-e para confirmação ou rejeição pelos não emi… |
| [E1825](E1825.md) | Prazo de aceitação da versão do leiaute do pedido de registro de evento expirou. |
| [E1827](E1827.md) | Conteúdo do identificador informado no identificador do Pedido de Registro de Evento difere da concatenação dos campos correspondentes. |
| [E1831](E1831.md) | O pedido de registro de evento não pode ser validado pois a NFS-e indicada não existe no Ambiente de Dados Nacional NFS-e. |
| [E1833](E1833.md) | Somente é permitido um único evento do tipo Manifestação de NFS-e (Confirmação e Rejeição), por não emitente da NFS-e indicada no evento. |
| [E1835](E1835.md) | Somente é permitido um único evento do tipo Manifestação de NFS-e (Anulação da Rejeição) para cada Evento de Manifestação de NFS-e - Rejeiç… |
| [E1843](E1843.md) | A data de emissão do pedido do registro do evento não pode ser posterior à data de recebimento pelo Sistema Nacional NFS-e. |
| [E1845](E1845.md) | Ambiente informado diverge do ambiente de recebimento para o qual o emitente está enviando o evento. |
| [E1944](E1944.md) | A  descrição do motivo é obrigatória caso o tipo do motivo seja "9 - Outros". |
| [E1949](E1949.md) | A  descrição do motivo é obrigatória caso o tipo do motivo seja "9 - Outros". |
| [E1954](E1954.md) | A  descrição do motivo é obrigatória caso o tipo do motivo seja "9 - Outros". |
| [E1960](E1960.md) | O Sistema Nacional NFS-e não pode recepecionar o EVENTO DE CANCELAMENTO DE NFS-e POR OFÍCIO pois, o evento de <nome_evento_vinculado_a_NFS-… |
| [E1963](E1963.md) | O identificador do Evento de Manifestação de NFS-e - Rejeição a ser anulado deve existir no Sistema Nacional NFS-e e corresponder a um iden… |
| [E1965](E1965.md) | O Sistema Nacional NFS-e não pode recepecionar o EVENTO DE BLOQUEIO DE NFS-e POR OFÍCIO pois, o evento de <nome_evento_vinculado_a_NFS-e> j… |
| [E1967](E1967.md) | O sistema não pode recepcionar o Evento de Bloqueio de NFS-e por Ofício para <tipo_evento_bloqueio_NFS-e>, pois já existe o mesmo tipo de e… |
| [E1970](E1970.md) | O Sistema Nacional NFS-e não pode recepecionar o EVENTO DE DESBLOQUEIO DE NFS-e POR OFÍCIO pois, o evento de <nome_evento_vinculado_a_NFS-e… |
| [E1976](E1976.md) | Não existe o identificador de bloqueio informado neste evento para desbloqueio. |
| [E1978](E1978.md) | O sistema não pode recepcionar o Evento Desbloqueio de NFS-e por Ofício, pois o Evento de Bloqueio indicado já foi desbloqueado. |
| [E1980](E1980.md) | Arquivo enviado com erro na assinatura. |
| [E1983](E1983.md) | Certificado Digital da assinatura inválido. |
| [E1986](E1986.md) | Certificado Digital fora do padrão estabelecido. |
| [E1989](E1989.md) | A assinatura é obrigatória quando for enviado para o Web Service. |
| [E1991](E1991.md) | A assinatura deve ser feita com o certificado digital do emitente do Pedido de Registro de Evento. |
| [E2020](E2020.md) | Arquivo enviado com erro na assinatura. |
| [E2023](E2023.md) | Certificado Digital da assinatura inválido. |
| [E2026](E2026.md) | Certificado Digital fora do padrão estabelecido. |
| [E2029](E2029.md) | A assinatura é obrigatória quando for enviado paraa API. |
| [E2032](E2032.md) | A assinatura deve ser feita com o certificado digital do município emissor do Evento. |

## Recepção da DPS

| Código | Mensagem oficial |
|---|---|
| [E1200](E1200.md) | Certificado de Transmissão Inválido |
| [E1203](E1203.md) | Certificado de Transmissão expirado |
| [E1205](E1205.md) | Certificado de Transmissão - Erro Cadeira de Certificação |
| [E1206](E1206.md) | Certificado de Transmissão - Erro de acesso a LCR |
| [E1207](E1207.md) | Certificado de Transmissão revogado |
| [E1208](E1208.md) | Certificado de Transmissão difere da ICP - Brasil |
| [E1209](E1209.md) | Certificado de Transmissão sem CNPJ ou CPF. |
| [E1225](E1225.md) | Falha na decodificação da base 64 da área de dados |
| [E1226](E1226.md) | Estrutura descompactada mal formada. |
| [E1228](E1228.md) | Uso de prefixo de namespace não permitido na área de dados descompactada. |
| [E1229](E1229.md) | XML não está utilizando codificação UTF8. |
| [E1235](E1235.md) | Falha no esquema XML do DF-e. |
| [E1242](E1242.md) | Tipo DF-e não tratado pelo Sistema Nacional NFS-e. |
