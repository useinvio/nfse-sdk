# Tutorial: sua primeira NFS-e na produção restrita

Neste tutorial você emite, consulta, baixa o DANFSe e cancela uma NFS-e na
produção restrita, o ambiente oficial de testes. Nada aqui tem validade jurídica.
Leva uns 15 minutos.

**Você vai precisar de:**

- Node.js 20.6 ou mais recente (para `--env-file`);
- um certificado A1 (`.pfx`) ICP-Brasil do prestador e a senha;
- o prestador habilitado no Emissor Nacional, com o município conveniado.

## 1. Crie o projeto

```bash
mkdir minha-nfse && cd minha-nfse
npm init -y && npm pkg set type=module
npm install @useinvio/nfse-sdk
```

## 2. Configure o certificado

Copie o `.pfx` para a pasta e crie um `.env` (não versione nenhum dos dois):

```bash
NFSE_CERT_PATH=./certificado.pfx
NFSE_CERT_PASSWORD=sua-senha
```

Confira se o SDK lê o certificado:

```bash
node --env-file=.env -e "import('@useinvio/nfse-sdk').then(({ NfseCertificate }) => console.log(NfseCertificate.fromEnv()))"
```

A saída mostra só o CNPJ, a validade e o fingerprint, como
`NfseCertificate { cnpj=12345678000195, notAfter=..., fingerprintSha256=... }`.
Se aparecer `CERTIFICATE_INVALID_PASSWORD`, revise a senha.

## 3. Emita a nota

Crie `emitir.mjs`. Troque o CNPJ, os municípios (código IBGE) e os códigos de
serviço pelos do seu prestador; os valores abaixo são ilustrativos.

```js
import { emitirNfse, EmitirNotaError, NfseCertificate } from '@useinvio/nfse-sdk';

const certificado = NfseCertificate.fromEnv();

const nota = {
  ambiente: 'restrita',
  prestador: {
    cnpj: '12345678000195', // o CNPJ do certificado: certificado.cnpj
    cLocEmi: '4106902',
    serie: '1601',
    opSimpNac: '1',
    regEspTrib: '0',
  },
  servico: {
    cTribNac: '010201',
    xDescServ: 'Desenvolvimento de software',
    cLocPrestacao: '4106902',
  },
  emissao: {
    nDPS: '1',
    valores: { vServ: '10.00' },
    tributacaoMunicipal: { tribISSQN: '1', tpRetISSQN: '1' },
    tributacaoFederal: { piscofins: { CST: '07' } },
    totTrib: { pTotTribFed: '0.00', pTotTribEst: '0.00', pTotTribMun: '5.00' },
  },
};

try {
  const resultado = await emitirNfse(nota, certificado);
  console.log('Chave de acesso:', resultado.chaveAcesso);
} catch (error) {
  if (!(error instanceof EmitirNotaError)) throw error;
  for (const rejeicao of error.erros) console.error(rejeicao.Codigo, rejeicao.Descricao);
}
```

```bash
node --env-file=.env emitir.mjs
```

Se a SEFIN rejeitar, a mensagem traz o código oficial da rejeição.
Corrija o campo indicado e rode de novo. Depois de uma emissão autorizada,
**incremente `nDPS`** para a próxima nota: cada número de DPS gera uma nota só.

## 4. Consulte e baixe o DANFSe

Crie `consultar.mjs` e passe a chave de acesso como argumento:

```js
import { writeFile } from 'node:fs/promises';
import { baixarDanfse, NfseCertificate, obterNfse } from '@useinvio/nfse-sdk';

const certificado = NfseCertificate.fromEnv();
const chave = process.argv[2];

const nota = await obterNfse(chave, certificado, 'restrita');
console.log(nota.resumo.nNFSe, nota.resumo.cStat, nota.resumo.valores.vLiq);

const danfse = await baixarDanfse(chave, certificado, 'restrita');
if (danfse.pdf) await writeFile('danfse.pdf', danfse.pdf);
```

```bash
node --env-file=.env consultar.mjs <chave-de-acesso>
```

## 5. Cancele

```js
import { cancelarNfse, NfseCertificate } from '@useinvio/nfse-sdk';

const evento = await cancelarNfse(
  { ambiente: 'restrita', chaveAcesso: process.argv[2], cMotivo: '1', xMotivo: 'Teste de integracao do SDK' },
  NfseCertificate.fromEnv(),
);
console.log('Cancelada:', evento.pedRegEventoId);
```

## Próximos passos

- Leve o fluxo para a sua aplicação: [Emitir uma NFS-e](../guias/emitir.md).
- Proteja-se de timeouts: [Recuperar uma emissão](../guias/recuperar-emissao.md).
- Entenda o que acontece por baixo: [Como o SDK funciona](../conceitos/como-funciona.md).
- Antes de ir para `producao`, revise a [matriz fiscal](../FISCAL_MATRIX.md) com
  quem cuida da parte tributária.
