import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import test from 'node:test';
import ts from 'typescript';
import * as sdk from '../index.js';
import * as agent from '../agent.js';
import * as mcp from '../mcpServer.js';
import * as testing from '../testing.js';
import { buildDpsFromJson, NfseClient, validateDpsXmlAgainstXsd, type CreateInvoiceInput, type DpsJsonRequest, type NfseClientDpsDefaults, type PfxMaterial } from '../index.js';

const IGNORED_DIRS = new Set(['node_modules', 'dist', 'dist-test', '.git', 'schemas', '.claude']);

function markdownFiles(dir = '.'): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (IGNORED_DIRS.has(name)) return [];
    if (statSync(path).isDirectory()) return markdownFiles(path);
    return name.endsWith('.md') ? [path] : [];
  });
}

const FILES = markdownFiles();

function snippets(text: string): string[] {
  return Array.from(text.matchAll(/```(?:ts|js)\n([\s\S]*?)```/g), (match) => match[1]);
}

// Read data literals only; never execute documentation snippets or send invoices.
function literal(node: ts.Node): unknown {
  if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) return literal(node.expression);
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  assert.ok(ts.isObjectLiteralExpression(node), `Expected a data literal: ${node.getText()}`);
  return Object.fromEntries(node.properties.map((property) => {
    assert.ok(ts.isPropertyAssignment(property));
    const name = property.name;
    assert.ok(ts.isIdentifier(name) || ts.isStringLiteral(name));
    return [name.text, literal(property.initializer)];
  }));
}

test('Markdown invoice examples generate DPS XML that passes the official XSD', () => {
  const checkedPerFile = new Map<string, number>();
  for (const file of FILES) {
    let defaults: NfseClientDpsDefaults = {};
    let count = 0;
    const check = (request: DpsJsonRequest) => {
      validateDpsXmlAgainstXsd(buildDpsFromJson(request).xml);
      count++;
    };
    for (const snippet of snippets(readFileSync(file, 'utf8'))) {
      const source = ts.createSourceFile(`${file}.ts`, snippet, ts.ScriptTarget.Latest, true);
      const visit = (node: ts.Node) => {
        if (ts.isVariableDeclaration(node) && node.initializer && ts.isObjectLiteralExpression(node.initializer)) {
          const names = node.initializer.properties.map((p) => p.name?.getText());
          if (['prestador', 'servico', 'emissao'].every((key) => names.includes(key))) {
            assert.doesNotThrow(() => check(literal(node.initializer!) as DpsJsonRequest), `${file}: ${node.name.getText()}`);
          }
        }
        if (ts.isNewExpression(node) && node.expression.getText() === 'NfseClient') {
          const options = node.arguments?.[0];
          const property = options && ts.isObjectLiteralExpression(options)
            ? options.properties.find((p) => p.name?.getText() === 'defaults')
            : undefined;
          if (property && ts.isPropertyAssignment(property)) defaults = literal(property.initializer) as NfseClientDpsDefaults;
        }
        if (ts.isCallExpression(node) && ['client.invoices.create', 'client.invoices.buildDpsJson'].includes(node.expression.getText())
          && node.arguments[0] && ts.isObjectLiteralExpression(node.arguments[0])) {
          const pfx: PfxMaterial = { privateKeyPem: '', certPem: '', certDerBase64: '', pfxBuffer: Buffer.alloc(0) };
          const client = new NfseClient({ certificate: pfx, defaults });
          check(client.invoices.buildDpsJson(literal(node.arguments[0]) as CreateInvoiceInput));
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
    if (count) checkedPerFile.set(file, count);
  }
  assert.ok(checkedPerFile.get('README.md'), 'README.md must contain a checked invoice example');
  assert.ok(checkedPerFile.get('README.en.md'), 'README.en.md must contain a checked invoice example');
  assert.ok(checkedPerFile.get(join('docs', 'guias', 'emitir.md'))! >= 2, 'the emission guide must check JSON and client examples');
  assert.ok(checkedPerFile.get(join('docs', 'tutoriais', 'primeira-nfse.md')), 'the tutorial payload must be checked');
});

test('Markdown examples only import names the package exports', () => {
  const modules: Record<string, Record<string, unknown>> = {
    '@useinvio/nfse-sdk': sdk,
    '@useinvio/nfse-sdk/agent': agent,
    '@useinvio/nfse-sdk/mcp': mcp,
    '@useinvio/nfse-sdk/testing': testing,
  };
  const missing: string[] = [];
  for (const file of FILES) {
    for (const snippet of snippets(readFileSync(file, 'utf8'))) {
      const source = ts.createSourceFile('snippet.ts', snippet, ts.ScriptTarget.Latest, true);
      for (const statement of source.statements) {
        if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
        const exports = modules[statement.moduleSpecifier.text];
        const bindings = statement.importClause?.namedBindings;
        if (!exports || statement.importClause?.isTypeOnly || !bindings || !ts.isNamedImports(bindings)) continue;
        for (const element of bindings.elements) {
          const name = (element.propertyName ?? element.name).text;
          if (!element.isTypeOnly && !(name in exports)) missing.push(`${file}: ${name}`);
        }
      }
    }
  }
  assert.deepEqual(missing, []);
});

function slug(heading: string): string {
  return heading
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

function anchors(file: string): Set<string> {
  const text = readFileSync(file, 'utf8').replace(/```[\s\S]*?```/g, '');
  const seen = new Map<string, number>();
  const result = new Set<string>();
  for (const [, heading] of text.matchAll(/^#{1,6}\s+(.+)$/gm)) {
    const base = slug(heading);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    result.add(n ? `${base}-${n}` : base);
  }
  return result;
}

test('relative Markdown links point to existing files and headings', () => {
  const broken: string[] = [];
  for (const file of FILES) {
    const text = readFileSync(file, 'utf8').replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
    for (const [, target] of text.matchAll(/\]\(([^)\s]+)\)/g)) {
      if (/^[a-z]+:/i.test(target)) continue;
      const [path, anchor] = target.split('#');
      const resolved = path ? resolve(dirname(file), decodeURIComponent(path)) : resolve(file);
      if (!existsSync(resolved)) {
        broken.push(`${file}: ${target} (missing ${relative('.', resolved)})`);
        continue;
      }
      if (anchor && resolved.endsWith('.md') && !anchors(resolved).has(decodeURIComponent(anchor))) {
        broken.push(`${file}: ${target} (no heading #${anchor})`);
      }
    }
  }
  assert.deepEqual(broken, []);
});

test('README stays short and every guide is reachable from the docs index', () => {
  assert.ok(readFileSync('README.md', 'utf8').split('\n').length <= 160, 'README.md should stay under ~150 lines; move details to docs/');
  const index = readFileSync(join('docs', 'README.md'), 'utf8');
  for (const dir of ['guias', 'referencia', 'tutoriais', 'conceitos']) {
    for (const name of readdirSync(join('docs', dir))) {
      assert.ok(index.includes(`${dir}/${name}`), `docs/README.md must link ${dir}/${name}`);
    }
  }
});
