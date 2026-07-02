import type { DpsJsonInput, DpsJsonRequest, PrestadorProfile, ServicoProfile, TribMun } from './dpsJson.js';

const OP_SIMP_NAC = new Set(['1', '2', '3']);
const REG_AP_TRIB_SN = new Set(['1', '2', '3']);
const REG_ESP_TRIB = new Set(['0', '1', '2', '3', '4', '5', '6', '9']);
const TRIB_ISSQN = new Set(['1', '2', '3', '4']);
const TP_IMUNIDADE = new Set(['0', '1', '2', '3', '4', '5']);
const TP_RET_ISSQN = new Set(['1', '2', '3']);
const PIS_COFINS_CST = new Set([
  '00',
  '01',
  '02',
  '03',
  '04',
  '05',
  '06',
  '07',
  '08',
  '09',
  '49',
  '50',
  '51',
  '52',
  '53',
  '54',
  '55',
  '56',
  '60',
  '61',
  '62',
  '63',
  '64',
  '65',
  '66',
  '67',
  '70',
  '71',
  '72',
  '73',
  '74',
  '75',
  '98',
  '99',
]);

export class DpsFiscalValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`JSON da DPS invalido: ${issues.join('; ')}`);
    this.name = 'DpsFiscalValidationError';
  }
}

function issue(issues: string[], message: string): void {
  issues.push(message);
}

function assertPattern(issues: string[], field: string, value: string | undefined, pattern: RegExp, example: string): void {
  if (value === undefined || value === '') {
    issue(issues, `${field} e obrigatorio`);
    return;
  }
  if (!pattern.test(value)) {
    issue(issues, `${field} deve seguir ${example}`);
  }
}

function assertEnum(issues: string[], field: string, value: string | undefined, allowed: Set<string>): void {
  if (value === undefined || value === '') {
    issue(issues, `${field} e obrigatorio`);
    return;
  }
  if (!allowed.has(value)) {
    issue(issues, `${field} deve ser um de: ${Array.from(allowed).join(', ')}`);
  }
}

function assertDecimal(issues: string[], field: string, value: string | number | undefined): void {
  if (value === undefined || value === '') return;
  if (!Number.isFinite(Number(value))) {
    issue(issues, `${field} deve ser numerico`);
  }
}

function validatePrestador(issues: string[], prestador: PrestadorProfile): void {
  assertPattern(issues, 'prestador.cnpj', prestador.cnpj, /^\d{14}$/, '14 digitos numericos');
  assertPattern(issues, 'prestador.cLocEmi', prestador.cLocEmi, /^\d{7}$/, 'codigo IBGE com 7 digitos');
  assertPattern(issues, 'prestador.serie', prestador.serie, /^\d{1,5}$/, 'serie numerica com ate 5 digitos');
  assertEnum(issues, 'prestador.opSimpNac', prestador.opSimpNac, OP_SIMP_NAC);
  assertEnum(issues, 'prestador.regEspTrib', prestador.regEspTrib, REG_ESP_TRIB);

  if (prestador.regApTribSN !== undefined) {
    assertEnum(issues, 'prestador.regApTribSN', prestador.regApTribSN, REG_AP_TRIB_SN);
    if (prestador.opSimpNac !== '3') {
      issue(issues, 'prestador.regApTribSN so deve ser informado quando prestador.opSimpNac = 3');
    }
  }
}

function validateServico(issues: string[], servico: ServicoProfile, emissao: DpsJsonInput): void {
  assertPattern(issues, 'servico.cTribNac', servico.cTribNac, /^\d{6}$/, '6 digitos numericos');
  assertPattern(
    issues,
    'servico.cLocPrestacao',
    emissao.servico?.cLocPrestacao ?? servico.cLocPrestacao,
    /^\d{7}$/,
    'codigo IBGE com 7 digitos',
  );

  const cNBS = emissao.servico?.cNBS ?? servico.cNBS;
  if (cNBS !== undefined) {
    assertPattern(issues, 'servico.cNBS', cNBS, /^\d{9}$/, '9 digitos numericos');
  }
}

function validatePessoa(
  issues: string[],
  field: string,
  pessoa: { CNPJ?: string; CPF?: string; NIF?: string; cNaoNIF?: string; xNome?: string } | undefined,
): void {
  if (!pessoa) return;
  const ids = [pessoa.CNPJ, pessoa.CPF, pessoa.NIF, pessoa.cNaoNIF].filter((value) => value !== undefined && value !== '');
  if (ids.length !== 1) {
    issue(issues, `${field} deve informar exatamente um identificador: CNPJ, CPF, NIF ou cNaoNIF`);
  }
  if (!pessoa.xNome) {
    issue(issues, `${field}.xNome e obrigatorio quando ${field} for informado`);
  }
}

