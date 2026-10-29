import * as domains from './fiscalDomains.js';
import { domainValues, type LabeledDomain } from './fiscalDomains.js';
import type {
  ComExt,
  DpsJsonInput,
  DpsJsonRequest,
  Endereco,
  EnderecoExterior,
  EnderecoNacional,
  Intermediario,
  Obra,
  PrestadorProfile,
  ServicoProfile,
  Tomador,
  TotTrib,
  TribFed,
  TribMun,
  Valores,
} from './dpsJson.js';

/**
 * JSON Schema (draft 2020-12) for the canonical `DpsJsonRequest` shape.
 *
 * It describes structure, field formats and code domains so tools and LLMs can
 * generate requests. Cross-field rules (regime x totTrib, national x export,
 * exactly one identifier) are described in the text but enforced only by
 * `validateDpsJsonRequest`, which remains the authority.
 *
 * Only a portable keyword subset is used (type, properties, required,
 * additionalProperties, enum, pattern, minLength, maxLength, exclusiveMinimum,
 * description, title) so the schema works across function-calling providers.
 * Legacy aliases and fields the validator rejects are deliberately omitted.
 */
export type JsonSchema = { readonly [keyword: string]: unknown };

/** Every field of `T` except `Omitted` must be described: adding a field to a type breaks the build here. */
type PropertiesOf<T, Omitted extends keyof T = never> = { readonly [K in Exclude<keyof T, Omitted>]-?: JsonSchema };

const DIGITS = (count: number, description: string): JsonSchema => ({
  type: 'string',
  pattern: `^\\d{${count}}$`,
  description,
});
const IBGE = (description: string) => DIGITS(7, `${description} Codigo IBGE do municipio, 7 digitos.`);
const COUNTRY = (description: string): JsonSchema => ({
  type: 'string',
  pattern: '^[A-Z]{2}$',
  description: `${description} ISO 3166-1 alpha-2, ex.: US.`,
});
const TEXT = (description: string, maxLength?: number): JsonSchema => ({
  type: 'string',
  minLength: 1,
  ...(maxLength ? { maxLength } : {}),
  description,
});
const DECIMAL = (description: string): JsonSchema => ({
  type: 'string',
  pattern: '^\\d+(\\.\\d+)?$',
  description: `${description} Decimal como string, ponto como separador, sem sinal nem notacao exponencial; serializado com 2 casas.`,
});

function code(domain: LabeledDomain | readonly string[], description: string): JsonSchema {
  const values = domainValues(domain);
  const labels = Array.isArray(domain)
    ? ''
    : ` Valores: ${Object.entries(domain).map(([value, label]) => `${value}=${label}`).join('; ')}.`;
  return { type: 'string', enum: values, description: `${description}${labels}` };
}

function object(properties: Record<string, JsonSchema>, required: readonly string[], description: string): JsonSchema {
  return { type: 'object', description, properties, required: [...required], additionalProperties: false };
}

const X_DESC_SERV = TEXT('Descricao completa do servico prestado.', 2000);
const C_LOC_PRESTACAO = IBGE('Municipio onde o servico foi prestado.');
const C_NBS = DIGITS(9, 'Codigo NBS do servico, 9 digitos.');

const prestador = object({
  cnpj: DIGITS(14, 'CNPJ do prestador, somente digitos. Informe exatamente um de cnpj ou cpf.'),
  cpf: DIGITS(11, 'CPF do prestador, somente digitos. Informe exatamente um de cnpj ou cpf.'),
  cLocEmi: IBGE('Municipio emissor.'),
  serie: { type: 'string', pattern: '^\\d{1,5}$', description: 'Serie da DPS, 1 a 5 digitos.' },
  opSimpNac: code(domains.OP_SIMP_NAC, 'Situacao perante o Simples Nacional; determina a forma de totTrib.'),
  regApTribSN: code(domains.REG_AP_TRIB_SN, 'Regime de apuracao do Simples Nacional. Somente quando opSimpNac=3.'),
  regEspTrib: code(domains.REG_ESP_TRIB, 'Regime especial de tributacao.'),
} satisfies PropertiesOf<PrestadorProfile, 'tpInsc'>, ['cLocEmi', 'serie', 'opSimpNac', 'regEspTrib'],
'Perfil fiscal do prestador (emitente).');

