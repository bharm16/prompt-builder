type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type JsonRecord = { [key: string]: JsonValue };

interface NormalizedOpenAiSchema {
  name: string;
  schema: JsonRecord;
}

const SCHEMA_METADATA_KEYS = new Set(['name', 'strict', '$schema', '$id']);
const OPENAI_FALLBACK_SCHEMA_NAME = 'structured_response';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toSchemaName(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function looksLikeWrapperSchema(schema: Record<string, unknown>): boolean {
  if (!isRecord(schema.schema)) {
    return false;
  }

  if ('name' in schema || 'strict' in schema) {
    return true;
  }

  return !(
    'type' in schema ||
    'properties' in schema ||
    'items' in schema ||
    'anyOf' in schema ||
    'oneOf' in schema ||
    'allOf' in schema ||
    'required' in schema
  );
}

function isObjectSchemaNode(schema: Record<string, JsonValue>): boolean {
  if ('properties' in schema) {
    return true;
  }

  const nodeType = schema.type;
  if (typeof nodeType === 'string') {
    return nodeType === 'object';
  }

  if (Array.isArray(nodeType)) {
    return nodeType.includes('object');
  }

  return false;
}

function normalizeSchemaNode(value: unknown): JsonValue {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeSchemaNode(entry));
  }

  if (!isRecord(value)) {
    return value as JsonValue;
  }

  const normalized: Record<string, JsonValue> = {};

  for (const [key, nestedValue] of Object.entries(value)) {
    if (SCHEMA_METADATA_KEYS.has(key)) {
      continue;
    }

    normalized[key] = normalizeSchemaNode(nestedValue);
  }

  if (isObjectSchemaNode(normalized)) {
    normalized.additionalProperties = false;
  }

  return normalized;
}

export function normalizeOpenAiSchema(schemaInput: Record<string, unknown>): NormalizedOpenAiSchema {
  const hasWrapper = looksLikeWrapperSchema(schemaInput);
  const schemaBody = hasWrapper ? (schemaInput.schema as Record<string, unknown>) : schemaInput;

  const schemaName =
    toSchemaName(schemaInput.name) ??
    toSchemaName((schemaBody as Record<string, unknown>).name) ??
    OPENAI_FALLBACK_SCHEMA_NAME;

  const normalizedBody = normalizeSchemaNode(schemaBody);
  if (!isRecord(normalizedBody)) {
    throw new Error('Schema normalization failed: expected an object schema.');
  }

  return {
    name: schemaName,
    schema: normalizedBody as JsonRecord,
  };
}

