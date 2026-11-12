# Referência da API

Tudo é importado da raiz do pacote, exceto as ferramentas de agente
(`@useinvio/nfse-sdk/agent`). `certificado` é um `NfseCertificate` (ou o legado
`PfxMaterial`); `ambiente` é `'restrita' | 'producao'` e o padrão é `restrita`;
`options` é [`SefinRequestOptions`](../guias/timeouts.md).

## Cliente

| API | Descrição |
|---|---|
| `new NfseClient({ environment?, certificate, defaults?, request? })` | Configura certificado, ambiente, defaults do JSON e opções de transporte uma vez. |
| `client.invoices.create(input)` / `.buildDpsJson(input)` | Emite, ou só combina o JSON com os defaults. |
| `client.invoices.retrieve(chave)` / `.get(chave)` | Consulta tipada / crua. |
| `client.invoices.getByDpsId(dpsId)` / `.recover(dpsId)` | Consulta pela DPS / recuperação após timeout. |
| `client.invoices.cancel(input)` / `.cancelBySubstitution(input)` | Eventos e101101 / e105102. |
| `client.invoices.danfse(chave)` | PDF do DANFSe. |
| `client.events.get(chave, tpEvento, nSeq?)` / `.listByAccessKey(chave)` | Eventos (SEFIN / ADN). |
| `client.distribution.byNsu(nsu, opts?)` | Distribuição por NSU (ADN). |
| `client.municipalParameters.agreement/rate/rateHistory/specialRegimes/withholdings/benefit` | Parâmetros municipais (ADN). |

## Emissão

| Função | Descrição |
|---|---|
| `emitirNfse(input, certificado, options?)` | Emite a partir de XML ou JSON. Retorna `ResultadoEmissaoNota`. |
| `prepararNota(input, certificado, options?)` | Valida, assina e verifica a assinatura, sem enviar. Retorna `NotaPreparada`. |
| `transmitirNotaPreparada(nota, certificado, options?)` | Envia uma `NotaPreparada`. |
| `buildDpsFromJson(nota)` / `buildDpsId(...)` | Monta o XML não assinado / o Id de 45 caracteres. |
| `validateDpsJsonRequest(nota)` / `assertValidDpsJsonRequest(nota)` | Valida o JSON, sem lançar / lançando `DpsFiscalValidationError`. |
| `validateDpsXmlAgainstXsd(xml)` | Valida a DPS contra o XSD oficial v1.01. |
| `DPS_JSON_REQUEST_SCHEMA` | JSON Schema 2020-12 do `DpsJsonRequest`. |

## Consulta

| Função | Descrição |
|---|---|
| `obterNfse(chave, certificado, ambiente?, options?)` | `GET /nfse/{chave}` decodificado: `{ chaveAcesso, nfseXml, resumo }`. |
| `recuperarNfsePorDps(dpsId, certificado, ambiente?, options?)` | `GET /dps/{id}` + `GET /nfse/{chave}`; `null` se a DPS não existe. |
| `lerNfse(xml)` | Lê um XML de NFS-e autorizada em `NfseResumo`. |
| `decodificarRespostaNfse(status, body)` | Decodifica uma resposta crua de `GET /nfse/{chave}`. |
| `consultarNfse(...)` / `consultarDps(...)` | Respostas cruas `{ status, body }`. |
| `baixarDanfse(chave, certificado, ambiente?, options?)` | PDF do DANFSe (ADN). |

## Eventos

| Função | Descrição |
|---|---|
| `cancelarNfse(input, certificado, options?)` | Cancelamento e101101. |
| `cancelarNfsePorSubstituicao(input, certificado, options?)` | Cancelamento por substituição e105102. |
| `buildCancelamentoFromJson(input)` / `buildCancelamentoPorSubstituicaoFromJson(input)` | Monta o pedido sem assinar. |
| `registrarEvento(built, certificado, options?)` | Valida, assina e envia um pedido montado. |
| `validatePedRegEventoXmlAgainstXsd(xml)` | Valida um pedido de evento contra o XSD. |
| `consultarEvento(chave, tpEvento, certificado, ambiente?, { nSeqEvento? })` | Consulta um evento (SEFIN). |
| `enviarEvento(xmlGZipB64, certificado, chave, ambiente?)` | Envia um pedido já assinado e compactado. |
| `TP_EVENTO`, `MOTIVO_CANCELAMENTO`, `MOTIVO_SUBSTITUICAO` | Códigos com nomes legíveis. |

## ADN

