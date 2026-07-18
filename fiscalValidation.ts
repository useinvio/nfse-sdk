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
  constructor(
    public readonly issues: string[],
    public readonly report?: DpsValidationReport,
  ) {
    super(`JSON da DPS invalido: ${issues.join('; ')}`);
    this.name = 'DpsFiscalValidationError';
  }
}

export const DPS_SCHEMA_VERSION = '1.01';

export type ValidationSeverity = 'error' | 'warning';
export type ValidationSource = 'sdk' | 'invio';

export interface DpsValidationIssue {
  code: string;
  path: string;
  severity: ValidationSeverity;
  source: ValidationSource;
  message: string;
  suggestion?: string;
}

export interface DpsValidationReport<T = unknown> {
  valid: boolean;
  schemaVersion: typeof DPS_SCHEMA_VERSION;
  issues: DpsValidationIssue[];
  warnings: DpsValidationIssue[];
  normalizedPayload: T;
}

const ISSUE_OVERRIDES: Array<{
  test: RegExp;
  code: string;
  path: string;
  message?: string;
  suggestion?: string;
}> = [
  {
    test: /tributacaoMunicipal(?:\.tribISSQN)? e obrigatorio/,
    code: 'TRIB_ISSQN_REQUIRED',
    path: 'tributacaoMunicipal.tribISSQN',
    message: 'A tributação municipal é obrigatória.',
    suggestion: 'Informe o tratamento do ISSQN.',
  },
  {
    test: /tributacaoMunicipal\.tpRetISSQN e obrigatorio/,
    code: 'TRIB_ISSQN_WITHHOLDING_REQUIRED',
    path: 'tributacaoMunicipal.tpRetISSQN',
    suggestion: 'Informe o tratamento da retencao do ISSQN.',
  },
  {
    test: /tributacaoMunicipal\.cPaisResult e obrigatorio/,
    code: 'TRIB_COUNTRY_RESULT_REQUIRED',
    path: 'tributacaoMunicipal.cPaisResult',
  },
  {
    test: /tributacaoMunicipal\.tpImunidade e obrigatorio/,
    code: 'TRIB_IMMUNITY_TYPE_REQUIRED',
    path: 'tributacaoMunicipal.tpImunidade',
  },
  {
    test: /totTrib e obrigatorio|totTrib deve informar/,
    code: 'TOT_TRIB_REQUIRED',
    path: 'totTrib',
    suggestion: 'Informe uma unica modalidade de carga tributaria aproximada.',
  },
  {
    test: /totTrib e um xs:choice/,
    code: 'TOT_TRIB_CHOICE_CONFLICT',
    path: 'totTrib',
    suggestion: 'Mantenha somente uma modalidade de carga tributaria aproximada.',
  },
];

function inferredPath(message: string): string {
  const match = message.match(/(?:emissao\.)?([A-Za-z][\w]*(?:\.[A-Za-z][\w]*)*)/);
  return (match?.[1] ?? '$').replace(/^emissao\./, '');
}

function inferredCode(message: string, path: string): string {
  const suffix = /obrigatorio|ausente/.test(message)
    ? 'REQUIRED'
    : /deve ser um de/.test(message)
      ? 'INVALID_ENUM'
      : /deve seguir/.test(message)
        ? 'INVALID_FORMAT'
        : /numerico/.test(message)
          ? 'INVALID_NUMBER'
          : 'INVALID_COMBINATION';
  return `${path.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/[^A-Za-z0-9]+/g, '_').toUpperCase()}_${suffix}`;
}

export function validationIssueFromMessage(message: string): DpsValidationIssue {
  const normalized = message.replace(/^emissao\./, '');
  const override = ISSUE_OVERRIDES.find(({ test }) => test.test(normalized));
  const path = override?.path ?? inferredPath(normalized);
  return {
    code: override?.code ?? inferredCode(normalized, path),
    path,
    severity: 'error',
    source: 'sdk',
    message: override?.message ?? normalized,
    ...(override?.suggestion ? { suggestion: override.suggestion } : {}),
  };
}