function validateTribMun(issues: string[], trib: TribMun | undefined, opSimpNac: string): void {
  if (!trib) {
    issue(issues, 'emissao.tributacaoMunicipal e obrigatorio; a SDK nao assume tribISSQN/tpRetISSQN por default');
    return;
  }

  assertEnum(issues, 'emissao.tributacaoMunicipal.tribISSQN', trib.tribISSQN, TRIB_ISSQN);
  assertEnum(issues, 'emissao.tributacaoMunicipal.tpRetISSQN', trib.tpRetISSQN, TP_RET_ISSQN);

  if (trib.tribISSQN === '2') {
    assertEnum(issues, 'emissao.tributacaoMunicipal.tpImunidade', trib.tpImunidade, TP_IMUNIDADE);
  } else if (trib.tpImunidade !== undefined) {
    issue(issues, 'emissao.tributacaoMunicipal.tpImunidade so deve ser informado quando tribISSQN = 2');
  }

  if (trib.tribISSQN === '3') {
    assertPattern(issues, 'emissao.tributacaoMunicipal.cPaisResult', trib.cPaisResult, /^[A-Z]{2}$/, 'ISO-3166 alpha-2');
  } else if (trib.cPaisResult !== undefined) {
    issue(issues, 'emissao.tributacaoMunicipal.cPaisResult so deve ser informado quando tribISSQN = 3');
  }

  if (opSimpNac === '1' && trib.pAliq !== undefined) {
    issue(issues, 'emissao.tributacaoMunicipal.pAliq nao deve ser informado quando prestador.opSimpNac = 1');
  }

  assertDecimal(issues, 'emissao.tributacaoMunicipal.pAliq', trib.pAliq);
  if (trib.pAliq !== undefined && Number.isFinite(Number(trib.pAliq)) && Number(trib.pAliq) > 9.99) {
    issue(issues, 'emissao.tributacaoMunicipal.pAliq deve ser <= 9.99 (TSDec1V2: um digito inteiro, duas casas decimais)');
  }

  const legacyFields = trib as Record<string, unknown>;
  if (legacyFields.vBC !== undefined || legacyFields.vISSQN !== undefined) {
    issue(
      issues,
      'emissao.tributacaoMunicipal.vBC/vISSQN nao existem no layout v1.01; a SEFIN calcula a base e o valor do ISSQN',
    );
  }
}

function validateTotTrib(issues: string[], emissao: DpsJsonInput, opSimpNac: string): void {
  const tot = emissao.totTrib;
  if (!tot) {
    issue(issues, 'emissao.totTrib e obrigatorio; informe vTotTrib(Fed/Est/Mun), pTotTrib(Fed/Est/Mun), pTotTribSN ou indTotTrib=0');
    return;
  }

  const hasVTotTrib = tot.vTotTribFed !== undefined || tot.vTotTribEst !== undefined || tot.vTotTribMun !== undefined;
  const hasPTotTrib = tot.pTotTribFed !== undefined || tot.pTotTribEst !== undefined || tot.pTotTribMun !== undefined;
  const hasIndTotTrib = tot.indTotTrib !== undefined;
  const hasPTotTribSN = tot.pTotTribSN !== undefined;
  const branchCount = [hasVTotTrib, hasPTotTrib, hasIndTotTrib, hasPTotTribSN].filter(Boolean).length;

  if (branchCount === 0) {
    issue(issues, 'emissao.totTrib deve informar vTotTrib(Fed/Est/Mun), pTotTrib(Fed/Est/Mun), pTotTribSN ou indTotTrib=0');
  } else if (branchCount > 1) {
    issue(
      issues,
      'emissao.totTrib e um xs:choice na SEFIN: informe exatamente um de vTotTrib(Fed/Est/Mun), pTotTrib(Fed/Est/Mun), indTotTrib ou pTotTribSN',
    );
  }

  if (opSimpNac === '1' && tot.pTotTribSN !== undefined) {
    issue(issues, 'emissao.totTrib.pTotTribSN nao deve ser informado para prestador.opSimpNac = 1');
  }

  assertDecimal(issues, 'emissao.totTrib.vTotTribFed', tot.vTotTribFed);
  assertDecimal(issues, 'emissao.totTrib.vTotTribEst', tot.vTotTribEst);
  assertDecimal(issues, 'emissao.totTrib.vTotTribMun', tot.vTotTribMun);
  assertDecimal(issues, 'emissao.totTrib.pTotTribFed', tot.pTotTribFed);
  assertDecimal(issues, 'emissao.totTrib.pTotTribEst', tot.pTotTribEst);
  assertDecimal(issues, 'emissao.totTrib.pTotTribMun', tot.pTotTribMun);
  assertDecimal(issues, 'emissao.totTrib.pTotTribSN', tot.pTotTribSN);
}

