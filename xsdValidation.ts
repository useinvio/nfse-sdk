import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export class DpsXsdValidationError extends Error {
  constructor(public readonly details: string[]) {
    super(`XML da DPS invalido para o XSD v1.01: ${details.join('; ')}`);
    this.name = 'DpsXsdValidationError';
  }
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
      const stderr = error && typeof error === 'object' && 'stderr' in error ? String(error.stderr) : String(error);
      const details = stderr.split('\n').map((line) => line.trim()).filter(Boolean);
      throw new DpsXsdValidationError(details.length ? details : ['Falha desconhecida ao validar o XSD.']);
    }
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}