/** Non-throwing validation entry point shared by APIs and workers. */
export function validateDpsJson<T extends DpsJsonRequest>(request: T): DpsValidationReport<T> {
  try {
    validateDpsJsonRequest(request);
    return {
      valid: true,
      schemaVersion: DPS_SCHEMA_VERSION,
      issues: [],
      warnings: [],
      normalizedPayload: request,
    };
  } catch (error) {
    if (!(error instanceof DpsFiscalValidationError)) throw error;
    const issues = error.issues.map(validationIssueFromMessage);
    return {
      valid: false,
      schemaVersion: DPS_SCHEMA_VERSION,
      issues,
      warnings: [],
      normalizedPayload: request,
    };
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
  if (!(emissao.servico?.xDescServ ?? emissao.xDescServ ?? servico.xDescServ)?.trim()) {
    issue(issues, 'servico.xDescServ e obrigatorio');
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
  if (pessoa.CNPJ !== undefined && !/^\d{14}$/.test(pessoa.CNPJ)) issue(issues, `${field}.CNPJ deve seguir 14 digitos numericos`);
  if (pessoa.CPF !== undefined && !/^\d{11}$/.test(pessoa.CPF)) issue(issues, `${field}.CPF deve seguir 11 digitos numericos`);

  const endereco = 'end' in pessoa ? pessoa.end as {
    endNac?: { cMun?: string; CEP?: string };
    endExt?: { cPais?: string; cEndPost?: string; xCidade?: string; xEstProvReg?: string };
    xLgr?: string;
    nro?: string;
    xBairro?: string;
  } | undefined : undefined;
  if (endereco) {
    if (Boolean(endereco.endNac) === Boolean(endereco.endExt)) {
      issue(issues, `${field}.end deve informar exatamente um de endNac ou endExt`);
    }
    if (endereco.endNac) {
      assertPattern(issues, `${field}.end.endNac.cMun`, endereco.endNac.cMun, /^\d{7}$/, 'codigo IBGE com 7 digitos');
      assertPattern(issues, `${field}.end.endNac.CEP`, endereco.endNac.CEP, /^\d{8}$/, '8 digitos numericos');
    }
    if (endereco.endExt) {
      assertPattern(issues, `${field}.end.endExt.cPais`, endereco.endExt.cPais, /^[A-Z]{2}$/, 'ISO-3166 alpha-2');
      for (const key of ['cEndPost', 'xCidade', 'xEstProvReg'] as const) {
        if (!endereco.endExt[key]) issue(issues, `${field}.end.endExt.${key} e obrigatorio`);
      }
    }
    for (const key of ['xLgr', 'nro', 'xBairro'] as const) {
      if (!endereco[key]) issue(issues, `${field}.end.${key} e obrigatorio`);
    }
  }
}

function validateDates(issues: string[], emissao: DpsJsonInput): void {
  if (emissao.dhEmi !== undefined && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?[+-]\d{2}:\d{2}$/.test(emissao.dhEmi)) {
    issue(issues, 'emissao.dhEmi deve seguir YYYY-MM-DDThh:mm:ss-03:00');
  }
  if (emissao.dCompet !== undefined) {
    const parts = emissao.dCompet.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const parsed = parts ? new Date(Date.UTC(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]))) : null;
    if (!parts || !parsed || parsed.getUTCFullYear() !== Number(parts[1]) || parsed.getUTCMonth() !== Number(parts[2]) - 1 || parsed.getUTCDate() !== Number(parts[3])) {
      issue(issues, 'emissao.dCompet deve ser uma data valida no formato YYYY-MM-DD');
    }
  }
}

function validateValores(issues: string[], emissao: DpsJsonInput): void {
  const vServ = emissao.valores?.vServ ?? emissao.vServ;
  const vServMoeda = emissao.valores?.vServMoeda ?? emissao.vServMoeda;
  const cotacao = emissao.valores?.cotacao ?? emissao.cotacao;
  if (vServ === undefined && (vServMoeda === undefined || cotacao === undefined)) {
    issue(issues, 'emissao.valores.vServ e obrigatorio, ou informe valores.vServMoeda e valores.cotacao');
  }
  for (const [path, value] of [
    ['emissao.valores.vServ', vServ],
    ['emissao.valores.vServMoeda', vServMoeda],
    ['emissao.valores.cotacao', cotacao],
  ] as const) {
    assertDecimal(issues, path, value);
    if (value !== undefined && Number.isFinite(Number(value)) && Number(value) <= 0) issue(issues, `${path} deve ser maior que zero`);
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

  if (hasVTotTrib && [tot.vTotTribFed, tot.vTotTribEst, tot.vTotTribMun].some((value) => value === undefined)) {
    issue(issues, 'emissao.totTrib.vTotTrib deve informar Fed, Est e Mun');
  }
  if (hasPTotTrib && [tot.pTotTribFed, tot.pTotTribEst, tot.pTotTribMun].some((value) => value === undefined)) {
    issue(issues, 'emissao.totTrib.pTotTrib deve informar Fed, Est e Mun');
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
  if (request.ambiente !== undefined && request.ambiente !== 'restrita' && request.ambiente !== 'producao') {
    issue(issues, 'ambiente deve ser restrita ou producao');
  }
  validatePrestador(issues, request.prestador);
  validateServico(issues, request.servico, request.emissao);
  assertPattern(issues, 'emissao.nDPS', request.emissao.nDPS, /^[1-9][0-9]{0,14}$/, '1 a 15 digitos, sem zero inicial');
  if (request.emissao.serie !== undefined) {
    assertPattern(issues, 'emissao.serie', request.emissao.serie, /^\d{1,5}$/, 'serie numerica com ate 5 digitos');
  }
  validateDates(issues, request.emissao);
  validateValores(issues, request.emissao);
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
