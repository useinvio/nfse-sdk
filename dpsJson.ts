import { DEFAULT_AMBIENTE, TP_AMB } from './config.js';
import { validateDpsJsonRequest } from './fiscalValidation.js';
import { el, textEl, requiredTextEl, pad, nowOffset } from './xmlBuild.js';
import type { Ambiente } from './config.js';

const NS = 'http://www.sped.fazenda.gov.br/nfse';
const VERSAO = '1.01';
const VER_APLIC = 'UseInvio';

export interface PrestadorProfile {
  cnpj: string;
  /** tpInsc: 1 = CPF, 2 = CNPJ */
  tpInsc?: '1' | '2' | string;
  cLocEmi: string;
  serie: string;
  opSimpNac: string;
  regApTribSN?: string;
  regEspTrib: string;
}

export interface ServicoProfile {
  cTribNac: string;
  xDescServ: string;
  cLocPrestacao: string;
  cNBS?: string;
}

export interface ComExt {
  mdPrestacao: string;
  vincPrest: string;
  tpMoeda: string;
  vServMoeda: string;
  mecAFComexP: string;
  mecAFComexT: string;
  movTempBens: string;
  mdic: string;
  cPaisResult?: string;
}

export interface EnderecoNacional {
  cMun: string;
  CEP: string;
}

export interface EnderecoExterior {
  cPais: string;
  cEndPost: string;
  xCidade: string;
  xEstProvReg: string;
}

export interface Endereco {
  endNac?: EnderecoNacional;
  endExt?: EnderecoExterior;
  xLgr: string;
  nro: string;
  xCpl?: string;
  xBairro: string;
}

export interface Tomador {
  CNPJ?: string;
  CPF?: string;
  NIF?: string;
  cNaoNIF?: string;
  xNome?: string;
  end?: Endereco;
  fone?: string;
  email?: string;
}

export interface Intermediario {
  CNPJ?: string;
  CPF?: string;
  xNome?: string;
}

export interface TribMun {
  tribISSQN?: string;
  cPaisResult?: string;
  tpRetISSQN?: string;
  pAliq?: string;
  tpImunidade?: string;
}

export interface TribFed {
  piscofins?: {
    CST: string;
    vBCPisCofins?: string;
    pAliqPis?: string;
    pAliqCofins?: string;
    vPis?: string;
    vCofins?: string;
    tpRetPisCofins?: string;
  };
  vRetCP?: string;
  vRetIRRF?: string;
  vRetCSLL?: string;
}

export interface TribNac {
  IBS?: {
    CST: string;
    vBC?: string;
    pAliqEstado?: string;
    pAliqMunicipio?: string;
    vIBSEstado?: string;
    vIBSMunicipio?: string;
  };
  CBS?: {
    CST: string;
    vBC?: string;
    pAliq?: string;
    vCBS?: string;
  };
}

export interface TotTrib {
  vTotTribFed?: string;
  vTotTribEst?: string;
  vTotTribMun?: string;
  pTotTribFed?: string;
  pTotTribEst?: string;
  pTotTribMun?: string;
  pTotTribSN?: string;
  indTotTrib?: string;
}

export interface Obra {
  cObra?: string;
  inscImobFisc?: string;
  cCM?: string;
}

export interface EventoServico {
  xDesc?: string;
  dtEvento?: string;
}

export interface Valores {
  vServ?: string;
  vServMoeda?: string;
  cotacao?: number;
  vDesc?: string;
  vDedRed?: string;
}

export interface DpsJsonInput {
  nDPS: string;
  serie?: string;
  dhEmi?: string;
  dCompet?: string;
  valores?: Valores;
  vServMoeda?: string;
  vServ?: string;
  cotacao?: number;
  servico?: {
    xDescServ?: string;
    cLocPrestacao?: string;
    cNBS?: string;
  };
  tomador?: Tomador;
  intermediario?: Intermediario;
  tributacaoMunicipal?: TribMun;
  tributacaoFederal?: TribFed;
  tribNac?: TribNac;
  comercioExterior?: Partial<ComExt>;
  comExt?: Partial<ComExt>;
  obra?: Obra;
  evento?: EventoServico;
  totTrib?: TotTrib;
  xDescServ?: string;
}

export interface DpsJsonRequest {
  ambiente?: Ambiente;
  prestador: PrestadorProfile;
  servico: ServicoProfile;
  emissao: DpsJsonInput;
}

