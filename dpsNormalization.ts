import type { DpsJsonInput, DpsJsonRequest, Valores } from './dpsJson.js';

export function resolveValores(input: DpsJsonInput): Valores {
  return {
    ...input.valores,
    vServ: input.valores?.vServ ?? input.vServ,
    vServMoeda: input.valores?.vServMoeda ?? input.vServMoeda,
    cotacao: input.valores?.cotacao ?? input.cotacao,
  };
}

/** Called only after the structural check. Retains legacy fields for compatibility. */
export function normalizeDpsRequest<T extends DpsJsonRequest>(request: T): T {
  const copy = clonePayload(request);
  copy.emissao.valores = resolveValores(copy.emissao);
  copy.emissao.comercioExterior = copy.emissao.comercioExterior ?? copy.emissao.comExt;
  return copy;
}

/** Copy JSON-like data without throwing on extra non-JSON properties. */
export function clonePayload<T>(value: T, seen = new WeakMap<object, unknown>()): T {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return seen.get(value) as T;
  const copy: Record<string, unknown> | unknown[] = Array.isArray(value) ? [] : {};
  seen.set(value, copy);
  for (const [key, item] of Object.entries(value)) {
    Object.defineProperty(copy, key, { value: clonePayload(item, seen), enumerable: true, writable: true, configurable: true });
  }
  return copy as T;
}

type Shape = 'string' | 'number' | { [key: string]: Shape };
const fields = (...names: string[]): Record<string, Shape> => Object.fromEntries(names.map((name) => [name, 'string']));
const endereco: Shape = {
  ...fields('xLgr', 'nro', 'xCpl', 'xBairro'),
  endNac: fields('cMun', 'CEP'),
  endExt: fields('cPais', 'cEndPost', 'xCidade', 'xEstProvReg'),
};
const pessoa: Shape = { ...fields('CNPJ', 'CPF', 'NIF', 'cNaoNIF', 'xNome', 'fone', 'email'), end: endereco };
const comExt = fields('mdPrestacao', 'vincPrest', 'tpMoeda', 'vServMoeda', 'mecAFComexP', 'mecAFComexT', 'movTempBens', 'mdic', 'cPaisResult');
const shape: Shape = {
  ambiente: 'string',
  prestador: fields('cnpj', 'cpf', 'tpInsc', 'cLocEmi', 'serie', 'opSimpNac', 'regApTribSN', 'regEspTrib'),
  servico: fields('cTribNac', 'xDescServ', 'cLocPrestacao', 'cNBS'),
  emissao: {
    ...fields('nDPS', 'serie', 'dhEmi', 'dCompet', 'vServ', 'vServMoeda', 'xDescServ'),
    cotacao: 'number',
    valores: { ...fields('vServ', 'vServMoeda', 'vDesc', 'vDedRed'), cotacao: 'number' },
    servico: fields('xDescServ', 'cLocPrestacao', 'cNBS'),
    tomador: pessoa, intermediario: pessoa,
    tributacaoMunicipal: fields('tribISSQN', 'cPaisResult', 'tpRetISSQN', 'pAliq', 'tpImunidade', 'vBC', 'vISSQN'),
    tributacaoFederal: {
      ...fields('vRetCP', 'vRetIRRF', 'vRetCSLL'),
      piscofins: fields('CST', 'vBCPisCofins', 'pAliqPis', 'pAliqCofins', 'vPis', 'vCofins', 'tpRetPisCofins'),
    },
    totTrib: fields('vTotTribFed', 'vTotTribEst', 'vTotTribMun', 'pTotTribFed', 'pTotTribEst', 'pTotTribMun', 'pTotTribSN', 'indTotTrib'),
    comercioExterior: comExt, comExt,
    obra: fields('cObra', 'inscImobFisc', 'cCM'),
    evento: {}, tribNac: {},
  },
};

export function structuralIssues(value: unknown): Array<{ path: string; message: string }> {
  const issues: Array<{ path: string; message: string }> = [];
  function walk(item: unknown, spec: Shape, path: string): void {
    const fail = (message: string) => issues.push({ path: path.replace(/^emissao\./, ''), message: `${path} ${message}` });
    if (typeof spec === 'string') {
      if (typeof item !== spec || (spec === 'number' && !Number.isFinite(item))) fail(`deve ser ${spec}`);
      else if (typeof item === 'string' && !item.trim()) fail('nao pode ser vazio');
      return;
    }
    if (!item || typeof item !== 'object' || Array.isArray(item)) { fail('deve ser um objeto'); return; }
    const record = item as Record<string, unknown>;
    for (const [key, child] of Object.entries(spec)) {
      if (record[key] !== undefined) walk(record[key], child, path === '$' ? key : `${path}.${key}`);
      else if (path === '$' && ['prestador', 'servico', 'emissao'].includes(key)) {
        issues.push({ path: key, message: `${key} e obrigatorio` });
      }
    }
  }
  walk(value, shape, '$');
  return issues;
}
