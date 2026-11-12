# Usar com agentes de IA e MCP

Há três formas, da mais rápida para a mais flexível:

| Forma | Para quem |
|---|---|
| [Servidor MCP](#servidor-mcp) `@useinvio/nfse-mcp` | Claude Code, Claude Desktop, Cursor, VS Code ou qualquer cliente MCP. |
| [Plugin do Claude Code](#plugin-do-claude-code) | Servidor MCP + uma skill que ensina o fluxo ao Claude, com o certificado configurado numa tela. |
| [Ferramentas do SDK](#ferramentas-no-seu-agente) `@useinvio/nfse-sdk/agent` | Seu próprio agente (Claude Agent SDK, OpenAI, LangChain, Vercel AI SDK). |

## Servidor MCP

Para experimentar sem certificado, o modo de teste usa uma SEFIN simulada dentro
do próprio servidor:

```bash
claude mcp add nfse --env NFSE_MCP_MOCK=1 --env NFSE_MCP_ALLOW_WRITE=1 -- npx -y @useinvio/nfse-mcp
```

Com o seu certificado A1, na produção restrita e só com ferramentas de leitura:

```bash
claude mcp add nfse --env NFSE_CERT_PATH=/caminho/certificado.pfx --env NFSE_CERT_PASSWORD_FILE=/caminho/senha.txt -- npx -y @useinvio/nfse-mcp
```

| Variável | Padrão | |
|---|---|---|
| `NFSE_CERT_PATH` / `NFSE_CERT_BASE64` | – | Certificado A1. Sem ele, só as ferramentas sem certificado funcionam. |
| `NFSE_CERT_PASSWORD` / `NFSE_CERT_PASSWORD_FILE` | – | Senha do certificado. Prefira o arquivo. |
| `NFSE_AMBIENTE` | `restrita` | `producao` emite notas com validade jurídica. |
| `NFSE_MCP_ALLOW_WRITE` | desligado | `1` habilita emitir e cancelar (prepare/confirm). |
| `NFSE_MCP_MOCK` | desligado | `1` usa a SEFIN simulada e um certificado de teste. Recusado com `producao`. |

Configuração para Claude Desktop, Cursor e VS Code no
[README do pacote](../../mcp/README.md).

## Plugin do Claude Code

```text
/plugin install nfse-nacional --marketplace useinvio/nfse-sdk
```

O plugin pede o caminho do certificado, a senha (guardada no cofre de
credenciais do sistema), o ambiente e se emitir/cancelar fica liberado. Ele
inclui a skill `nfse-nacional`, que ensina o Claude a validar antes de emitir,
nunca inventar códigos fiscais, mostrar o resumo antes de confirmar e explicar
rejeições com o catálogo oficial.

## Ferramentas

| Ferramenta | Efeito | Certificado |
| --- | --- | --- |
| `validate_dps` | Valida a requisição; nenhum efeito colateral. | Não |
| `build_dps_xml` | Gera o XML não assinado e confere contra o XSD v1.01. | Não |
| `explain_rejection` | Mensagem, regra e campo oficiais de códigos como `E0014`. | Não |
| `get_nfse` | Consulta uma NFS-e pela chave de acesso. | Sim |
| `recover_nfse_by_dps` | Diz se a SEFIN gerou NFS-e para um Id de DPS. | Sim |
| `prepare_nfse_emission` | Valida e assina **sem enviar**; devolve resumo e `confirmationId`. | Sim, escrita |
| `confirm_nfse_emission` | Envia a DPS preparada. | Sim, escrita |
| `prepare_nfse_cancellation` | Monta o cancelamento e mostra a nota; não envia. | Sim, escrita |
| `confirm_nfse_cancellation` | Envia o cancelamento preparado. | Sim, escrita |

## Segurança

- Certificado e ambiente vêm da configuração do host, nunca da entrada da
  ferramenta: o modelo não escolhe `producao` nem vê material de chave.
- As ferramentas de escrita só existem com `allowWrite` (`NFSE_MCP_ALLOW_WRITE=1`).
- Emitir e cancelar sempre exigem duas chamadas. `prepare_*` devolve um resumo;
  a descrição da ferramenta e as instruções do servidor mandam o modelo mostrar
  o resumo e só chamar `confirm_*` depois da aprovação explícita do usuário.
- O `confirmationId` é de uso único e expira em 10 minutos.
- Se a conexão cair durante `confirm_nfse_emission`, repetir a chamada consulta
  a DPS na SEFIN antes de reenviar: a mesma nota nunca é emitida duas vezes.
- `confirm_*` têm `destructiveHint: true`, então clientes MCP pedem confirmação
  antes de executar.

## Ferramentas no seu agente

```ts
import { createNfseAgentToolkit, nfseAgentTools } from '@useinvio/nfse-sdk/agent';

const context = { pfx: certificado, ambiente: 'restrita' as const }; // configuração do host
const { tools } = createNfseAgentToolkit({ allowWrite: true });   // ou nfseAgentTools, só leitura
for (const tool of tools) {
  // registre tool.name, tool.description, tool.inputSchema e tool.annotations no seu framework
  // e chame tool.run(argumentos, context) quando o modelo usar a ferramenta
}
```

Cada ferramenta traz `name`, `title`, `description`, `inputSchema` e
`outputSchema` em JSON Schema, `annotations` no formato MCP e um handler `run`.
Falhas esperadas retornam `ok: false` com `issues` (`code`, `path`, `severity`,
`source`, `message`, `suggestion`); rejeições da SEFIN trazem a regra oficial em
`suggestion`. Falhas de infraestrutura rejeitam a promise. `toAgentIssues(error)`
converte erros do SDK para esse formato.

Para montar o seu próprio servidor MCP com outro transporte, use
`createNfseMcpServer(options).handle(mensagem)` de `@useinvio/nfse-sdk/mcp`.

## JSON Schema

`DPS_JSON_REQUEST_SCHEMA` descreve o `DpsJsonRequest` em JSON Schema 2020-12 com
um subconjunto portável de palavras-chave. Ele cobre formatos e domínios de
códigos, mas não as regras entre campos (regime × `totTrib`, nacional ×
exportação): `validateDpsJsonRequest` continua sendo a autoridade.

## Contexto para assistentes de código

O pacote publica [`llms.txt`](../../llms.txt), um guia compacto da API para
assistentes como Claude Code, Cursor e Copilot. Quem for alterar o SDK encontra
as regras do repositório em [`AGENTS.md`](../../AGENTS.md).
