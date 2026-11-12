# Erros

Todos os erros estendem `Error` e têm `name` igual ao nome da classe. Como
tratar cada um: [Tratar rejeições e erros](../guias/rejeicoes.md).

## Antes de enviar (nada chegou à SEFIN)

| Classe | Campos | Quando |
|---|---|---|
| `DpsFiscalValidationError` | `issues`, `report` | O JSON da DPS é inválido. Cada issue tem `code`, `path`, `severity`, `source`, `message`, `suggestion?`. |
| `DpsXsdValidationError` | `details` | O XML da DPS viola o XSD oficial v1.01. |
| `PedRegEventoXsdValidationError` | `details` | O pedido de evento viola o XSD oficial. |
| `EventoInvalidoError` | `code = 'EVENTO_INVALID'`, `field` | Entrada de evento inválida (chave, motivo, autor). |
| `CertificateValidationError` | `code` | Problema no A1; códigos abaixo. |
| `ChaveAcessoInvalidaError` | `code = 'CHAVE_ACESSO_INVALID_FORMAT'`, `chaveAcesso` | Chave sem exatamente 50 dígitos. |
| `SefinParametroInvalidoError` | `code = 'SEFIN_PARAMETER_INVALID'`, `field`, `value` | Id da DPS, tipo de evento, NSU, município ou outro parâmetro de caminho com formato errado. |
| `XsdEngineUnavailableError` | `cause` | O motor XSD (WebAssembly) falhou. Infraestrutura, não rejeição fiscal. |

### Códigos de `CertificateValidationError`

| `code` | Quando |
|---|---|
| `CERTIFICATE_INVALID_PASSWORD` | Senha incorreta. |
| `CERTIFICATE_UNREADABLE` | O conteúdo não é um PFX/PEM válido. |
| `CERTIFICATE_MISSING` | `fromEnv` sem `NFSE_CERT_PATH` nem `NFSE_CERT_BASE64`. |
| `CERTIFICATE_PASSWORD_MISSING` | `fromEnv` sem `NFSE_CERT_PASSWORD` nem `NFSE_CERT_PASSWORD_FILE`. |
| `CERTIFICATE_NOT_YET_VALID` | Antes de `notBefore`. |
| `CERTIFICATE_EXPIRED` | Depois de `notAfter`. |
| `CERTIFICATE_HOLDER_MISMATCH` | O titular não é o CPF/CNPJ informado. |

## Depois de enviar (a SEFIN respondeu)

| Classe | Campos | Quando |
|---|---|---|
| `EmitirNotaError` | `status`, `erros`, `dpsId`, `body` | Emissão rejeitada, ou HTTP 2xx sem XML autorizado (`INVALID_AUTHORIZATION_RESPONSE`). |
| `RegistrarEventoError` | `status`, `erros`, `pedRegEventoId`, `body` | Evento rejeitado. |
| `ConsultaNfseError` | `status`, `erros`, `body`, `notFound` | Consulta falhou; `notFound` para HTTP 404. |

`erros` é uma lista de `SefinErro` (`Codigo`, `Descricao`, `Complemento?`) com o
código oficial da SEFIN preservado.

## Erros de rede

Timeouts e falhas de conexão chegam como o `Error` original do Node (por exemplo
`ECONNRESET` ou `SEFIN request timed out after 60000ms`). Depois de um desses
numa emissão, o resultado é incerto: [recupere pela DPS](../guias/recuperar-emissao.md).

## Ferramentas de agente

`toAgentIssues(error)` converte os erros acima em issues com `code`, `path`,
`severity`, `source` e `suggestion`. Códigos próprios das ferramentas:
`UNSUPPORTED_FIELD`, `AMBIENTE_NOT_ALLOWED`, `CERTIFICATE_REQUIRED`,
`XSD_INVALID` e `SEFIN_REJECTED`.
