# Migracao 2.x → 3.0.0 — 06/10/2026

Este e o guia de migracao da versao 3.0.0. O diagnostico historico em [REGRAS_NEGOCIO_EMISSAO.md](REGRAS_NEGOCIO_EMISSAO.md) permanece preservado. O leiaute local continua DPS 1.01; nao houve atualizacao dos XSD nem mudanca do enquadramento fiscal suportado.

## Breaking changes

Atualize a integracao se ela dependia de qualquer comportamento abaixo:

| Antes (2.x) | Agora (3.0.0) | Acao |
| --- | --- | --- |
| Campos opcionais vazios, `null` ou tipos incorretos podiam chegar ao builder/XSD. | Sao rejeitados com `INVALID_STRUCTURE` ou erro de validacao. | Omita o campo ou informe um valor valido. |
| Valores pequenos podiam virar `0.00` no XML; limites eram deixados ao XSD. | Valores de servico que arredondam para zero e valores fora dos limites locais sao rejeitados antes do XML. | Ajuste o valor e a escala antes de chamar o SDK. |
| `obra` podia ser incompleta e `inscImobFisc` era serializada depois de `cObra`. | `cObra` e obrigatorio quando houver obra; a ordem segue o XSD. | Informe `cObra` e teste a integracao contra 3.0.0. |
| XML externo podia usar um ambiente diferente do destino. | `tpAmb` e obrigatorio e deve coincidir com o ambiente de transmissao. | Corrija o XML ou remova a opcao de ambiente conflitante. |
| Certificado expirado podia chegar a assinatura/transmissao. | A vigencia e obrigatoria antes de assinar e antes de enviar. | Renove o certificado e trate `CertificateValidationError`. |
| HTTP 2xx sem resposta autorizada completa podia retornar chave vazia. | Gera `EmitirNotaError` com `INVALID_AUTHORIZATION_RESPONSE`. | Concilie a DPS antes de reenviar. |
| Intermediario com NIF/`cNaoNIF` podia passar pela pre-validacao e ser perdido no XML. | E rejeitado. | Use CPF/CNPJ ou envie XML externo completo. |

Nao sao breaking changes: divergencias cambiais agora produzem `warnings`, sem impedir emissao; `invoices.get(chave, { ambiente })` recebe apenas um segundo argumento opcional; `assertCertificateValidity` e uma nova exportacao.

## Mudancas de comportamento

| Area | Comportamento corrigido |
| --- | --- |
| Valores e atalhos | Resolucao por campo compartilhada pelo builder e validador; `valores` prevalece sobre atalhos. `comercioExterior` prevalece integralmente sobre `comExt`. |
| Relatorio | `normalizedPayload` e uma copia independente. `issues` contem erros; `warnings` contem avisos. Entradas com blocos/tipos incorretos retornam `INVALID_STRUCTURE`. |
| Cambio | `CURRENCY_BRL_MISMATCH` e `CURRENCY_FOREIGN_MISMATCH` avisam sobre divergencias em centavos sem bloquear nem substituir valores explicitos. |
| Precisao | Multiplicacao decimal exata com entradas originais; todos os valores monetarios serializados com duas casas, inclusive `comExt.vServMoeda`. Arredondamento metade para cima. |
| Limites | Valores de servico que arredondam para zero ou ultrapassam o tamanho do XSD sao rejeitados. Retencoes federais e aliquotas tambem passam pela validacao antecipada. |
| Estrutura | Opcionais vazios/nulos e tipos incorretos sao rejeitados. Datas de calendario, horarios, offsets e dominios pequenos de comercio exterior seguem os tipos locais. |
| Obra | `cObra` obrigatorio no modelo suportado; `inscImobFisc` opcional vem antes de `cObra` no XML. Ambos limitados a 30 caracteres. |
| Intermediario | NIF/`cNaoNIF` rejeitados, pois o builder atual so transmite CPF/CNPJ. |
| Ambiente JSON | Resolvido antes do XML: opcoes → request → restrita. XML e destino usam o mesmo ambiente. |
| Ambiente XML | Derivado de `tpAmb`; conflitos explicitos e divergencias na nota preparada bloqueiam o envio. |
| Consulta | `invoices.get(chave, { ambiente })` permite sobrescrita; padrao usa `defaults.ambiente` ou construtor, sem lembrar a ultima emissao. |
| Certificado | Vigencia obrigatoria antes da assinatura e novamente antes do envio. Titularidade permanece uma chamada explicita. |
| Autorizacao | Exige descompactacao, XML bem formado com raiz/namespace NFSe e chave de 50 digitos. Chaves do corpo e XML, quando presentes, devem ser validas e iguais. |

`assertCertificateValidity(pfx, now?)` e `GetInvoiceOptions` foram adicionados aos exports publicos. As assinaturas existentes continuam disponiveis; o segundo argumento de `invoices.get` e opcional. Certificados fora da vigencia produzem os codigos existentes `CERTIFICATE_NOT_YET_VALID`/`CERTIFICATE_EXPIRED`.

As novas rejeicoes tecnicas podem exigir ajustes de integracoes que enviavam campos vazios, datas fora do formato, obra incompleta ou valores fora dos limites. Divergencias cambiais continuam aceitas. O SDK nao recupera precisao que ja tenha sido perdida no `number` da cotacao.

## Respostas e infraestrutura

HTTP 2xx incompleto ou inconsistente gera `EmitirNotaError` com `INVALID_AUTHORIZATION_RESPONSE`, preservando status, corpo e identificador da DPS. Isso nao prova rejeicao fiscal: a aplicacao deve conciliar antes de reenviar. Rejeicoes oficiais preservam codigo, descricao e complemento. Falhas de transporte continuam propagadas, sem retentativas.

O `xmllint`, ja necessario para XSD, tambem verifica a sintaxe XML antes da leitura de ambiente e da aceitacao de respostas; o parser DOM sozinho recupera silenciosamente alguns XMLs malformados. DTDs nao sao aceitos, e a verificacao usa `--nonet`. Falha do executavel continua sendo `XmllintUnavailableError`, distinguida de resposta fiscal invalida. Nao se valida a assinatura nem o XSD completo da NFS-e recebida.

## Cobertura e limites

Os testes usam `node:test`, certificados sinteticos e `https.request` simulado, sem acesso a SEFIN. Cobrem regimes, documentos, normalizacao, conversao, precedencias, limites, datas, obra, tributos federais, vigencia, ambiente, respostas e erros. Os payloads de [examples/payloads.ts](../examples/payloads.ts) e os exemplos de emissao de README/ENGLISH sao validados contra o XSD.

Permanecem as restricoes anteriores de nacional/exportacao e `totTrib` por regime, inclusive as limitacoes conhecidas de pais do resultado e dependencias de retencao. IBS/CBS, descontos, deducoes, prestacao por pais, representacao, conciliacao automatica e novos cenarios fiscais nao foram implementados. Nenhuma nota real foi transmitida e nenhum pacote foi publicado.

Validacao de manutencao: `npm run typecheck`, `npm test` (inclui build) e `npm pack --dry-run`.