export interface BuiltDps {
  id: string;
  xml: string;
}

function normalizeRequest(input: DpsJsonRequest | string): DpsJsonRequest {
  const parsed = typeof input === 'string' ? JSON.parse(input) : input;
  if (!parsed?.prestador) throw new Error('JSON da DPS deve informar prestador');
  if (!parsed?.servico) throw new Error('JSON da DPS deve informar servico');
  if (!parsed?.emissao) throw new Error('JSON da DPS deve informar emissao');
  return parsed;
}

function roundMoney(value: string | number): string {
  return Number(value).toFixed(2);
}

function roundRate(value: string | number): string {
  return Number(value).toFixed(2);
}

function roundTaxBurdenRate(value: string | number): string {
  return Number(value).toFixed(2);
}

function mulDecimal(a: string, b: number): string {
  const scale = 1_000_000;
  const result = (Math.round(Number(a) * scale) * Math.round(b * scale)) / (scale * scale);
  return result.toFixed(2);
}

function resolveVServ(input: DpsJsonInput): string {
  const values = input.valores;
  const vServ = values?.vServ ?? input.vServ;
  if (vServ) return roundMoney(vServ);

  const vServMoeda = values?.vServMoeda ?? input.vServMoeda;
  const cotacao = values?.cotacao ?? input.cotacao;
  if (!vServMoeda || !cotacao) {
    throw new Error('Informe valores.vServ ou (valores.vServMoeda + valores.cotacao) no JSON da DPS.');
  }
  return mulDecimal(vServMoeda, cotacao);
}

function resolveVServMoeda(input: DpsJsonInput): string {
  return input.valores?.vServMoeda ?? input.vServMoeda ?? '0.00';
}

export function buildDpsId(prestador: PrestadorProfile, nDPS: string, serie = prestador.serie): string {
  const cnpjDigits = prestador.cnpj.replace(/\D/g, '');
  const tpInsc = cnpjDigits.length === 14 ? '2' : (prestador.tpInsc ?? '1');
  const id =
    'DPS' +
    pad(prestador.cLocEmi, 7) +
    tpInsc +
    pad(cnpjDigits, 14) +
    pad(serie, 5) +
    pad(nDPS, 15);

  if (id.length !== 45) {
    throw new Error(`Id da DPS com tamanho invalido (${id.length}, esperado 45): ${id}`);
  }
  return id;
}

function buildEndereco(end: Endereco): string {
  if (!end.endNac && !end.endExt) {
    throw new Error('tomador.end deve informar endNac ou endExt');
  }
  if (end.endNac && end.endExt) {
    throw new Error('tomador.end deve informar apenas um de: endNac, endExt');
  }

  const local = end.endNac
    ? el('endNac', requiredTextEl('cMun', end.endNac.cMun) + requiredTextEl('CEP', end.endNac.CEP))
    : el(
        'endExt',
        requiredTextEl('cPais', end.endExt!.cPais) +
          requiredTextEl('cEndPost', end.endExt!.cEndPost) +
          requiredTextEl('xCidade', end.endExt!.xCidade) +
          requiredTextEl('xEstProvReg', end.endExt!.xEstProvReg),
      );

  return el(
    'end',
    [
      local,
      requiredTextEl('xLgr', end.xLgr),
      requiredTextEl('nro', end.nro),
      textEl('xCpl', end.xCpl),
      requiredTextEl('xBairro', end.xBairro),
    ].join(''),
  );
}

function buildTomador(tomador: Tomador): string {
  const endereco = tomador.end ? buildEndereco(tomador.end) : '';

  return el(
    'toma',
    [
      textEl('CNPJ', tomador.CNPJ),
      textEl('CPF', tomador.CPF),
      textEl('NIF', tomador.NIF),
      textEl('cNaoNIF', tomador.cNaoNIF),
      textEl('xNome', tomador.xNome),
      endereco,
      textEl('fone', tomador.fone),
      textEl('email', tomador.email),
    ].join(''),
  );
}

function buildIntermediario(intermediario: Intermediario): string {
  return el(
    'interm',
    [textEl('CNPJ', intermediario.CNPJ), textEl('CPF', intermediario.CPF), textEl('xNome', intermediario.xNome)].join(''),
  );
}

