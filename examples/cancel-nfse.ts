import {
  baixarDanfse,
  cancelarNfse,
  consultarEvento,
  loadPfx,
  RegistrarEventoError,
  TP_EVENTO,
} from '@useinvio/nfse-sdk';
import { writeFile } from 'node:fs/promises';

async function cancelAndInspect(chaveAcesso: string) {
  const pfx = loadPfx('./certificado.pfx', process.env.PFX_PASSWORD!);

  // Baixa o PDF do DANFSe antes de cancelar, se precisar arquivar.
  const danfse = await baixarDanfse(chaveAcesso, pfx, 'restrita');
  if (danfse.pdf) await writeFile(`danfse-${chaveAcesso}.pdf`, danfse.pdf);

  try {
    const resultado = await cancelarNfse(
      {
        ambiente: 'restrita',
        chaveAcesso,
        autor: { CNPJ: '12345678000195' },
        cMotivo: '1', // 1 = Erro na Emissao; 2 = Servico nao Prestado; 9 = Outros
        xMotivo: 'Nota emitida com valor incorreto',
      },
      pfx,
    );

    console.log('Evento registrado:', resultado.pedRegEventoId);
    console.log(resultado.eventoXml);
  } catch (error) {
    if (!(error instanceof RegistrarEventoError)) throw error;
    console.error('Cancelamento rejeitado:', error.status, error.erros);
    return;
  }

  // Confirma o evento registrado na SEFIN.
  const eventos = await consultarEvento(chaveAcesso, TP_EVENTO.cancelamento, 1, pfx, 'restrita');
  console.log(eventos.status, eventos.body);
}

void cancelAndInspect('0'.repeat(50));
