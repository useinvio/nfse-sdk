# Testar sem certificado e sem rede

`@useinvio/nfse-sdk/testing` traz duas peças para testar a sua integração de
ponta a ponta, no CI, sem certificado A1 real e sem chamar a SEFIN:

- `createTestCertificate()`: um certificado A1 autoassinado com o CNPJ (ou CPF)
  nos mesmos campos ICP-Brasil de um certificado real;
- `installMockSefin()`: uma SEFIN e um ADN simulados dentro do processo. Toda
  chamada do SDK é respondida localmente até `restore()`.

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { cancelarNfse, emitirNfse, obterNfse } from '@useinvio/nfse-sdk';
import { createTestCertificate, installMockSefin } from '@useinvio/nfse-sdk/testing';

const { certificate } = createTestCertificate({ cnpj: '12345678000195' });

test('emite e cancela', async (t) => {
  const mock = installMockSefin();
  t.after(() => mock.restore());

  const { chaveAcesso } = await emitirNfse(minhaNota, certificate);
  const { resumo } = await obterNfse(chaveAcesso, certificate);
  assert.equal(resumo.emitente.CNPJ, '12345678000195');

  await cancelarNfse({ chaveAcesso, cMotivo: '1', xMotivo: 'Teste de cancelamento' }, certificate);
  assert.equal(mock.notas.get(chaveAcesso)?.cancelada, true);
});
```

## O que a SEFIN simulada verifica

- A DPS e o pedido de evento contra o XSD oficial (como a SEFIN, responde `E1235`).
- A assinatura XMLDSIG com o certificado da chamada (`E0714`).
- O ambiente do XML contra o ambiente de envio (`E0006`, `E1845`).
- DPS repetida (`E0014`) e cancelamento repetido (`E0840`, `E0845`).

As mensagens vêm do catálogo oficial, como na SEFIN. A simulação **não** aplica
regras fiscais nem municipais: uma nota aceita pelo mock ainda pode ser rejeitada
na produção restrita.

Rotas simuladas: emissão, consulta por chave e por DPS, registro e consulta de
eventos, DANFSe (um PDF mínimo), distribuição por NSU, eventos por chave e
parâmetros municipais (respostas genéricas).

## Simular falhas

```ts
mock.rejectNext('E0312');          // próxima chamada rejeitada com a mensagem oficial do código
mock.rejectNext([{ Codigo: 'E0001', Descricao: '...' }], { status: 400, path: /^\/nfse$/ });
mock.failNext();                   // erro de rede antes de a SEFIN processar
mock.dropResponseNext();           // a SEFIN processa, mas a resposta se perde
mock.route('GET', /^\/parametrizacao\/.+\/aliquota$/, () => ({ status: 200, body: '{"aliquota":2}' }));
```

`dropResponseNext` é o cenário de [recuperação após timeout](recuperar-emissao.md):
a nota existe na SEFIN, mas a sua aplicação não recebeu a chave.

## Inspecionar

- `mock.notas`: notas emitidas, por chave (`nfseXml`, `dpsId`, `cancelada`, `eventos`).
- `mock.requests`: cada chamada recebida, com método, host, caminho e status.

## Certificados de teste

```ts
createTestCertificate({ cpf: '39053344705' });     // e-CPF
createTestCertificate({ validDays: -1 });          // vencido: testa CERTIFICATE_EXPIRED
const { pfx, password } = createTestCertificate(); // bytes do PFX para testar fromPfx/fromEnv
```

O certificado é autoassinado e não é ICP-Brasil: a SEFIN real o recusa.

## No servidor MCP

`NFSE_MCP_MOCK=1` liga a mesma SEFIN simulada dentro do servidor MCP, para
experimentar as ferramentas de emissão sem certificado. Veja
[Agentes de IA e MCP](agentes-ia.md).
