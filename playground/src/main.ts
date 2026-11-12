/**
 * Browser playground: edit a DpsJsonRequest and see validation issues and the
 * generated DPS XML live. Bundled by scripts/build-playground.mjs into a single
 * self-contained HTML file. Nothing leaves the browser.
 */
import { examplePayload } from '../../cliExample.js';
import { buildDpsFromJson, type DpsJsonRequest } from '../../dpsJson.js';
import { validateDpsJsonRequest, type DpsValidationIssue } from '../../fiscalValidation.js';
import { explicarRejeicao, listarRejeicoes } from '../../rejeicoes.js';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const editor = $<HTMLTextAreaElement>('editor');
const statusEl = $('status');
const issuesEl = $('issues');
const xmlEl = $('xml');
const codeInput = $<HTMLInputElement>('code');
const explainEl = $('explanation');

const STORAGE_KEY = 'nfse-playground-request';

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function prettyXml(xml: string): string {
  let depth = 0;
  return xml
    .replace(/>\s*</g, '>\n<')
    .split('\n')
    .map((line) => {
      if (/^<\//.test(line)) depth = Math.max(0, depth - 1);
      const out = `${'  '.repeat(depth)}${line}`;
      if (/^<[^!?/][^>]*[^/]>$/.test(line) && !/<\/[^>]+>$/.test(line)) depth += 1;
      return out;
    })
    .join('\n');
}

function renderIssues(issues: DpsValidationIssue[], warnings: DpsValidationIssue[]): void {
  const items = [
    ...issues.map((issue) => ({ issue, kind: 'error' as const })),
    ...warnings.map((issue) => ({ issue, kind: 'warning' as const })),
  ];
  if (!items.length) {
    issuesEl.innerHTML = '<p class="empty">Nenhum problema. A DPS está pronta para assinar e enviar.</p>';
    return;
  }
  issuesEl.innerHTML = items
    .map(({ issue, kind }) => `
      <li class="issue ${kind}">
        <span class="badge">${kind === 'error' ? 'Erro' : 'Aviso'}</span>
        <code class="path">${escapeHtml(issue.path)}</code>
        <p>${escapeHtml(issue.message)}</p>
        ${issue.suggestion ? `<p class="hint">${escapeHtml(issue.suggestion)}</p>` : ''}
      </li>`)
    .join('');
}

function setStatus(kind: 'ok' | 'error' | 'warning', text: string): void {
  statusEl.className = `status ${kind}`;
  statusEl.title = '';
  statusEl.textContent = text;
}

function update(): void {
  const text = editor.value;
  try {
    localStorage.setItem(STORAGE_KEY, text);
  } catch {
    // Storage may be unavailable (private mode); the playground still works.
  }
  let request: DpsJsonRequest;
  try {
    request = JSON.parse(text);
  } catch (error) {
    setStatus('error', 'JSON inválido');
    issuesEl.innerHTML = `<li class="issue error"><span class="badge">Erro</span><p>${escapeHtml(error instanceof Error ? error.message : String(error))}</p></li>`;
    xmlEl.textContent = '';
    return;
  }
  const report = validateDpsJsonRequest(request);
  renderIssues(report.issues, report.warnings);
  if (!report.valid) {
    setStatus('error', `${report.issues.length} problema${report.issues.length === 1 ? '' : 's'}`);
    xmlEl.textContent = 'Corrija os problemas para gerar o XML.';
    return;
  }
  try {
    const { id, xml } = buildDpsFromJson(request);
    xmlEl.textContent = prettyXml(xml);
    setStatus(report.warnings.length ? 'warning' : 'ok', report.warnings.length ? `DPS válida, ${report.warnings.length} aviso(s)` : 'DPS válida');
    statusEl.title = id;
  } catch (error) {
    setStatus('error', 'Falha ao gerar XML');
    xmlEl.textContent = error instanceof Error ? error.message : String(error);
  }
}

function explain(): void {
  const code = codeInput.value.trim();
  if (!code) {
    explainEl.innerHTML = '';
    return;
  }
  const e = explicarRejeicao(code);
  if (!e.conhecida) {
    explainEl.innerHTML = `<p class="empty">${escapeHtml(e.codigo)} não está no catálogo oficial.</p>`;
    return;
  }
  explainEl.innerHTML = `
    <h3>${escapeHtml(e.codigo)}</h3>
    <p>${escapeHtml(e.mensagemOficial ?? '')}</p>
    ${e.regra && e.regra !== e.mensagemOficial ? `<p class="hint">${escapeHtml(e.regra)}</p>` : ''}
    ${e.campo ? `<p><span class="label">Campo</span> <code>${escapeHtml(e.campo)}</code></p>` : ''}
    ${e.dica ? `<p class="hint">${escapeHtml(e.dica)}</p>` : ''}
    ${e.fonte ? `<p class="source">Fonte: <a href="${escapeHtml(e.fonte.url)}" rel="noopener">${escapeHtml(e.fonte.documento)}</a></p>` : ''}`;
}

function selectTab(name: string): void {
  for (const tab of document.querySelectorAll<HTMLButtonElement>('[role="tab"]')) {
    const selected = tab.dataset.tab === name;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    $(`panel-${tab.dataset.tab}`).hidden = !selected;
  }
}

function resetExample(): void {
  const { ambiente: _ambiente, ...payload } = examplePayload();
  editor.value = JSON.stringify({ ambiente: 'restrita', ...payload }, null, 2);
  update();
}

let timer: ReturnType<typeof setTimeout> | undefined;
editor.addEventListener('input', () => {
  clearTimeout(timer);
  timer = setTimeout(update, 200);
});
editor.addEventListener('keydown', (event) => {
  if (event.key !== 'Tab') return;
  event.preventDefault();
  const { selectionStart, selectionEnd, value } = editor;
  editor.value = `${value.slice(0, selectionStart)}  ${value.slice(selectionEnd)}`;
  editor.selectionStart = editor.selectionEnd = selectionStart + 2;
});
$('reset').addEventListener('click', resetExample);
$('copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(xmlEl.textContent ?? '');
    $('copy').textContent = 'Copiado';
    setTimeout(() => ($('copy').textContent = 'Copiar XML'), 1500);
  } catch {
    $('copy').textContent = 'Selecione e copie';
  }
});
codeInput.addEventListener('input', explain);
for (const tab of document.querySelectorAll<HTMLButtonElement>('[role="tab"]')) {
  tab.addEventListener('click', () => selectTab(tab.dataset.tab!));
}
$('code-count').textContent = String(listarRejeicoes().length);

let saved: string | null = null;
try {
  saved = localStorage.getItem(STORAGE_KEY);
} catch {
  saved = null;
}
if (saved) {
  editor.value = saved;
  update();
} else {
  resetExample();
}
selectTab('issues');
