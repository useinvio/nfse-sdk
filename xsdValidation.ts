import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ParseOption,
  XmlBufferInputProvider,
  XmlDocument,
  XmlLibError,
  XmlParseError,
  XmlValidateError,
  XsdValidator,
  xmlRegisterInputProvider,
} from 'libxml2-wasm';

/** The DPS XML violates the NFS-e v1.01 XSD. This is a fiscal payload problem. */
export class DpsXsdValidationError extends Error {
  constructor(public readonly details: string[]) {
    super(`XML da DPS invalido para o XSD v1.01: ${details.join('; ')}`);
    this.name = 'DpsXsdValidationError';
  }
}

/**
 * The embedded XSD engine (libxml2 compiled to WebAssembly) could not load the
 * official schemas or crashed. This is an infrastructure problem, not proof
 * that the XML is fiscally invalid, and callers must not treat it as a
 * permanent rejection.
 */
export class XsdEngineUnavailableError extends Error {
  constructor(
    message: string,
    public readonly cause: unknown,
  ) {
    super(message);
    this.name = 'XsdEngineUnavailableError';
  }
}

/**
 * @deprecated Since 3.1.0 the SDK no longer runs the `xmllint` binary.
 * Kept as an alias so existing `instanceof XmllintUnavailableError` checks still work.
 */
export const XmllintUnavailableError = XsdEngineUnavailableError;
/** @deprecated Use {@link XsdEngineUnavailableError}. */
export type XmllintUnavailableError = XsdEngineUnavailableError;

/** Virtual URL scheme for the bundled schemas, so includes never touch disk or network. */
const SCHEMA_URL_PREFIX = 'nfse-sdk-xsd://v1.01/';
const ENTRY_SCHEMA = 'DPS_v1.01.xsd';

/** Never load DTDs, external entities or network resources while parsing. */
export const SAFE_PARSE_OPTIONS = ParseOption.XML_PARSE_NONET | ParseOption.XML_PARSE_NO_XXE;

let compiledValidator: XsdValidator | undefined;

function schemaSourceDir(): string {
  return fileURLToPath(new URL('../schemas/nfse/v1.01/Schemas/1.01/', import.meta.url));
}

function loadSchemaBuffers(): Record<string, Uint8Array> {
  const dir = schemaSourceDir();
  const encoder = new TextEncoder();
  const buffers: Record<string, Uint8Array> = {};
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.xsd')) continue;
    let text = readFileSync(join(dir, file), 'utf8');
    if (file === 'tiposSimples_v1.01.xsd') {
      // libxml2 treats ^/$ literally in XSD regexes. The official package ships
      // one JavaScript-style anchor, so normalize that expression in memory.
      text = text.replace('<xs:pattern value="^0{0,4}\\d{1,5}$"/>', '<xs:pattern value="0{0,4}\\d{1,5}"/>');
    }
    buffers[`${SCHEMA_URL_PREFIX}${file}`] = encoder.encode(text);
  }
  return buffers;
}

/** Compiles the official schemas once per process; later calls reuse the validator. */
function getValidator(): XsdValidator {
  if (compiledValidator) return compiledValidator;
  let schemaDoc: XmlDocument | undefined;
  try {
    const buffers = loadSchemaBuffers();
    const entry = buffers[`${SCHEMA_URL_PREFIX}${ENTRY_SCHEMA}`];
    if (!entry) throw new Error(`${ENTRY_SCHEMA} nao encontrado em ${schemaSourceDir()}`);
    xmlRegisterInputProvider(new XmlBufferInputProvider(buffers));
    schemaDoc = XmlDocument.fromBuffer(entry, { url: `${SCHEMA_URL_PREFIX}${ENTRY_SCHEMA}`, option: SAFE_PARSE_OPTIONS });
    compiledValidator = XsdValidator.fromDoc(schemaDoc);
    return compiledValidator;
  } catch (error) {
    throw new XsdEngineUnavailableError(
      `Nao foi possivel carregar os XSD oficiais v1.01: ${error instanceof Error ? error.message : String(error)}`,
      error,
    );
  } finally {
    // The validator keeps its own compiled copy of the schema.
    schemaDoc?.dispose();
  }
}

function detailsOf(error: XmlLibError): string[] {
  const details = error.details.map((detail) => detail.message.trim()).filter(Boolean);
  return details.length ? details : [error.message.trim() || error.name];
}

/**
 * Validates a DPS against the official v1.01 schema before signing.
 * Runs in-process (libxml2 in WebAssembly): no `xmllint`, no temp files, no network.
 */
export function validateDpsXmlAgainstXsd(xml: string): void {
  const validator = getValidator();
  let doc: XmlDocument | undefined;
  try {
    doc = XmlDocument.fromString(xml, { option: SAFE_PARSE_OPTIONS });
    validator.validate(doc);
  } catch (error) {
    if (error instanceof XmlValidateError || error instanceof XmlParseError) {
      throw new DpsXsdValidationError(detailsOf(error));
    }
    throw new XsdEngineUnavailableError(
      `Falha no motor de validacao XSD: ${error instanceof Error ? error.message : String(error)}`,
      error,
    );
  } finally {
    doc?.dispose();
  }
}
