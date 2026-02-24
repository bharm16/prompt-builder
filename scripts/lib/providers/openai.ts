import type { CapabilitiesSchema } from '../../../shared/capabilities';
import type { CatalogEntry } from '../modelCatalog';
import { MANUAL_CAPABILITIES_REGISTRY } from '../../../server/src/services/capabilities/manualRegistry';

interface OpenAIModelResponse {
  data?: Array<{ id?: string }>;
}

export async function fetchOpenAICapabilities(
  entry: CatalogEntry,
  apiKey: string | undefined,
  generatedAt: string,
  log: (message: string, meta?: Record<string, unknown>) => void
): Promise<CapabilitiesSchema> {
  const manual = MANUAL_CAPABILITIES_REGISTRY[entry.provider]?.[entry.id];
  if (!manual) {
    throw new Error(`No manual baseline for OpenAI model ${entry.id}`);
  }

  const schema = JSON.parse(JSON.stringify(manual)) as CapabilitiesSchema;
  schema.generated_at = generatedAt;

  if (!apiKey) {
    schema.source = 'openai.manual';
    log('OPENAI_API_KEY missing, using manual baseline', { model: entry.id });
    return schema;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      schema.source = `openai.manual (models API ${response.status})`;
      return schema;
    }

    const payload = (await response.json()) as OpenAIModelResponse;
    const modelIds = (payload.data || [])
      .map((model) => model.id)
      .filter((id): id is string => typeof id === 'string');

    if (modelIds.includes(entry.id)) {
      schema.source = 'openai.api+manual';
      return schema;
    }

    schema.source = 'openai.manual (model not found)';
    log('OpenAI model not found in /v1/models, using manual baseline', {
      model: entry.id,
      discoveredSoraModels: modelIds.filter((id) => id.includes('sora')),
    });
    return schema;
  } catch (error) {
    schema.source = `openai.manual (models API error: ${error instanceof Error ? error.message : String(error)})`;
    return schema;
  }
}
