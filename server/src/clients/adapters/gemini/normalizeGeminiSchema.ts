type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const GEMINI_UNSUPPORTED_KEYS = new Set(['additionalProperties', '$schema', '$id']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

function normalizeSchemaNode(value: unknown): JsonValue {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeSchemaNode(entry));
  }

  if (!isRecord(value)) {
    return value as JsonValue;
  }

  const normalized: Record<string, JsonValue> = {};

  for (const [key, nestedValue] of Object.entries(value)) {
    if (GEMINI_UNSUPPORTED_KEYS.has(key)) {
      continue;
    }
    normalized[key] = normalizeSchemaNode(nestedValue);
  }

  return normalized;
}

export function normalizeGeminiSchema(schemaInput: Record<string, unknown>): Record<string, unknown> {
  const schemaBody = looksLikeWrapperSchema(schemaInput)
    ? (schemaInput.schema as Record<string, unknown>)
    : schemaInput;

  const normalized = normalizeSchemaNode(schemaBody);
  if (!isRecord(normalized)) {
    throw new Error('Gemini schema normalization failed: expected an object schema.');
  }

  return normalized;
}

