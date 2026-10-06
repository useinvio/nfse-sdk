import { EmitirNotaError, emitirNfse, loadPfx } from '@useinvio/nfse-sdk';
import { nationalInvoice } from './payloads.js';

const pfx = loadPfx('./certificado.pfx', process.env.PFX_PASSWORD!);


try {
  const resultado = await emitirNfse(nationalInvoice, pfx);
  console.log(resultado.chaveAcesso);
  console.log(resultado.nfseXml);
} catch (error) {
  if (!(error instanceof EmitirNotaError)) throw error;

  console.error(`Emissao rejeitada pela SEFIN: HTTP ${error.status}`);
  for (const rejeicao of error.erros) {
    console.error(`${rejeicao.Codigo}: ${rejeicao.Descricao}`);
    if (rejeicao.Complemento) console.error(rejeicao.Complemento);
  }
}