function buildTribMun(trib: TribMun): string {
  const tribISSQN = trib.tribISSQN;

  let discriminator = '';
  if (tribISSQN === '3') {
    discriminator = requiredTextEl('cPaisResult', trib.cPaisResult);
  } else if (tribISSQN === '2') {
    discriminator = requiredTextEl('tpImunidade', trib.tpImunidade);
  }

  return el(
    'tribMun',
    [
      requiredTextEl('tribISSQN', tribISSQN),
      discriminator,
      requiredTextEl('tpRetISSQN', trib.tpRetISSQN),
      textEl('pAliq', trib.pAliq ? roundRate(trib.pAliq) : undefined),
    ].join(''),
  );
}

function buildTribFed(trib: TribFed): string {
  const piscofins = trib.piscofins
    ? el(
        'piscofins',
        [
          requiredTextEl('CST', trib.piscofins.CST),
          textEl('vBCPisCofins', trib.piscofins.vBCPisCofins ? roundMoney(trib.piscofins.vBCPisCofins) : undefined),
          textEl('pAliqPis', trib.piscofins.pAliqPis ? roundRate(trib.piscofins.pAliqPis) : undefined),
          textEl('pAliqCofins', trib.piscofins.pAliqCofins ? roundRate(trib.piscofins.pAliqCofins) : undefined),
          textEl('vPis', trib.piscofins.vPis ? roundMoney(trib.piscofins.vPis) : undefined),
          textEl('vCofins', trib.piscofins.vCofins ? roundMoney(trib.piscofins.vCofins) : undefined),
          textEl('tpRetPisCofins', trib.piscofins.tpRetPisCofins),
        ].join(''),
      )
    : '';

  return el(
    'tribFed',
    [
      piscofins,
      textEl('vRetCP', trib.vRetCP ? roundMoney(trib.vRetCP) : undefined),
      textEl('vRetIRRF', trib.vRetIRRF ? roundMoney(trib.vRetIRRF) : undefined),
      textEl('vRetCSLL', trib.vRetCSLL ? roundMoney(trib.vRetCSLL) : undefined),
    ].join(''),
  );
}

function buildTotTrib(tot: TotTrib, opSimpNac: string): string {
  const hasVTotTrib = tot.vTotTribFed !== undefined || tot.vTotTribEst !== undefined || tot.vTotTribMun !== undefined;
  const hasPTotTrib = tot.pTotTribFed !== undefined || tot.pTotTribEst !== undefined || tot.pTotTribMun !== undefined;
  const hasIndTotTrib = tot.indTotTrib !== undefined;
  const hasPTotTribSN = tot.pTotTribSN !== undefined;
  const branchCount = [hasVTotTrib, hasPTotTrib, hasIndTotTrib, hasPTotTribSN].filter(Boolean).length;

  if (branchCount === 0) {
    throw new Error(`Campo obrigatorio ausente: totTrib (${opSimpNac})`);
  }
  if (branchCount > 1) {
    throw new Error(
      'emissao.totTrib e um xs:choice na SEFIN: informe exatamente um de vTotTrib(Fed/Est/Mun), pTotTrib(Fed/Est/Mun), indTotTrib ou pTotTribSN',
    );
  }

  if (hasVTotTrib) {
    return el(
      'totTrib',
      el(
        'vTotTrib',
        requiredTextEl('vTotTribFed', tot.vTotTribFed !== undefined ? roundMoney(tot.vTotTribFed) : undefined) +
          requiredTextEl('vTotTribEst', tot.vTotTribEst !== undefined ? roundMoney(tot.vTotTribEst) : undefined) +
          requiredTextEl('vTotTribMun', tot.vTotTribMun !== undefined ? roundMoney(tot.vTotTribMun) : undefined),
      ),
    );
  }

  if (hasPTotTrib) {
    return el(
      'totTrib',
      el(
        'pTotTrib',
        requiredTextEl('pTotTribFed', tot.pTotTribFed !== undefined ? roundTaxBurdenRate(tot.pTotTribFed) : undefined) +
          requiredTextEl('pTotTribEst', tot.pTotTribEst !== undefined ? roundTaxBurdenRate(tot.pTotTribEst) : undefined) +
          requiredTextEl('pTotTribMun', tot.pTotTribMun !== undefined ? roundTaxBurdenRate(tot.pTotTribMun) : undefined),
      ),
    );
  }

  if (hasIndTotTrib) {
    return el('totTrib', requiredTextEl('indTotTrib', tot.indTotTrib));
  }

  return el('totTrib', requiredTextEl('pTotTribSN', tot.pTotTribSN !== undefined ? roundTaxBurdenRate(tot.pTotTribSN) : undefined));
}

