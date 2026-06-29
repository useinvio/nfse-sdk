export type Ambiente = 'restrita' | 'producao';

export const SEFIN_BASE_URL: Record<Ambiente, string> = {
  producao: 'https://sefin.nfse.gov.br/SefinNacional',
  restrita: 'https://sefin.producaorestrita.nfse.gov.br/SefinNacional',
};

export const TP_AMB: Record<Ambiente, '1' | '2'> = {
  producao: '1',
  restrita: '2',
};

export const DEFAULT_AMBIENTE: Ambiente = 'restrita';

export function resolveSefinBaseUrl(ambiente: Ambiente = DEFAULT_AMBIENTE): string {
  return SEFIN_BASE_URL[ambiente];
}