const servico = object({
  cTribNac: DIGITS(6, 'Codigo de tributacao nacional do ISSQN (LC 116/2003): item, subitem e desdobro, 6 digitos.'),
  xDescServ: X_DESC_SERV,
  cLocPrestacao: C_LOC_PRESTACAO,
  cNBS: C_NBS,
} satisfies PropertiesOf<ServicoProfile>, ['cTribNac', 'xDescServ', 'cLocPrestacao'],
'Servico padrao do prestador; emissao.servico pode sobrescrever campos por nota.');

const endNac = object({
  cMun: IBGE('Municipio do endereco.'),
  CEP: DIGITS(8, 'CEP, 8 digitos.'),
} satisfies PropertiesOf<EnderecoNacional>, ['cMun', 'CEP'], 'Endereco nacional.');

const endExt = object({
  cPais: COUNTRY('Pais do endereco.'),
  cEndPost: TEXT('Codigo de enderecamento postal.'),
  xCidade: TEXT('Cidade.'),
  xEstProvReg: TEXT('Estado, provincia ou regiao.'),
} satisfies PropertiesOf<EnderecoExterior>, ['cPais', 'cEndPost', 'xCidade', 'xEstProvReg'], 'Endereco no exterior.');

const endereco = object({
  endNac,
  endExt,
  xLgr: TEXT('Logradouro.'),
  nro: TEXT('Numero.'),
  xCpl: TEXT('Complemento.'),
  xBairro: TEXT('Bairro.'),
} satisfies PropertiesOf<Endereco>, ['xLgr', 'nro', 'xBairro'],
'Endereco. Informe exatamente um de endNac (tomador nacional) ou endExt (tomador exterior).');

const tomador = object({
  CNPJ: DIGITS(14, 'CNPJ do tomador nacional.'),
  CPF: DIGITS(11, 'CPF do tomador nacional.'),
  NIF: TEXT('Numero de identificacao fiscal do tomador exterior.'),
  cNaoNIF: code(domains.C_NAO_NIF, 'Motivo de ausencia do NIF do tomador exterior.'),
  xNome: TEXT('Nome ou razao social.'),
  end: endereco,
  fone: TEXT('Telefone.'),
  email: TEXT('E-mail.'),
} satisfies PropertiesOf<Tomador>, ['xNome'],
'Tomador do servico. Informe exatamente um identificador: CNPJ ou CPF (nacional, com end.endNac) ou NIF ou cNaoNIF (exportacao, com end.endExt).');

const intermediario = object({
  CNPJ: DIGITS(14, 'CNPJ do intermediario.'),
  CPF: DIGITS(11, 'CPF do intermediario.'),
  xNome: TEXT('Nome ou razao social.'),
} satisfies PropertiesOf<Intermediario>, ['xNome'], 'Intermediario nacional. Informe exatamente um de CNPJ ou CPF.');

const valores = object({
  vServ: DECIMAL('Valor do servico em reais; maior que zero apos arredondamento.'),
  vServMoeda: DECIMAL('Valor do servico em moeda estrangeira (exportacao).'),
  cotacao: { type: 'number', exclusiveMinimum: 0, description: 'Cotacao da moeda estrangeira em reais (exportacao).' },
} satisfies PropertiesOf<Valores, 'vDesc' | 'vDedRed'>, [],
'Valores. Nacional: informe vServ. Exportacao: informe vServMoeda e cotacao (vServ opcional; se ausente, vServMoeda x cotacao).');

