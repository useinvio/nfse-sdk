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

/** The pedRegEvento XML violates the NFS-e v1.01 event XSD. */
export class PedRegEventoXsdValidationError extends Error {
  constructor(public readonly details: string[]) {
    super(`XML do pedido de registro de evento invalido para o XSD v1.01: ${details.join('; ')}`);
    this.name = 'PedRegEventoXsdValidationError';
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
 * @deprecated Since 3.2.0 the SDK no longer runs the `xmllint` binary.
 * Kept as an alias so existing `instanceof XmllintUnavailableError` checks still work.
 */
export const XmllintUnavailableError = XsdEngineUnavailableError;
/** @deprecated Use {@link XsdEngineUnavailableError}. */
export type XmllintUnavailableError = XsdEngineUnavailableError;

/** Virtual URL scheme for the bundled schemas, so includes never touch disk or network. */
const SCHEMA_URL_PREFIX = 'nfse-sdk-xsd://v1.01/';
const DPS_SCHEMA = 'DPS_v1.01.xsd';
const PED_REG_EVENTO_SCHEMA = 'pedRegEvento_v1.01.xsd';

/** Never load DTDs, external entities or network resources while parsing. */
export const SAFE_PARSE_OPTIONS = ParseOption.XML_PARSE_NONET | ParseOption.XML_PARSE_NO_XXE;

const compiledValidators = new Map<string, XsdValidator>();
let schemaBuffers: Record<string, Uint8Array> | undefined;

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

/** Compiles each official entry schema once per process; later calls reuse the validator. */
function getValidator(entrySchema: string): XsdValidator {
  const cached = compiledValidators.get(entrySchema);
  if (cached) return cached;
  let schemaDoc: XmlDocument | undefined;
  try {
    if (!schemaBuffers) {
      schemaBuffers = loadSchemaBuffers();
      xmlRegisterInputProvider(new XmlBufferInputProvider(schemaBuffers));
    }
    const entry = schemaBuffers[`${SCHEMA_URL_PREFIX}${entrySchema}`];
    if (!entry) throw new Error(`${entrySchema} nao encontrado em ${schemaSourceDir()}`);
    schemaDoc = XmlDocument.fromBuffer(entry, { url: `${SCHEMA_URL_PREFIX}${entrySchema}`, option: SAFE_PARSE_OPTIONS });
    const validator = XsdValidator.fromDoc(schemaDoc);
    compiledValidators.set(entrySchema, validator);
    return validator;
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
  validateAgainst(DPS_SCHEMA, xml, (details) => new DpsXsdValidationError(details));
}

/** Validates a pedRegEvento (cancellation, substitution, ...) against the official v1.01 event schema. */
export function validatePedRegEventoXmlAgainstXsd(xml: string): void {
  validateAgainst(PED_REG_EVENTO_SCHEMA, xml, (details) => new PedRegEventoXsdValidationError(details));
}

function validateAgainst(entrySchema: string, xml: string, payloadError: (details: string[]) => Error): void {
  const validator = getValidator(entrySchema);
  let doc: XmlDocument | undefined;
  try {
    doc = XmlDocument.fromString(xml, { option: SAFE_PARSE_OPTIONS });
    validator.validate(doc);
  } catch (error) {
    if (error instanceof XmlValidateError || error instanceof XmlParseError) {
      throw payloadError(detailsOf(error));
    }
    throw new XsdEngineUnavailableError(
      `Falha no motor de validacao XSD: ${error instanceof Error ? error.message : String(error)}`,
      error,
    );
  } finally {
    doc?.dispose();
  }
}
