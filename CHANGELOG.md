# Changelog

Todas as mudancas relevantes deste pacote sao documentadas aqui. O formato segue
[Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto usa
[Semantic Versioning](https://semver.org/lang/pt-BR/).

## [3.2.0] - nao publicado

### Added

- Cancelamento de NFS-e: `cancelarNfse` (e101101) e `cancelarNfsePorSubstituicao`
  (e105102). O pedido e montado, validado contra o XSD oficial `pedRegEvento`,
  assinado e enviado. `autor` usa o CNPJ/CPF do titular do certificado por
  padrao. Builders: `buildCancelamentoFromJson`,
  `buildCancelamentoPorSubstituicaoFromJson`, `buildPedRegEventoId`, mais as
  tabelas `TP_EVENTO`, `MOTIVO_CANCELAMENTO`, `MOTIVO_SUBSTITUICAO` e os erros
  `RegistrarEventoError` e `EventoInvalidoError`.
- Consulta tipada: `obterNfse` devolve o XML descompactado e um `resumo` tipado
  (`NfseResumo`). `lerNfse(xml)` le um XML que voce ja tem. Falhas geram
  `ConsultaNfseError`, com `notFound` para HTTP 404.
- Recuperacao de emissao: `recuperarNfsePorDps(dpsId)` usa `GET /dps/{id}` e
  depois `GET /nfse/{chave}` para descobrir se uma DPS foi processada apos um
  timeout, sem reenviar. A forma crua e `consultarDps`.
- `consultarEvento` (`GET /nfse/{chave}/eventos/{tpEvento}/{nSeqEvento}`).
- Ambiente de Dados Nacional (ADN): `baixarDanfse` (PDF do DANFSe),
  `distribuirDfePorNsu`, `consultarEventosPorChaveAdn` e parametros municipais
  (`consultarConvenio`, `consultarAliquota`, `consultarHistoricoAliquotas`,
  `consultarRegimesEspeciais`, `consultarRetencoes`, `consultarBeneficio`).
  Tambem `ADN_BASE_URL` e `resolveAdnBaseUrl`.
- `SefinRequestOptions` (`timeoutMs`, `retries`, `signal`) em todas as funcoes
  de rede e em `NfseClient({ request })`. `retries` vale so para GETs (erro de
  rede, HTTP 429/502/503/504), com backoff exponencial. Emissao e eventos nunca
  sao repetidos.
- `NfseClient`: `invoices.retrieve`, `getByDpsId`, `recover`, `cancel`,
  `cancelBySubstitution` e `danfse`, alem de `events`, `distribution` e
  `municipalParameters`.
- `validatePedRegEventoXmlAgainstXsd` e `PedRegEventoXsdValidationError`.
- `SefinParametroInvalidoError`: Id da DPS, tipo de evento, NSU, codigo de
  municipio e demais parametros de caminho sao validados antes da rede.
- `gunzipBase64Flexivel` para respostas em Base64 simples ou duplo.

### Fixed

- `enviarEvento` agora envia o campo oficial `pedidoRegistroEventoXmlGZipB64`.
  Antes enviava `pedRegXmlGZipB64`, que a SEFIN nao reconhece.

## [3.1.0] - nao publicado

### Added

- `NfseCertificate`: certificado A1 opaco para assinatura e mTLS. Carrega de
  `.pfx` (`fromFile`, `fromPfx`, `fromBase64`), de PEM (`fromPem`) ou de
  variaveis de ambiente (`fromEnv`: `NFSE_CERT_PATH` ou `NFSE_CERT_BASE64`,
  com `NFSE_CERT_PASSWORD` ou `NFSE_CERT_PASSWORD_FILE`). Expoe apenas
  metadados (CNPJ/CPF ICP-Brasil, validade, emissor, fingerprint SHA-256);
  a chave privada fica em um `KeyObject` fora do objeto, e a senha e os bytes
  do PFX nao sao retidos. `console.log` e `JSON.stringify` nunca mostram a chave.
- Agente mTLS dedicado por certificado: conexoes reaproveitadas nunca sao
  compartilhadas entre certificados (multi-tenant).
- Novos codigos de `CertificateValidationError`: `CERTIFICATE_INVALID_PASSWORD`,
  `CERTIFICATE_UNREADABLE`, `CERTIFICATE_MISSING`, `CERTIFICATE_PASSWORD_MISSING`.
- `ChaveAcessoInvalidaError`: `consultarNfse` e `enviarEvento` rejeitam chaves
  que nao tenham 50 digitos antes de qualquer chamada de rede.
- `XsdEngineUnavailableError` para falhas de infraestrutura do motor XSD.
- Subpath `@useinvio/nfse-sdk/agent` com ferramentas neutras de framework
  (`validate_dps`, `build_dps_xml`, `get_nfse`) e `toAgentIssues(error)`.
- `DPS_JSON_REQUEST_SCHEMA` (JSON Schema 2020-12 do `DpsJsonRequest`).

### Changed

- A validacao XSD e a checagem de XML bem formado rodam no proprio processo
  com libxml2 em WebAssembly (`libxml2-wasm`). O binario `xmllint` deixa de ser
  necessario, e o schema oficial e compilado uma vez por processo.
- `assertCertificateForProvider` le o CNPJ/CPF dos campos ICP-Brasil
  (otherName 2.16.76.1.3.3 / 2.16.76.1.3.1) ou do sufixo `NOME:DOCUMENTO` do
  CN, em vez de procurar qualquer sequencia de 11/14 digitos no certificado.
- `NfseClient` passa a carregar o PFX informado em `certificate.content` como
  `NfseCertificate`. Senha incorreta gera `CertificateValidationError` com
  `CERTIFICATE_INVALID_PASSWORD`.
- Todas as funcoes que recebiam `PfxMaterial` agora aceitam
  `NfseCertificate | PfxMaterial`.

### Deprecated

- `XmllintUnavailableError`: alias de `XsdEngineUnavailableError`, mantido para
  verificacoes `instanceof` existentes.
- `loadPfx` e `loadPfxFromBuffer` continuam funcionando, mas retornam a chave
  privada em PEM dentro de um objeto comum. Prefira `NfseCertificate`.

### Security

- `node-forge` atualizado para 1.4.3 e `@xmldom/xmldom` para 0.8.15, corrigindo
  advisories de severidade alta (incluindo falsificacao de MAC em PKCS#12 e de
  assinatura RSA PKCS#1 v1.5). `xml-crypto` atualizado para 6.4.0.
- O XML e lido sem rede, sem DTD externo e sem entidades externas.

## [3.0.0] - 2026-10-06

Validacao de emissao endurecida, com breaking changes. Veja o guia de migracao
em [docs/CORRECOES_EMISSAO.md](docs/CORRECOES_EMISSAO.md).

### Changed

- Campos opcionais vazios, `null` ou com tipo incorreto sao rejeitados.
- Valores de servico que arredondam para zero e valores fora dos limites do XSD
  sao rejeitados antes de gerar XML.
- `tpAmb` do XML externo deve coincidir com o ambiente de transmissao.
- A vigencia do certificado e verificada antes de assinar e antes de enviar.
- HTTP 2xx sem XML autorizado e chave de 50 digitos gera `EmitirNotaError` com
  `INVALID_AUTHORIZATION_RESPONSE`.

### Added

- `assertCertificateValidity`, `GetInvoiceOptions` e
  `client.invoices.get(chave, { ambiente })`.
- Avisos (`warnings`) para divergencias cambiais.

## [2.2.0] - 2026-08-05

## [2.1.0] - 2026-07-31

## [2.0.0] - 2026-07-18

Versoes anteriores: veja as [releases no GitHub](https://github.com/useinvio/nfse-sdk/releases).

[3.2.0]: https://github.com/useinvio/nfse-sdk/compare/3.0.0...HEAD
[3.1.0]: https://github.com/useinvio/nfse-sdk/compare/3.0.0...HEAD
[3.0.0]: https://github.com/useinvio/nfse-sdk/releases/tag/3.0.0
[2.2.0]: https://github.com/useinvio/nfse-sdk/releases/tag/2.2.0
[2.1.0]: https://github.com/useinvio/nfse-sdk/releases/tag/2.1.0
[2.0.0]: https://github.com/useinvio/nfse-sdk/releases/tag/2.0.0