const tributacaoMunicipal = object({
  tribISSQN: code(domains.TRIB_ISSQN, 'Tributacao do ISSQN.'),
  tpRetISSQN: code(domains.TP_RET_ISSQN, 'Retencao do ISSQN.'),
  pAliq: {
    type: 'string',
    pattern: '^\\d(\\.\\d+)?$',
    description: 'Aliquota do ISSQN em %, ate 9.99. Nao informe quando opSimpNac=1.',
  },
  tpImunidade: code(domains.TP_IMUNIDADE, 'Tipo de imunidade. Obrigatorio somente quando tribISSQN=2.'),
  cPaisResult: COUNTRY('Pais onde se verifica o resultado do servico. Obrigatorio somente quando tribISSQN=3.'),
} satisfies PropertiesOf<TribMun>, ['tribISSQN', 'tpRetISSQN'],
'Tributacao municipal (ISSQN). Obrigatoria: o SDK nao assume tratamento padrao.');

const piscofins = object({
  CST: code(domains.PIS_COFINS_CST, 'Codigo de situacao tributaria do PIS/COFINS, ex.: 07 = operacao isenta.'),
  vBCPisCofins: DECIMAL('Base de calculo do PIS/COFINS.'),
  pAliqPis: DECIMAL('Aliquota do PIS em %.'),
  pAliqCofins: DECIMAL('Aliquota da COFINS em %.'),
  vPis: DECIMAL('Valor do PIS.'),
  vCofins: DECIMAL('Valor da COFINS.'),
  tpRetPisCofins: code(domains.TP_RET_PIS_COFINS, 'Retencao do PIS/COFINS/CSLL.'),
} satisfies PropertiesOf<NonNullable<TribFed['piscofins']>>, ['CST'], 'PIS/COFINS.');

const tributacaoFederal = object({
  piscofins,
  vRetCP: DECIMAL('Contribuicao previdenciaria retida.'),
  vRetIRRF: DECIMAL('IRRF retido.'),
  vRetCSLL: DECIMAL('CSLL retida.'),
} satisfies PropertiesOf<TribFed>, [], 'Tributacao federal.');

const totTrib = object({
  vTotTribFed: DECIMAL('Valor aproximado dos tributos federais.'),
  vTotTribEst: DECIMAL('Valor aproximado dos tributos estaduais.'),
  vTotTribMun: DECIMAL('Valor aproximado dos tributos municipais.'),
  pTotTribFed: DECIMAL('Percentual aproximado dos tributos federais.'),
  pTotTribEst: DECIMAL('Percentual aproximado dos tributos estaduais.'),
  pTotTribMun: DECIMAL('Percentual aproximado dos tributos municipais.'),
  pTotTribSN: DECIMAL('Percentual aproximado dos tributos do Simples Nacional.'),
  indTotTrib: { type: 'string', enum: ['0'], description: 'Indicador de nao informacao da carga tributaria (MEI).' },
} satisfies PropertiesOf<TotTrib>, [],
'Carga tributaria aproximada. Informe uma unica forma conforme prestador.opSimpNac: ' +
'1 (nao optante) = pTotTribFed, pTotTribEst e pTotTribMun; 2 (MEI) = somente indTotTrib="0"; 3 (ME/EPP) = somente pTotTribSN. ' +
'Os campos vTotTrib* existem no layout, mas a matriz atual os rejeita.');

