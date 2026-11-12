#!/usr/bin/env node
/**
 * Generates docs/rejeicoes/: one page per official SEFIN rejection code plus an
 * index, from the bundled catalog. Run after `npm run build`:
 *
 *   node scripts/build-rejection-pages.mjs
 *
 * Pages only restate the official text. SDK-specific advice is limited to the
 * curated codes below, where the SDK itself has a direct answer.
 */
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REJEICOES_FONTES, REJEICOES_OFICIAIS } from '../dist/rejeicoesCatalog.js';

const OUT = 'docs/rejeicoes';
const NIVEL = {
  1: 'Nível 1: regra de consistência do leiaute.',
  2: 'Nível 2: regra nacional, para todos os municípios do Sistema Nacional NFS-e.',
  3: 'Nível 3: regra municipal, conforme a parametrização do município.',
};

/** Advice grounded in what the SDK does; never a guessed fiscal cause. */
const SDK_NOTES = {
  E0014: 'Essa rejeição aparece quando a mesma DPS (série + número) é enviada de novo. Se você reenviou depois de um timeout, a primeira tentativa pode ter sido autorizada: use `recuperarNfsePorDps(dpsId, certificado)` para obter a nota em vez de criar outra. Veja [Recuperar uma emissão após timeout](../guias/recuperar-emissao.md). Para uma nota nova, incremente `nDPS`.',
  E1235: 'O XML não passou no XSD oficial. Valide localmente antes de enviar com `validateDpsXmlAgainstXsd(xml)` (ou `nfse validate nota.json`): o SDK usa os mesmos schemas v1.01 e mostra a linha e o elemento do problema.',
  E0714: 'A assinatura não confere. Assine com o mesmo certificado usado na conexão mTLS e não altere o XML depois de assinar. `prepararNota` assina e verifica a assinatura antes do envio. Veja [Configurar o certificado A1](../guias/certificado.md).',
  E0006: 'O `tpAmb` da DPS difere do ambiente para onde ela foi enviada. Com JSON, o SDK preenche `tpAmb` a partir de `ambiente`; com XML pronto, `emitirNfse` recusa a divergência antes de enviar. Veja [Ambientes](../referencia/ambientes.md).',
  E1845: 'O `tpAmb` do evento difere do ambiente de envio. Os builders de evento do SDK usam o `ambiente` da chamada; veja [Ambientes](../referencia/ambientes.md).',
  E0840: 'A NFS-e já tem um evento que impede o cancelamento (por exemplo, já foi cancelada). Consulte os eventos com `consultarEventosPorChaveAdn(chave, certificado)` antes de tentar de novo. Veja [Cancelar uma NFS-e](../guias/cancelar.md).',
  E0845: 'A NFS-e já tem um evento que impede o cancelamento por substituição. Consulte os eventos com `consultarEventosPorChaveAdn(chave, certificado)`. Veja [Cancelar uma NFS-e](../guias/cancelar.md).',
};

const oneLine = (text) => text.replace(/\s*\n\s*/g, ' ').trim();
const truncate = (text, max) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);
const escapeCell = (text) => oneLine(text).replace(/\|/g, '\\|');
const quote = (text) => text.split('\n').map((line) => `> ${line}`.trimEnd()).join('\n');

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const codes = [...REJEICOES_OFICIAIS];
codes.forEach((entry, index) => {
  const fonte = REJEICOES_FONTES[entry.fonte];
  const prev = codes[index - 1];
  const next = codes[index + 1];
  const lines = [
    `# ${entry.codigo}: ${truncate(oneLine(entry.mensagem), 90)}`,
    '',
    `Rejeição **${entry.codigo}** da NFS-e Nacional (SEFIN/ADN), com o texto oficial de ${fonte.documento}.`,
    '',
    '## Mensagem oficial',
    '',
    quote(entry.mensagem),
    '',
  ];
  if (entry.regra && oneLine(entry.regra) !== oneLine(entry.mensagem)) {
    lines.push('## Regra de negócio', '', quote(entry.regra), '');
  }
  if (entry.campo || entry.nivel) {
    lines.push('## Onde se aplica', '');
    if (entry.campo) lines.push(`- Campo no XML: \`${entry.campo}\``);
    if (entry.nivel) lines.push(`- ${NIVEL[entry.nivel]}`);
    lines.push(`- Planilha: ${entry.planilha}`, '');
  }
  if (SDK_NOTES[entry.codigo]) lines.push('## Com o @useinvio/nfse-sdk', '', SDK_NOTES[entry.codigo], '');
  lines.push(
    '## Explicar no seu código',
    '',
    '```ts',
    "import { emitirNfse, EmitirNotaError, explicarErros } from '@useinvio/nfse-sdk';",
    '',
    'try {',
    '  await emitirNfse(nota, certificado);',
    '} catch (error) {',
    '  if (error instanceof EmitirNotaError) console.table(explicarErros(error.erros));',
    '}',
    '```',
    '',
    `No terminal: \`npx -p @useinvio/nfse-sdk nfse explain ${entry.codigo}\`. Para agentes de IA, a ferramenta MCP \`explain_rejection\` devolve este mesmo texto.`,
    '',
    '## Fonte',
    '',
    `[${fonte.documento}](${fonte.url}), publicado em gov.br/nfse. O texto acima é o oficial, sem alterações.`,
    '',
    '---',
    '',
    [
      prev ? `[← ${prev.codigo}](${prev.codigo}.md)` : undefined,
      '[Todos os códigos](README.md)',
      next ? `[${next.codigo} →](${next.codigo}.md)` : undefined,
    ].filter(Boolean).join(' · '),
    '',
  );
  writeFileSync(join(OUT, `${entry.codigo}.md`), lines.join('\n'));
});

const bySheet = new Map();
for (const entry of codes) {
  const list = bySheet.get(entry.planilha) ?? [];
  list.push(entry);
  bySheet.set(entry.planilha, list);
}
const SHEET_TITLE = {
  RN_RECEPCAO_DPS: 'Recepção da DPS',
  'RN DPS_NFS-e': 'DPS e NFS-e',
  'RN EVENTO_PED.REG.EVENTO': 'Eventos (cancelamento e outros)',
};
const index = [
  '# Códigos de rejeição da NFS-e Nacional',
  '',
  `Os ${codes.length} códigos de rejeição dos anexos oficiais publicados em gov.br/nfse, um por página,`,
  'com a mensagem, a regra e o campo oficiais. Gerado a partir do catálogo do',
  '[`@useinvio/nfse-sdk`](../../README.md), o mesmo usado por `explicarRejeicao` e pela',
  'ferramenta MCP `explain_rejection`.',
  '',
  'Fontes:',
  '',
  ...REJEICOES_FONTES.map((fonte) => `- [${fonte.documento}](${fonte.url})`),
  '',
];
for (const [sheet, list] of bySheet) {
  index.push(`## ${SHEET_TITLE[sheet] ?? sheet}`, '', '| Código | Mensagem oficial |', '|---|---|');
  for (const entry of list) index.push(`| [${entry.codigo}](${entry.codigo}.md) | ${escapeCell(truncate(oneLine(entry.mensagem), 140))} |`);
  index.push('');
}
writeFileSync(join(OUT, 'README.md'), index.join('\n'));
console.log(`${OUT}: ${readdirSync(OUT).length} files`);