`distribuirDfePorNsu`, `consultarEventosPorChaveAdn`, `consultarConvenio`,
`consultarAliquota`, `consultarHistoricoAliquotas`, `consultarRegimesEspeciais`,
`consultarRetencoes`, `consultarBeneficio`. Assinaturas e endpoints em
[Distribuição e parâmetros municipais](../guias/adn.md).

## Rejeições

| Função | Descrição |
|---|---|
| `explicarRejeicao(codigoOuErro)` | Mensagem, regra, campo e nível oficiais de um código, ou `conhecida: false`. |
| `explicarErros(erros)` | Explica todos os erros de uma rejeição. |
| `buscarRejeicao(codigo)` / `listarRejeicoes()` | Acesso direto ao catálogo oficial. |
| `REJEICOES_FONTES` | Anexos oficiais usados no catálogo, com URL. |

## Testes (`@useinvio/nfse-sdk/testing`)

| Função | Descrição |
|---|---|
| `createTestCertificate(opts?)` | Certificado A1 de teste com CNPJ/CPF nos campos ICP-Brasil. |
| `installMockSefin(opts?)` | SEFIN e ADN simulados no processo; `rejectNext`, `failNext`, `dropResponseNext`, `route`, `restore`. |

Guia: [Testar sem certificado](../guias/testes.md).

## Agentes e MCP

| API | Descrição |
|---|---|
| `nfseAgentTools` (`/agent`) | Ferramentas só de leitura. |
| `createNfseAgentToolkit({ allowWrite?, confirmationTtlMs? })` (`/agent`) | Leitura + emissão e cancelamento em duas etapas. |
| `toAgentIssues(error)` (`/agent`) | Converte erros do SDK em issues para o modelo. |
| `createNfseMcpServer(opts)` / `runNfseMcpStdio(opts?)` (`/mcp`) | Servidor MCP sem dependências. |
| `nfse-mcp` (bin) | `npx -y @useinvio/nfse-mcp` ou `npx -y -p @useinvio/nfse-sdk nfse-mcp`, ambos a partir da publicação do SDK 3.2.0. |

Guia: [Agentes de IA e MCP](../guias/agentes-ia.md).

## Certificado

| API | Descrição |
|---|---|
| `NfseCertificate.fromEnv/fromFile/fromBase64/fromPfx/fromPem` | Carrega o A1 sem expor a chave privada. |
| `certificado.cnpj`, `.cpf`, `.notBefore`, `.notAfter`, `.fingerprintSha256` | Metadados públicos. |
| `certificado.isValidAt(data?)`, `.daysUntilExpiry()`, `.destroy()` | Vigência e descarte do agente mTLS. |
| `assertCertificateValidity(certificado, now?)` | Vigência; aplicada antes de assinar e de enviar. |
| `assertCertificateForProvider(certificado, documento, now?)` | Vigência e titular. |
| `NFSE_CERT_ENV` | Nomes das variáveis de ambiente lidas por `fromEnv`. |
| `loadPfx`, `loadPfxFromBuffer` | Legado: retornam a chave em PEM. |

## Baixo nível

| Função | Descrição |
|---|---|
| `signDps(xml, dpsId, certificado)` / `signEnveloped(xml, id, elemento, certificado)` | Assinatura XMLDSIG. |
| `verifyDps(xml, certPem)` | Verifica uma assinatura. |
| `gzipBase64(xml)` / `gunzipBase64(b64)` / `gunzipBase64Flexivel(b64)` | Compactação. |
| `transmitirDpsCompactada(b64, certificado, ambiente?, options?)` | `POST /nfse` cru. |
| `extrairErros(body)` | Normaliza erros da SEFIN. |
| `assertChaveAcesso(chave)` / `assertDpsId(id)` | Validação de identificadores. |
| `resolveSefinBaseUrl(ambiente)` / `resolveAdnBaseUrl(ambiente)` | URLs base. |
| `setSefinRequestObserver(fn)` / `createSefinLatencyTracker(opts?)` | Métricas de latência ([METRICS.md](../METRICS.md)). |

## Constantes

`SEFIN_BASE_URL`, `ADN_BASE_URL`, `TP_AMB`, `DEFAULT_AMBIENTE`, `DPS_SCHEMA_VERSION`.

## Tipos

Os tipos públicos estão em [`index.ts`](../../index.ts). Os principais:
`DpsJsonRequest`, `ResultadoEmissaoNota`, `NotaPreparada`, `NfseConsultada`,
`NfseResumo`, `ResultadoEvento`, `CancelamentoNfseInput`,
`CancelamentoPorSubstituicaoInput`, `SefinRequestOptions`, `SefinResposta`,
`SefinErro`, `CertificateInput`, `NfseClientOptions`.
