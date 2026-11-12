import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const BIN = resolve('dist/cliBin.js');

function nfse(args: string[], cwd: string, env: Record<string, string> = {}) {
  const result = spawnSync(process.execPath, [BIN, ...args], {
    cwd,
    env: { PATH: process.env.PATH ?? '', NO_COLOR: '1', ...env },
    encoding: 'utf8',
    input: '',
  });
  return { code: result.status, out: result.stdout, err: result.stderr };
}

function workspace(t: test.TestContext): string {
  const dir = mkdtempSync(join(tmpdir(), 'nfse-cli-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('init, validate and a mock emission work end to end', (t) => {
  const dir = workspace(t);
  assert.equal(nfse(['init'], dir).code, 0);
  assert.ok(existsSync(join(dir, 'nota.json')));
  assert.equal(nfse(['init'], dir).code, 1, 'init never overwrites');

  const validated = nfse(['validate', 'nota.json', '--json'], dir);
  assert.equal(validated.code, 0, validated.err);
  assert.equal(JSON.parse(validated.out).valid, true);

  const emitted = nfse(['emit', 'nota.json', '--mock', '--yes', '--json', '-o', 'nfse.xml'], dir);
  assert.equal(emitted.code, 0, emitted.err);
  assert.match(JSON.parse(emitted.out).chaveAcesso, /^\d{50}$/);
  assert.match(readFileSync(join(dir, 'nfse.xml'), 'utf8'), /<NFSe /);
});

test('emit refuses to send without confirmation when there is no terminal', (t) => {
  const dir = workspace(t);
  nfse(['init'], dir);
  const result = nfse(['emit', 'nota.json', '--mock'], dir);
  assert.equal(result.code, 1);
  assert.match(result.err, /--yes/);
  assert.doesNotMatch(result.out, /emitida/);
});

test('validation errors, environment conflicts and unsafe flags fail with exit 1', (t) => {
  const dir = workspace(t);
  writeFileSync(join(dir, 'ruim.json'), JSON.stringify({ prestador: { cnpj: '123' }, servico: {}, emissao: {} }));
  const invalid = nfse(['validate', 'ruim.json'], dir);
  assert.equal(invalid.code, 1);
  assert.match(invalid.out, /✖/);

  writeFileSync(join(dir, 'prod.json'), JSON.stringify({ ambiente: 'producao', prestador: {}, servico: {}, emissao: {} }));
  assert.match(nfse(['validate', 'prod.json'], dir).err, /--producao/);
  assert.equal(nfse(['emit', 'nota.json', '--mock', '--producao'], dir).code, 1);
  assert.equal(nfse(['naoexiste'], dir).code, 1);
});

test('explain, cert and doctor report without a real certificate', (t) => {
  const dir = workspace(t);
  const explained = JSON.parse(nfse(['explain', 'E0014', 'E9999', '--json'], dir).out);
  assert.equal(explained[0].conhecida, true);
  assert.equal(explained[1].conhecida, false);

  const cert = JSON.parse(nfse(['cert', '--mock', '--json'], dir).out);
  assert.equal(cert.cnpj, '12345678000195');
  assert.doesNotMatch(JSON.stringify(cert), /PRIVATE KEY/);

  const doctor = nfse(['doctor'], dir);
  assert.equal(doctor.code, 0);
  assert.match(doctor.out, /Certificado não configurado/);
  const broken = nfse(['doctor'], dir, { NFSE_CERT_PATH: join(dir, 'missing.pfx'), NFSE_CERT_PASSWORD: 'x' });
  assert.equal(broken.code, 1);

  assert.match(nfse(['--version'], dir).out.trim(), /^\d+\.\d+\.\d+$/);
});
