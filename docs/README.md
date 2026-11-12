# Documentação do @useinvio/nfse-sdk

Comece pelo tutorial se for seu primeiro contato. Depois use os guias para
tarefas específicas e a referência para consultar detalhes.

## Tutorial

- [Sua primeira NFS-e na produção restrita](tutoriais/primeira-nfse.md): emitir,
  consultar, baixar o DANFSe e cancelar, do zero.

## Guias

| Guia | Para |
|---|---|
| [Configurar o certificado A1](guias/certificado.md) | Variáveis de ambiente, cofres de segredo, vários emitentes. |
| [Emitir uma NFS-e](guias/emitir.md) | JSON declarativo, `NfseClient`, XML pronto, série e número. |
| [Consultar e baixar o DANFSe](guias/consultar.md) | Consulta tipada, consulta crua, PDF. |
| [Recuperar uma emissão após timeout](guias/recuperar-emissao.md) | Evitar notas duplicadas quando a conexão cai. |
| [Cancelar uma NFS-e](guias/cancelar.md) | Cancelamento e cancelamento por substituição. |
| [Tratar rejeições e erros](guias/rejeicoes.md) | O que cada erro significa e o que fazer. |
| [Timeouts e novas tentativas](guias/timeouts.md) | `timeoutMs`, `retries`, `signal`. |
| [Distribuição e parâmetros municipais](guias/adn.md) | NSU, convênio, alíquotas, regimes especiais. |
| [Testar sem certificado](guias/testes.md) | SEFIN simulada e certificado de teste para o seu CI. |
| [Agentes de IA e MCP](guias/agentes-ia.md) | Servidor MCP, plugin do Claude Code e ferramentas para o seu agente. |
| [Métricas de latência](METRICS.md) | Observar a SEFIN em produção. |

## Referência

- [API](referencia/api.md): todas as funções e o `NfseClient`.
- [Erros](referencia/erros.md): classes, campos e códigos.
- [Ambientes](referencia/ambientes.md): URLs e endpoints.
- [Mapeamento do JSON da DPS](../JSON_MAPPING.md): cada campo de `DpsJsonRequest`.
- [Matriz fiscal](FISCAL_MATRIX.md): combinações aceitas por regime.

## Conceitos

- [Como o SDK funciona](conceitos/como-funciona.md): fluxo de emissão, SEFIN e
  ADN, idempotência, certificado e o que o SDK não faz.

## Histórico

- [CHANGELOG](../CHANGELOG.md)
- [Migração 2.x → 3.0.0](CORRECOES_EMISSAO.md)
- [Regras de negócio da emissão (análise de 06/10/2026)](REGRAS_NEGOCIO_EMISSAO.md)
