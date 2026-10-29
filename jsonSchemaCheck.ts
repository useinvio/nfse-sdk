import type { JsonSchema } from './dpsJsonSchema.js';

export interface JsonSchemaViolation {
  /** Dotted path from the root, without a leading `$`; `$` for the root itself. */
  path: string;
  keyword: string;
  message: string;
}

const ANNOTATIONS = new Set(['$schema', 'title', 'description']);
const ASSERTIONS = new Set([
  'type', 'properties', 'required', 'additionalProperties', 'items', 'enum', 'pattern', 'minLength', 'maxLength', 'exclusiveMinimum',
]);

function typeOf(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/**
 * Minimal validator for the keyword subset used by `DPS_JSON_REQUEST_SCHEMA`.
 * It throws on any other keyword so the published schema stays portable.
 */
export function checkJsonSchema(schema: JsonSchema, value: unknown, path = '$'): JsonSchemaViolation[] {
  for (const keyword of Object.keys(schema)) {
    if (!ANNOTATIONS.has(keyword) && !ASSERTIONS.has(keyword)) {
      throw new Error(`Unsupported JSON Schema keyword at ${path}: ${keyword}`);
    }
  }

  const violations: JsonSchemaViolation[] = [];
  const fail = (keyword: string, message: string, at = path) => violations.push({ path: at, keyword, message: `${at} ${message}` });
  const child = (key: string) => (path === '$' ? key : `${path}.${key}`);

  const expected = schema.type as string | undefined;
  if (expected) {
    const actual = typeOf(value);
    const matches = expected === 'number' ? actual === 'number' && Number.isFinite(value) : actual === expected;
    if (!matches) {
      fail('type', `deve ser ${expected}`);
      return violations;
    }
  }

  if (schema.enum && !(schema.enum as unknown[]).includes(value)) {
    fail('enum', `deve ser um de: ${(schema.enum as unknown[]).join(', ')}`);
  }
  if (typeof value === 'string') {
    if (schema.pattern && !new RegExp(schema.pattern as string, 'u').test(value)) fail('pattern', `deve seguir ${schema.pattern}`);
    if (schema.minLength !== undefined && [...value].length < (schema.minLength as number)) fail('minLength', `deve ter ao menos ${schema.minLength} caractere(s)`);
    if (schema.maxLength !== undefined && [...value].length > (schema.maxLength as number)) fail('maxLength', `deve ter no maximo ${schema.maxLength} caracteres`);
  }
  if (typeof value === 'number' && schema.exclusiveMinimum !== undefined && !(value > (schema.exclusiveMinimum as number))) {
    fail('exclusiveMinimum', `deve ser maior que ${schema.exclusiveMinimum}`);
  }

  if (expected === 'array' && schema.items) {
    (value as unknown[]).forEach((item, index) => violations.push(...checkJsonSchema(schema.items as JsonSchema, item, `${path}[${index}]`)));
  }
  if (expected === 'object') {
    const record = value as Record<string, unknown>;
    const properties = (schema.properties ?? {}) as Record<string, JsonSchema>;
    for (const key of (schema.required ?? []) as string[]) {
      if (record[key] === undefined) fail('required', 'e obrigatorio', child(key));
    }
    for (const [key, item] of Object.entries(record)) {
      if (item === undefined) continue;
      const propertySchema = properties[key];
      if (propertySchema) violations.push(...checkJsonSchema(propertySchema, item, child(key)));
      else if (schema.additionalProperties === false) fail('additionalProperties', 'nao e um campo suportado', child(key));
    }
  }
  return violations;
}
