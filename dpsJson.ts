import { DEFAULT_AMBIENTE, TP_AMB } from './config.js';
import type { Ambiente } from './config.js';

const NS = 'http://www.sped.fazenda.gov.br/nfse';
const VERSAO = '1.01';
const VER_APLIC = '@nfse-tools/nfse-sdk';

export interface PrestadorProfile {
  cnpj: string;
  /** tpInsc: 1 = CPF, 2 = CNPJ */
  tpInsc?: '1' | '2' | string;
  cLocEmi: string;
  serie: string;
  opSimpNac: string;
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

export interface Tomador {
  CNPJ?: string;
  CPF?: string;
  NIF?: string;
  cNaoNIF?: string;
  xNome?: string;
  end?: Record<string, string>;
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
  vISSQN?: string;
  vBC?: string;
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
  pTotTribFed?: string;
  pTotTribEst?: string;
  pTotTribMun?: string;
  vTotTrib?: string;
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

function escapeXml(value: string | number): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(value: string | number): string {
  return escapeXml(value).replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function attrs(values: Record<string, string>): string {
  return Object.entries(values)
    .map(([key, value]) => ` ${key}="${escapeAttr(value)}"`)
    .join('');
}

function el(name: string, content: string, attrValues: Record<string, string> = {}): string {
  return `<${name}${attrs(attrValues)}>${content}</${name}>`;
}

function textEl(name: string, value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === '') return '';
  return el(name, escapeXml(value));
}

function requiredTextEl(name: string, value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === '') {
    throw new Error(`Campo obrigatorio ausente: ${name}`);
  }
  return el(name, escapeXml(value));
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

function pad(value: string, length: number): string {
  return onlyDigits(value).padStart(length, '0');
}

function roundMoney(value: string | number): string {
  return Number(value).toFixed(2);
}

function roundRate(value: string | number): string {
  return Number(value).toFixed(4);
}

function roundTaxBurdenRate(value: string | number): string {
  return Number(value).toFixed(2);
}

function mulDecimal(a: string, b: number): string {
  const scale = 1_000_000;
  const result = (Math.round(Number(a) * scale) * Math.round(b * scale)) / (scale * scale);
  return result.toFixed(2);
}

function nowOffset(date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const tz = -date.getTimezoneOffset();
  const sign = tz >= 0 ? '+' : '-';
  const abs = Math.abs(tz);
  const offset = `${sign}${p(Math.floor(abs / 60))}:${p(abs % 60)}`;
  return (
    `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}` +
    `T${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}${offset}`
  );
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
  const id =
    'DPS' +
    pad(prestador.cLocEmi, 7) +
    (prestador.tpInsc ?? '2') +
    pad(prestador.cnpj, 14) +
    pad(serie, 5) +
    pad(nDPS, 15);

  if (id.length !== 45) {
    throw new Error(`Id da DPS com tamanho invalido (${id.length}, esperado 45): ${id}`);
  }
  return id;
}

function buildTomador(tomador: Tomador): string {
  const endereco = tomador.end
    ? el(
        'end',
        Object.entries(tomador.end)
          .map(([key, value]) => textEl(key, value))
          .join(''),
      )
    : '';

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
  return el(
    'tribMun',
    [
      textEl('tribISSQN', trib.tribISSQN),
      textEl('cPaisResult', trib.cPaisResult),
      textEl('tpRetISSQN', trib.tpRetISSQN),
      textEl('vBC', trib.vBC ? roundMoney(trib.vBC) : undefined),
      textEl('pAliq', trib.pAliq ? roundRate(trib.pAliq) : undefined),
      textEl('vISSQN', trib.vISSQN ? roundMoney(trib.vISSQN) : undefined),
      textEl('tpImunidade', trib.tpImunidade),
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

function buildTribNac(trib: TribNac): string {
  const ibs = trib.IBS
    ? el(
        'IBS',
        [
          requiredTextEl('CST', trib.IBS.CST),
          textEl('vBC', trib.IBS.vBC ? roundMoney(trib.IBS.vBC) : undefined),
          textEl('pAliqEstado', trib.IBS.pAliqEstado ? roundRate(trib.IBS.pAliqEstado) : undefined),
          textEl('pAliqMunicipio', trib.IBS.pAliqMunicipio ? roundRate(trib.IBS.pAliqMunicipio) : undefined),
          textEl('vIBSEstado', trib.IBS.vIBSEstado ? roundMoney(trib.IBS.vIBSEstado) : undefined),
          textEl('vIBSMunicipio', trib.IBS.vIBSMunicipio ? roundMoney(trib.IBS.vIBSMunicipio) : undefined),
        ].join(''),
      )
    : '';
  const cbs = trib.CBS
    ? el(
        'CBS',
        [
          requiredTextEl('CST', trib.CBS.CST),
          textEl('vBC', trib.CBS.vBC ? roundMoney(trib.CBS.vBC) : undefined),
          textEl('pAliq', trib.CBS.pAliq ? roundRate(trib.CBS.pAliq) : undefined),
          textEl('vCBS', trib.CBS.vCBS ? roundMoney(trib.CBS.vCBS) : undefined),
        ].join(''),
      )
    : '';
  return el('tribNac', ibs + cbs);
}

function buildTotTrib(tot: TotTrib): string {
  const pTotTrib = el(
    'pTotTrib',
    [
      textEl('pTotTribFed', tot.pTotTribFed !== undefined ? roundTaxBurdenRate(tot.pTotTribFed) : undefined),
      textEl('pTotTribEst', tot.pTotTribEst !== undefined ? roundTaxBurdenRate(tot.pTotTribEst) : undefined),
      textEl('pTotTribMun', tot.pTotTribMun !== undefined ? roundTaxBurdenRate(tot.pTotTribMun) : undefined),
    ].join(''),
  );
  return el('totTrib', pTotTrib + textEl('vTotTrib', tot.vTotTrib !== undefined ? roundMoney(tot.vTotTrib) : undefined));
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
      el('regTrib', requiredTextEl('opSimpNac', prestador.opSimpNac) + requiredTextEl('regEspTrib', prestador.regEspTrib)),
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
      emissao.tribNac ? buildTribNac(emissao.tribNac) : '',
      emissao.totTrib ? buildTotTrib(emissao.totTrib) : '',
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
