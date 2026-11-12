# Usar com agentes de IA e MCP

O subpath `@useinvio/nfse-sdk/agent` expõe ferramentas neutras de framework para
servidores MCP e agentes (OpenAI, LangChain, Vercel AI SDK, Claude). Cada
ferramenta traz `name`, `description`, `inputSchema`/`outputSchema` em JSON
Schema, `annotations` no formato MCP e um handler `run`.

| Ferramenta | Efeito | Certificado |
| --- | --- | --- |
| `validate_dps` | Valida a requisição; nenhum efeito colateral. | Não |
| `build_dps_xml` | Gera o XML não assinado e confere contra o XSD v1.01. | Não |
| `get_nfse` | Consulta uma NFS-e pela chave de acesso. | Sim |

```ts
import { nfseAgentTools } from '@useinvio/nfse-sdk/agent';

const context = { pfx: certificado, ambiente: 'restrita' as const }; // configuração do host
for (const tool of nfseAgentTools) {
  // registre tool.name, tool.description, tool.inputSchema e tool.annotations no seu framework
  // e chame tool.run(argumentos, context) quando o modelo usar a ferramenta
}
```

## Segurança

- Certificado e ambiente ficam no `context` do host, nunca na entrada da
  ferramenta: o modelo não escolhe `producao` nem vê material de chave.
- Uma requisição com `ambiente` diferente do configurado gera `AMBIENTE_NOT_ALLOWED`.
- Emissão e cancelamento ainda não são ferramentas: exigirão confirmação
  explícita em duas etapas antes do envio.

## Formato dos erros

Falhas esperadas retornam `issues` com `code`, `path`, `severity`, `source` e
`suggestion`. Falhas de infraestrutura (rede, motor XSD) rejeitam a promise.
`toAgentIssues(error)` converte erros do SDK para esse mesmo formato.

## JSON Schema

`DPS_JSON_REQUEST_SCHEMA`, exportado também pela raiz do pacote, descreve o
`DpsJsonRequest` em JSON Schema 2020-12 com um subconjunto portável de
palavras-chave. Ele cobre formatos e domínios de códigos, mas não as regras
entre campos (regime × `totTrib`, nacional × exportação):
`validateDpsJsonRequest` continua sendo a autoridade. `validate_dps` aponta
campos desconhecidos como `UNSUPPORTED_FIELD` em vez de ignorá-los.

## Contexto para assistentes de código

O pacote publica [`llms.txt`](../../llms.txt), um guia compacto da API para
assistentes como Claude Code, Cursor e Copilot.
