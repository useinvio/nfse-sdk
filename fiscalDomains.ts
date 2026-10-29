/**
 * Code domains accepted by the JSON validator, shared with the JSON Schema so
 * both reject the same values. Labels follow the v1.01 XSD documentation.
 */

export type LabeledDomain = Readonly<Record<string, string>>;

export const OP_SIMP_NAC: LabeledDomain = {
  '1': 'Nao optante',
  '2': 'Optante MEI',
  '3': 'Optante ME/EPP',
};

export const REG_AP_TRIB_SN: LabeledDomain = {
  '1': 'Tributos federais e municipal apurados pelo SN',
  '2': 'Tributos federais pelo SN; ISSQN fora do SN',
  '3': 'Tributos federais e municipal fora do SN',
};

export const REG_ESP_TRIB: LabeledDomain = {
  '0': 'Nenhum',
  '1': 'Ato cooperado (cooperativa)',
  '2': 'Estimativa',
  '3': 'Microempresa municipal',
  '4': 'Notario ou registrador',
  '5': 'Profissional autonomo',
  '6': 'Sociedade de profissionais',
  '9': 'Outros',
};

export const TRIB_ISSQN: LabeledDomain = {
  '1': 'Operacao tributavel',
  '2': 'Imunidade',
  '3': 'Exportacao de servico',
  '4': 'Nao incidencia',
};

export const TP_RET_ISSQN: LabeledDomain = {
  '1': 'Nao retido',
  '2': 'Retido pelo tomador',
  '3': 'Retido pelo intermediario',
};

export const TP_IMUNIDADE: LabeledDomain = {
  '0': 'Imunidade (tipo nao informado na nota de origem)',
  '1': 'Patrimonio, renda ou servicos, uns dos outros (CF88, art. 150, VI, a)',
  '2': 'Templos de qualquer culto (CF88, art. 150, VI, b)',
  '3': 'Partidos politicos, sindicatos, educacao e assistencia social sem fins lucrativos (CF88, art. 150, VI, c)',
  '4': 'Livros, jornais, periodicos e papel de impressao (CF88, art. 150, VI, d)',
  '5': 'Fonogramas e videofonogramas musicais brasileiros (CF88, art. 150, VI, e)',
};

/** `0` exists in the XSD but is restricted to notes imported from another origin. */
export const C_NAO_NIF: LabeledDomain = {
  '1': 'Dispensado do NIF',
  '2': 'Nao exigencia do NIF',
};

export const TP_RET_PIS_COFINS: LabeledDomain = {
  '0': 'PIS/COFINS/CSLL nao retidos',
  '1': 'PIS/COFINS retidos',
  '2': 'PIS/COFINS nao retidos',
  '3': 'PIS/COFINS/CSLL retidos',
  '4': 'PIS/COFINS retidos, CSLL nao retido',
  '5': 'PIS retido, COFINS/CSLL nao retidos',
  '6': 'COFINS retido, PIS/CSLL nao retidos',
  '7': 'PIS nao retido, COFINS/CSLL retidos',
  '8': 'PIS/COFINS nao retidos, CSLL retido',
  '9': 'COFINS nao retido, PIS/CSLL retidos',
};

export const PIS_COFINS_CST: readonly string[] = [
  '00', '01', '02', '03', '04', '05', '06', '07', '08', '09',
  '49', '50', '51', '52', '53', '54', '55', '56',
  '60', '61', '62', '63', '64', '65', '66', '67',
  '70', '71', '72', '73', '74', '75', '98', '99',
];

export const MD_PRESTACAO: LabeledDomain = {
  '0': 'Desconhecido',
  '1': 'Transfronteirico',
  '2': 'Consumo no Brasil',
  '3': 'Presenca comercial no exterior',
  '4': 'Movimento temporario de pessoas fisicas',
};

export const VINC_PREST: LabeledDomain = {
  '0': 'Sem vinculo',
  '1': 'Controlada',
  '2': 'Controladora',
  '3': 'Coligada',
  '4': 'Matriz',
  '5': 'Filial ou sucursal',
  '6': 'Outro vinculo',
  '9': 'Desconhecido',
};

export const MEC_AF_COMEX_P: readonly string[] = Array.from({ length: 9 }, (_, i) => String(i).padStart(2, '0'));
export const MEC_AF_COMEX_T: readonly string[] = Array.from({ length: 27 }, (_, i) => String(i).padStart(2, '0'));

export const MOV_TEMP_BENS: LabeledDomain = {
  '0': 'Desconhecido',
  '1': 'Nao',
  '2': 'Vinculada a declaracao de importacao',
  '3': 'Vinculada a declaracao de exportacao',
};

export const MDIC: LabeledDomain = {
  '0': 'Nao enviar para o MDIC',
  '1': 'Enviar para o MDIC',
};

export function domainValues(domain: LabeledDomain | readonly string[]): string[] {
  return Array.isArray(domain) ? [...domain] : Object.keys(domain);
}
