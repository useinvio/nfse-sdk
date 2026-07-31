import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The DPS XML violates the NFS-e v1.01 XSD. This is a fiscal payload problem. */
export class DpsXsdValidationError extends Error {
  constructor(public readonly details: string[]) {
    super(`XML da DPS invalido para o XSD v1.01: ${details.join('; ')}`);
    this.name = 'DpsXsdValidationError';
  }
}

/**
 * `xmllint` could not be run to completion (missing binary, spawn failure, or
 * an unexpected crash without stderr). This is an infrastructure problem, not
 * proof that the XML is fiscally invalid, and callers must not treat it as a
 * permanent rejection.
 */
export class XmllintUnavailableError extends Error {
  constructor(
    message: string,
    public readonly cause: unknown,
  ) {
    super(message);
    this.name = 'XmllintUnavailableError';
  }
}

interface ExecFileSyncFailure {
  message?: string;
  code?: string;
  path?: string;
  spawnargs?: string[];
  stdout?: Buffer | string | null;
  stderr?: Buffer | string | null;
}

function isExecFileSyncFailure(error: unknown): error is ExecFileSyncFailure {
  return typeof error === 'object' && error !== null;
}

function toText(value: Buffer | string | null | undefined): string {
  if (value === null || value === undefined) return '';
  return Buffer.isBuffer(value) ? value.toString('utf8') : String(value);
}

function describeSpawnFailure(error: ExecFileSyncFailure): string {
  const parts: string[] = [];
  if (error.message) parts.push(error.message);
  if (error.code) parts.push(`code=${error.code}`);
  if (error.path) parts.push(`path=${error.path}`);
  if (error.spawnargs?.length) parts.push(`spawnargs=${error.spawnargs.join(' ')}`);
  const stdout = toText(error.stdout).trim();
  if (stdout) parts.push(`stdout=${stdout}`);
  const stderr = toText(error.stderr).trim();
  if (stderr) parts.push(`stderr=${stderr}`);
  return parts.length ? parts.join(' | ') : 'Falha desconhecida ao executar xmllint.';
}

function schemaSourceDir(): string {
  return fileURLToPath(new URL('../schemas/nfse/v1.01/Schemas/1.01/', import.meta.url));
}

/** Validates a generated DPS against the official v1.01 schema before signing. */
export function validateDpsXmlAgainstXsd(xml: string): void {
  const workDir = mkdtempSync(join(tmpdir(), 'nfse-sdk-xsd-'));
  const schemasDir = join(workDir, 'schemas');
  try {
    cpSync(schemaSourceDir(), schemasDir, { recursive: true });

    // libxml2 treats ^/$ literally in XSD regexes. The official package ships
    // one JavaScript-style anchor, so normalize that expression in our copy.
    const simpleTypesPath = join(schemasDir, 'tiposSimples_v1.01.xsd');
    const simpleTypes = readFileSync(simpleTypesPath, 'utf8').replace(
      '<xs:pattern value="^0{0,4}\\d{1,5}$"/>',
      '<xs:pattern value="0{0,4}\\d{1,5}"/>',
    );
    writeFileSync(simpleTypesPath, simpleTypes);

    const xmlPath = join(workDir, 'dps.xml');
    writeFileSync(xmlPath, xml);
    try {
      execFileSync('xmllint', ['--noout', '--schema', join(schemasDir, 'DPS_v1.01.xsd'), xmlPath], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      if (!isExecFileSyncFailure(error)) {
        throw new XmllintUnavailableError(`Falha ao executar xmllint: ${String(error)}`, error);
      }

      if (error.code === 'ENOENT') {
        throw new XmllintUnavailableError(
          `xmllint nao encontrado no ambiente de execucao (path=${error.path ?? 'xmllint'}). ` +
            'Instale o pacote libxml2/xmllint antes de validar o XSD.',
          error,
        );
      }

      const stderrText = toText(error.stderr).trim();
      if (stderrText) {
        const details = stderrText.split('\n').map((line) => line.trim()).filter(Boolean);
        throw new DpsXsdValidationError(details.length ? details : [stderrText]);
      }

      // xmllint failed but produced no stderr: do not mask this as an XML
      // schema violation, since we have no evidence about the XML content.
      throw new XmllintUnavailableError(`xmllint falhou sem stderr: ${describeSpawnFailure(error)}`, error);
    }
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}
