import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import { buildDpsFromJson, NfseClient, validateDpsXmlAgainstXsd, type CreateInvoiceInput, type DpsJsonRequest, type NfseClientDpsDefaults, type PfxMaterial } from '../index.js';

// Read data literals only; never execute documentation snippets or send invoices.
function literal(node: ts.Node): unknown {
  if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) return literal(node.expression);
  if (ts.isStringLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  assert.ok(ts.isObjectLiteralExpression(node), `Expected a data literal: ${node.getText()}`);
  return Object.fromEntries(node.properties.map(property => {
    assert.ok(ts.isPropertyAssignment(property));
    const name = property.name;
    assert.ok(ts.isIdentifier(name) || ts.isStringLiteral(name));
    return [name.text, literal(property.initializer)];
  }));
}

for (const file of ['README.md', 'ENGLISH.md']) test(`${file} invoice examples generate valid DPS XML`, () => {
  const text = readFileSync(file, 'utf8');
  const snippets = Array.from(text.matchAll(/```ts\n([\s\S]*?)```/g), match => match[1]);
  let defaults: NfseClientDpsDefaults = {};
  let count = 0;
  function check(request: DpsJsonRequest) {
    validateDpsXmlAgainstXsd(buildDpsFromJson(request).xml);
    count++;
  }
  for (const snippet of snippets) {
    const source = ts.createSourceFile(file + '.ts', snippet, ts.ScriptTarget.Latest, true);
    function visit(node: ts.Node) {
      if (ts.isVariableDeclaration(node) && node.initializer && ts.isObjectLiteralExpression(node.initializer)) {
        const names = node.initializer.properties.map(p => p.name?.getText());
        if (['prestador', 'servico', 'emissao'].every(key => names.includes(key))) check(literal(node.initializer) as DpsJsonRequest);
      }
      if (ts.isNewExpression(node) && node.expression.getText() === 'NfseClient') {
        const options = node.arguments?.[0];
        assert.ok(options && ts.isObjectLiteralExpression(options));
        const property = options.properties.find(p => p.name?.getText() === 'defaults');
        assert.ok(property && ts.isPropertyAssignment(property));
        defaults = literal(property.initializer) as NfseClientDpsDefaults;
      }
      if (ts.isCallExpression(node) && ['client.invoices.create', 'client.invoices.buildDpsJson'].includes(node.expression.getText())) {
        const pfx: PfxMaterial = { privateKeyPem: '', certPem: '', certDerBase64: '', pfxBuffer: Buffer.alloc(0) };
        const client = new NfseClient({ certificate: pfx, defaults });
        check(client.invoices.buildDpsJson(literal(node.arguments[0]) as CreateInvoiceInput));
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  assert.equal(count, 4, 'Two full JSON examples and two client examples must be checked');
});