function buildComExt(input: DpsJsonInput, comExt: Partial<ComExt>): string {
  return el(
    'comExt',
    [
      textEl('mdPrestacao', comExt.mdPrestacao),
      textEl('vincPrest', comExt.vincPrest),
      textEl('tpMoeda', comExt.tpMoeda),
      requiredTextEl('vServMoeda', comExt.vServMoeda ?? resolveVServMoeda(input)),
      textEl('mecAFComexP', comExt.mecAFComexP),
      textEl('mecAFComexT', comExt.mecAFComexT),
      textEl('movTempBens', comExt.movTempBens),
      textEl('mdic', comExt.mdic),
    ].join(''),
  );
}

export function buildDpsFromJson(input: DpsJsonRequest | string): BuiltDps {
  const request = normalizeRequest(input);
  validateDpsJsonRequest(request);
  const ambiente = request.ambiente ?? DEFAULT_AMBIENTE;
  const { prestador, servico } = request;
  const emissao = request.emissao;
  const serie = emissao.serie ?? prestador.serie;
  const id = buildDpsId(prestador, emissao.nDPS, serie);
  const dhEmi = emissao.dhEmi ?? nowOffset();
  const dCompet = emissao.dCompet ?? dhEmi.slice(0, 10);
  const serviceOverride = emissao.servico;
  const comExt = emissao.comercioExterior ?? emissao.comExt;
  const vServ = resolveVServ(emissao);

  const prest = el(
    'prest',
    requiredTextEl('CNPJ', prestador.cnpj) +
      el(
        'regTrib',
        requiredTextEl('opSimpNac', prestador.opSimpNac) +
          textEl('regApTribSN', prestador.regApTribSN) +
          requiredTextEl('regEspTrib', prestador.regEspTrib),
      ),
  );

  const cServ = el(
    'cServ',
    [
      requiredTextEl('cTribNac', servico.cTribNac),
      requiredTextEl('xDescServ', serviceOverride?.xDescServ ?? emissao.xDescServ ?? servico.xDescServ),
      textEl('cNBS', serviceOverride?.cNBS ?? servico.cNBS),
    ].join(''),
  );

  const serv = el(
    'serv',
    [
      el('locPrest', requiredTextEl('cLocPrestacao', serviceOverride?.cLocPrestacao ?? servico.cLocPrestacao)),
      cServ,
      comExt ? buildComExt(emissao, comExt) : '',
      emissao.obra ? el('obra', textEl('cObra', emissao.obra.cObra) + textEl('inscImobFisc', emissao.obra.inscImobFisc) + textEl('cCM', emissao.obra.cCM)) : '',
      emissao.evento ? el('atvEvento', textEl('xDesc', emissao.evento.xDesc) + textEl('dtEvento', emissao.evento.dtEvento)) : '',
    ].join(''),
  );

  const vServPrest = el(
    'vServPrest',
    requiredTextEl('vServ', vServ) +
      textEl('vDesc', emissao.valores?.vDesc ? roundMoney(emissao.valores.vDesc) : undefined) +
      textEl('vDedRed', emissao.valores?.vDedRed ? roundMoney(emissao.valores.vDedRed) : undefined),
  );

  const trib = el(
    'trib',
    [
      buildTribMun(emissao.tributacaoMunicipal ?? {}),
      emissao.tributacaoFederal ? buildTribFed(emissao.tributacaoFederal) : '',
      buildTotTrib(emissao.totTrib ?? {}, prestador.opSimpNac),
    ].join(''),
  );

  const infDps = el(
    'infDPS',
    [
      requiredTextEl('tpAmb', TP_AMB[ambiente]),
      requiredTextEl('dhEmi', dhEmi),
      requiredTextEl('verAplic', VER_APLIC),
      requiredTextEl('serie', serie),
      requiredTextEl('nDPS', emissao.nDPS),
      requiredTextEl('dCompet', dCompet),
      requiredTextEl('tpEmit', '1'),
      requiredTextEl('cLocEmi', prestador.cLocEmi),
      prest,
      emissao.tomador ? buildTomador(emissao.tomador) : '',
      emissao.intermediario ? buildIntermediario(emissao.intermediario) : '',
      serv,
      el('valores', vServPrest + trib),
    ].join(''),
    { Id: id },
  );

  return {
    id,
    xml: el('DPS', infDps, { versao: VERSAO, xmlns: NS }),
  };
}
