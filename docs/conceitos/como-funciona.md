# Como o SDK funciona

O SDK cuida da camada de protocolo da NFS-e Nacional. A aplicação decide o
conteúdo fiscal; o SDK transforma esse conteúdo em uma DPS válida, assina,
transmite e devolve a resposta oficial em formato estruturado.

## O caminho de uma emissão

```text
JSON (DpsJsonRequest)           XML de DPS pronto
        │                               │
        ▼                               │
validateDpsJsonRequest ──► buildDpsFromJson
        │                               │
        └───────────────┬───────────────┘
                        ▼
          XSD oficial v1.01 (libxml2 em WebAssembly)
                        ▼
          vigência do certificado A1
                        ▼
          assinatura XMLDSIG de <infDPS> (RSA-SHA256)
                        ▼
          GZip + Base64  →  POST /nfse por mTLS
                        ▼
          NFS-e autorizada (XML) ou EmitirNotaError
```

`emitirNfse` faz tudo isso em uma chamada. `prepararNota` e
`transmitirNotaPreparada` separam a preparação do envio, para que você salve a
DPS assinada antes de transmitir.

## Dois serviços: SEFIN e ADN

| Serviço | Para quê | Funções |
|---|---|---|
| **SEFIN Nacional** | Emitir, consultar NFS-e e DPS, registrar e consultar eventos | `emitirNfse`, `obterNfse`, `recuperarNfsePorDps`, `cancelarNfse`, `consultarEvento` |
| **ADN** (Ambiente de Dados Nacional) | DANFSe em PDF, distribuição por NSU, eventos por chave, parâmetros municipais | `baixarDanfse`, `distribuirDfePorNsu`, `consultarEventosPorChaveAdn`, `consultarConvenio`, `consultarAliquota` |

Os dois usam o mesmo certificado A1 por mTLS. As URLs de cada ambiente estão em
[Ambientes](../referencia/ambientes.md).

## Ambientes

`restrita` (produção restrita, o sandbox oficial) é o padrão. Notas emitidas em
`producao` têm validade jurídica. O `tpAmb` dentro do XML precisa coincidir com
o ambiente de envio; o SDK recusa a divergência antes de transmitir.

## Idempotência

`POST /nfse` e `POST /nfse/{chave}/eventos` não são idempotentes. Por isso o SDK
nunca os repete sozinho. Só os GETs aceitam `retries`. Se uma emissão cair sem
resposta, consulte a DPS com `recuperarNfsePorDps` antes de reenviar; veja
[Recuperar uma emissão após timeout](../guias/recuperar-emissao.md).

## O certificado

O A1 (`.pfx`) assina o XML e autentica a conexão mTLS. `NfseCertificate` lê o
arquivo uma vez e guarda só o necessário:

- a chave privada como `KeyObject`, fora do objeto público;
- um agente HTTPS próprio, para que conexões nunca sejam compartilhadas entre
  emitentes;
- metadados públicos: CNPJ/CPF dos campos ICP-Brasil, validade, emissor e
  fingerprint.

A senha e os bytes do PFX são descartados. `console.log` e `JSON.stringify`
mostram só os metadados. Isso evita vazamentos acidentais; não protege contra
quem já tem acesso à memória do processo. Assinatura em KMS/HSM não está nos
planos: o mTLS exige a chave no processo de qualquer forma.

## O que o SDK não faz

- Não escolhe códigos de serviço, CST, alíquotas, retenções ou regime.
- Não calcula impostos nem valida se a declaração está contabilmente correta.
- Não guarda estado: sem banco de dados, sem numeração automática de `nDPS`,
  sem memória de tenant.
- Não implementa ainda o grupo IBS/CBS da reforma tributária (NT 009).

Campos fiscais obrigatórios como `tributacaoMunicipal` e `totTrib` precisam vir
explícitos na entrada: não há defaults silenciosos.

## Princípios de design

- Funções pequenas, testáveis e reutilizáveis; o `NfseClient` é uma fachada fina.
- Erros oficiais da SEFIN preservados na íntegra, nunca engolidos.
- Nenhuma dependência nativa: XSD em WebAssembly, criptografia do Node.
- Parâmetros de URL validados antes de qualquer chamada de rede.