function validateUnsupportedShapes(issues: string[], emissao: DpsJsonInput): void {
  if (emissao.tribNac) {
    issue(issues, 'emissao.tribNac ainda nao e suportado; IBS/CBS no layout v1.01 exige o bloco RTC IBSCBS oficial');
  }
  if (emissao.evento) {
    issue(issues, 'emissao.evento ainda nao e suportado; o layout v1.01 exige xNome, dtIni, dtFim e id/endereco');
  }
  if (emissao.obra?.cCM) {
    issue(issues, 'emissao.obra.cCM nao existe no layout v1.01; use cObra/inscImobFisc ou aguarde suporte a cCIB/endereco');
  }
  if (emissao.valores?.vDesc !== undefined || emissao.valores?.vDedRed !== undefined) {
    issue(issues, 'emissao.valores.vDesc/vDedRed ainda nao sao suportados no shape correto do layout v1.01');
  }
}

function validateComercioExterior(issues: string[], emissao: DpsJsonInput): void {
  const comExt = emissao.comercioExterior ?? emissao.comExt;
  if (!comExt) return;

  for (const field of ['mdPrestacao', 'vincPrest', 'tpMoeda', 'mecAFComexP', 'mecAFComexT', 'movTempBens', 'mdic'] as const) {
    if (!comExt[field]) issue(issues, `emissao.comercioExterior.${field} e obrigatorio quando comercioExterior for informado`);
  }
  assertDecimal(issues, 'emissao.comercioExterior.vServMoeda', comExt.vServMoeda ?? emissao.valores?.vServMoeda ?? emissao.vServMoeda);
}

function validateTribFed(issues: string[], emissao: DpsJsonInput): void {
  const piscofins = emissao.tributacaoFederal?.piscofins;
  if (!piscofins) return;
  assertEnum(issues, 'emissao.tributacaoFederal.piscofins.CST', piscofins.CST, PIS_COFINS_CST);
  assertDecimal(issues, 'emissao.tributacaoFederal.piscofins.vBCPisCofins', piscofins.vBCPisCofins);
  assertDecimal(issues, 'emissao.tributacaoFederal.piscofins.pAliqPis', piscofins.pAliqPis);
  assertDecimal(issues, 'emissao.tributacaoFederal.piscofins.pAliqCofins', piscofins.pAliqCofins);
  assertDecimal(issues, 'emissao.tributacaoFederal.piscofins.vPis', piscofins.vPis);
  assertDecimal(issues, 'emissao.tributacaoFederal.piscofins.vCofins', piscofins.vCofins);
}

export function validateDpsJsonRequest(request: DpsJsonRequest): void {
  const issues: string[] = [];
  validatePrestador(issues, request.prestador);
  validateServico(issues, request.servico, request.emissao);
  assertPattern(issues, 'emissao.nDPS', request.emissao.nDPS, /^[1-9][0-9]{0,14}$/, '1 a 15 digitos, sem zero inicial');
  if (request.emissao.serie !== undefined) {
    assertPattern(issues, 'emissao.serie', request.emissao.serie, /^\d{1,5}$/, 'serie numerica com ate 5 digitos');
  }
  assertDecimal(issues, 'emissao.valores.vServ', request.emissao.valores?.vServ ?? request.emissao.vServ);
  assertDecimal(issues, 'emissao.valores.vServMoeda', request.emissao.valores?.vServMoeda ?? request.emissao.vServMoeda);
  assertDecimal(issues, 'emissao.valores.cotacao', request.emissao.valores?.cotacao ?? request.emissao.cotacao);
  validatePessoa(issues, 'emissao.tomador', request.emissao.tomador);
  validatePessoa(issues, 'emissao.intermediario', request.emissao.intermediario);
  validateTribMun(issues, request.emissao.tributacaoMunicipal, request.prestador.opSimpNac);
  validateTribFed(issues, request.emissao);
  validateTotTrib(issues, request.emissao, request.prestador.opSimpNac);
  validateComercioExterior(issues, request.emissao);
  validateUnsupportedShapes(issues, request.emissao);

  if (issues.length > 0) {
    throw new DpsFiscalValidationError(issues);
  }
}
