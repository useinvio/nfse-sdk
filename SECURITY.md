# Segurança

Este SDK manipula certificados A1 ICP-Brasil e assina documentos fiscais. Levamos
relatos de vulnerabilidade a sério.

## Como relatar

**Não abra uma issue pública.** Use o relato privado do GitHub:
[Report a vulnerability](https://github.com/useinvio/nfse-sdk/security/advisories/new).

Inclua a versão do pacote, os passos para reproduzir e o impacto esperado. Nunca
envie certificados, senhas, chaves privadas ou XMLs reais com dados de clientes:
use os helpers de `@useinvio/nfse-sdk/testing` para montar um caso.

Vamos confirmar o recebimento, investigar e combinar com você a divulgação depois
da correção.

## Versões suportadas

Correções de segurança saem na versão mais recente publicada no npm. Atualize
para a última versão antes de relatar.

## Escopo

Interessa especialmente:

- vazamento de chave privada, senha ou bytes do PFX (logs, erros, serialização);
- assinatura XML que valida um documento alterado;
- XML externo processando DTD, entidades ou acesso à rede;
- parâmetros de URL que alcançam outro caminho da SEFIN/ADN;
- ferramentas de agente ou servidor MCP que enviam à SEFIN sem a etapa de confirmação.

Fora do escopo: regras fiscais e rejeições da própria SEFIN.
