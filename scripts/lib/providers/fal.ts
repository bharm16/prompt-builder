import type { CapabilitiesSchema } from '../../../shared/capabilities';
import type { CatalogEntry } from '../modelCatalog';
import { transformOpenApiProperties } from '../transform';

interface OpenApiDocument {
  components?: {
    schemas?: Record<string, Record<string, unknown>>;
  };
}

const findInputSchema = (
  schemas: Record<string, Record<string, unknown>>
): Record<string, unknown> | null => {
  const candidates = Object.entries(schemas)
    .filter(([, schema]) => schema.type === 'object' && schema.properties)
    .map(([name, schema]) => ({ name, schema }));

  const hasPrompt = (schema: Record<string, unknown>): boolean => {
    const props = schema.properties as Record<string, unknown> | undefined;
    return !!props && Object.prototype.hasOwnProperty.call(props, 'prompt');
  };

  const named = candidates.find((entry) => /input|request/i.test(entry.name) && hasPrompt(entry.schema));
  if (named) {
    return named.schema;
  }

  const withPrompt = candidates.find((entry) => hasPrompt(entry.schema));
  if (withPrompt) {
    return withPrompt.schema;
  }

  return candidates[0]?.schema ?? null;
};

export async function fetchFalCapabilities(
  entry: CatalogEntry,
  falKey: string | null,
  generatedAt: string,
  version: string,
  log: (message: string, meta?: Record<string, unknown>) => void
): Promise<CapabilitiesSchema> {
  if (!entry.falEndpoint) {
    throw new Error(`Catalog entry ${entry.id} is missing falEndpoint`);
  }

  const url = `https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=${encodeURIComponent(entry.falEndpoint)}`;
  const headers: Record<string, string> = {};
  if (falKey) {
    headers.Authorization = `Key ${falKey}`;
  }

  log('Fetching Fal schema', { model: entry.id, endpoint: entry.falEndpoint });
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Fal API ${response.status} for ${entry.falEndpoint}`);
  }

  const openapi = (await response.json()) as OpenApiDocument;
  const schemas = openapi.components?.schemas ?? {};
  const inputSchema = findInputSchema(schemas);
  if (!inputSchema) {
    throw new Error(`No input schema found for ${entry.falEndpoint}`);
  }

  const properties = inputSchema.properties as Record<string, Record<string, unknown>> | undefined;
  if (!properties) {
    throw new Error(`No input properties found for ${entry.falEndpoint}`);
  }

  const transformed = transformOpenApiProperties(properties, schemas);

  return {
    provider: entry.provider,
    model: entry.id,
    version,
    source: `fal:${entry.falEndpoint}`,
    generated_at: generatedAt,
    fields: transformed.fields,
    features: {
      text_to_video: transformed.features.text_to_video,
      image_to_video: transformed.features.image_to_video,
    },
    ...(transformed.unknownFields.length > 0 ? { unknown_fields: transformed.unknownFields } : {}),
  };
}