const comercioExterior = object({
  mdPrestacao: code(domains.MD_PRESTACAO, 'Modo de prestacao.'),
  vincPrest: code(domains.VINC_PREST, 'Vinculo entre as partes.'),
  tpMoeda: DIGITS(3, 'Codigo da moeda da transacao (tabela de moedas do BACEN), ex.: 220 = dolar americano.'),
  vServMoeda: DECIMAL('Valor em moeda estrangeira; padrao: emissao.valores.vServMoeda.'),
  mecAFComexP: code(domains.MEC_AF_COMEX_P, 'Mecanismo de apoio ao comercio exterior do prestador; 01 = nenhum.'),
  mecAFComexT: code(domains.MEC_AF_COMEX_T, 'Mecanismo de apoio ao comercio exterior do tomador; 01 = nenhum.'),
  movTempBens: code(domains.MOV_TEMP_BENS, 'Vinculo com movimentacao temporaria de bens.'),
  mdic: code(domains.MDIC, 'Compartilhar a NFS-e com a Secretaria de Comercio Exterior.'),
} satisfies PropertiesOf<ComExt, 'cPaisResult'>,
['mdPrestacao', 'vincPrest', 'tpMoeda', 'mecAFComexP', 'mecAFComexT', 'movTempBens', 'mdic'],
'Comercio exterior. Presenca deste bloco classifica a nota como exportacao.');

const obra = object({
  inscImobFisc: TEXT('Inscricao imobiliaria fiscal.', 30),
  cObra: TEXT('Codigo da obra (CNO/CEI).', 30),
} satisfies PropertiesOf<Obra, 'cCM'>, ['cObra'], 'Obra de construcao civil.');

const servicoOverride = object({
  xDescServ: X_DESC_SERV,
  cLocPrestacao: C_LOC_PRESTACAO,
  cNBS: C_NBS,
} satisfies PropertiesOf<NonNullable<DpsJsonInput['servico']>>, [], 'Sobrescreve campos do servico padrao nesta nota.');

const emissao = object({
  nDPS: { type: 'string', pattern: '^[1-9]\\d{0,14}$', description: 'Numero da DPS, 1 a 15 digitos sem zero a esquerda. Unico por prestador e serie; nunca reutilize.' },
  serie: { type: 'string', pattern: '^\\d{1,5}$', description: 'Sobrescreve prestador.serie nesta nota.' },
  dhEmi: {
    type: 'string',
    pattern: '^20\\d{2}-\\d{2}-\\d{2}T(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:[+-](?:0\\d|1[01]):00|\\+12:00)$',
    description: 'Data/hora de emissao com offset, ex.: 2026-06-15T10:30:00-03:00. Padrao: agora.',
  },
  dCompet: { type: 'string', pattern: '^20\\d{2}-\\d{2}-\\d{2}$', description: 'Data de competencia YYYY-MM-DD. Padrao: data de emissao.' },
  valores,
  servico: servicoOverride,
  tomador,
  intermediario,
  tributacaoMunicipal,
  tributacaoFederal,
  comercioExterior,
  obra,
  totTrib,
} satisfies PropertiesOf<DpsJsonInput, 'vServ' | 'vServMoeda' | 'cotacao' | 'xDescServ' | 'comExt' | 'tribNac' | 'evento'>,
['nDPS', 'valores', 'tributacaoMunicipal', 'totTrib'], 'Dados especificos desta nota.');

export const DPS_JSON_REQUEST_SCHEMA: JsonSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'DpsJsonRequest',
  ...object({
    ambiente: {
      type: 'string',
      enum: ['restrita', 'producao'],
      description: 'Ambiente SEFIN. restrita = homologacao (padrao); producao gera nota fiscal valida.',
    },
    prestador,
    servico,
    emissao,
  } satisfies PropertiesOf<DpsJsonRequest>, ['prestador', 'servico', 'emissao'],
  'Requisicao declarativa de DPS (NFS-e Nacional, layout 1.01). Valores numericos fiscais sao strings para preservar zeros a esquerda. ' +
  'Nota nacional: sem comercioExterior; tomador com CPF/CNPJ e endNac. Exportacao: comercioExterior, valores.vServMoeda/cotacao, ' +
  'tributacaoMunicipal.tribISSQN=3 com cPaisResult, tomador com NIF/cNaoNIF e endExt. ' +
  'O schema nao verifica regras entre campos; valide com validateDpsJsonRequest antes de emitir.'),
};
