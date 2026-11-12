# Usar pelo terminal

O pacote traz o comando `nfse`. No seu projeto, depois de
`npm install @useinvio/nfse-sdk`, rode com `npx nfse`. Sem instalar:
`npx -p @useinvio/nfse-sdk nfse`.

## Em um minuto, sem certificado

```bash
npx nfse init                    # cria nota.json com valores ilustrativos
npx nfse validate nota.json      # regras do SDK + XSD oficial, sem enviar
npx nfse emit nota.json --mock   # emite numa SEFIN simulada, com certificado de teste
```

Troque CNPJ, municípios, código de serviço e tributação pelos do seu prestador
antes de emitir de verdade.

## Com o seu certificado

```bash
export NFSE_CERT_PATH=./certificado.pfx
export NFSE_CERT_PASSWORD_FILE=./senha.txt   # ou deixe que o nfse pergunte a senha

npx nfse doctor                  # Node.js, motor XSD, certificado e vencimento
npx nfse emit nota.json          # mostra o resumo e pede confirmação
npx nfse get <chave> -o nfse.xml
npx nfse danfse <chave>
npx nfse cancel <chave> --motivo 1 --justificativa "Nota emitida com valor incorreto"
```

O ambiente padrão é a produção restrita. `--producao` (ou `NFSE_AMBIENTE=producao`)
emite notas com validade jurídica e exige digitar `emitir` para confirmar.

## Comandos

| Comando | O que faz |
|---|---|
| `init [nota.json]` | Cria um JSON de nota de exemplo. Nunca sobrescreve. |
| `doctor` | Confere Node.js, motor XSD, certificado e dias até o vencimento. |
| `cert [arquivo.pfx]` | Titular, CNPJ/CPF, emissor, validade e fingerprint. Nunca mostra a chave. |
| `validate <nota.json>` | Valida o JSON e o XML contra o XSD oficial. |
| `xml <nota.json>` | Gera o XML da DPS não assinado (`-o` para salvar). |
| `emit <nota.json>` | Assina, mostra o resumo, confirma e envia. Após timeout, consulta a DPS antes de qualquer reenvio. |
| `get <chave>` | Resumo da NFS-e (`-o` salva o XML). |
| `danfse <chave>` | Salva o PDF do DANFSe. |
| `cancel <chave>` | Cancela (`--motivo 1\|2\|9 --justificativa "..."`), mostrando a nota antes. |
| `recover <dpsId>` | Diz se a SEFIN gerou NFS-e para uma DPS. |
| `explain <código...>` | Mensagem, regra e campo oficiais de códigos de rejeição. |
| `mcp` | Inicia o [servidor MCP](agentes-ia.md). |

## Opções

| Opção | |
|---|---|
| `--producao` | Ambiente de produção. |
| `--mock` | SEFIN simulada e certificado de teste. Não combina com `--producao`. |
| `--cert <arquivo>` / `--password-file <arquivo>` | Certificado e senha, no lugar das variáveis de ambiente. |
| `-o, --output <arquivo>` | Onde salvar XML ou PDF. |
| `-y, --yes` | Confirma sem perguntar (para scripts). Sem terminal interativo, `emit` e `cancel` exigem `--yes`. |
| `--json` | Saída em JSON, para scripts e CI. |

## Códigos de saída

| Código | Significado |
|---|---|
| `0` | Sucesso (ou cancelado por você na confirmação). |
| `1` | Erro de entrada, certificado, validação ou rede. |
| `2` | A SEFIN rejeitou; a explicação oficial de cada código é impressa. |
