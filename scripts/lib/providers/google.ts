import type { CapabilitiesSchema } from '../../../shared/capabilities';
import type { CatalogEntry } from '../modelCatalog';
import { MANUAL_CAPABILITIES_REGISTRY } from '../../../server/src/services/capabilities/manualRegistry';

interface GoogleModelsResponse {
  models?: Array<{ name?: string }>;
}

export async function fetchGoogleCapabilities(
  entry: CatalogEntry,
  apiKey: string | undefined,
  generatedAt: string,
  log: (message: string, meta?: Record<string, unknown>) => void
): Promise<CapabilitiesSchema> {
  const manual = MANUAL_CAPABILITIES_REGISTRY[entry.provider]?.[entry.id];
  if (!manual) {
    throw new Error(`No manual baseline for Google model ${entry.id}`);
  }

  const schema = JSON.parse(JSON.stringify(manual)) as CapabilitiesSchema;
  schema.generated_at = generatedAt;

  if (!apiKey) {
    schema.source = 'google.manual';
    log('GEMINI_API_KEY/GOOGLE_API_KEY missing, using manual baseline', { model: entry.id });
    return schema;
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );

    if (!response.ok) {
      schema.source = `google.manual (models API ${response.status})`;
      return schema;
    }

    const payload = (await response.json()) as GoogleModelsResponse;
    const modelIds = (payload.models || [])
      .map((model) => model.name?.replace('models/', ''))
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

    const veoModels = modelIds.filter((id) => id.toLowerCase().includes('veo'));
    if (veoModels.length > 0) {
      schema.source = 'google.api+manual';
    } else {
      schema.source = 'google.manual (no veo models found)';
    }

    return schema;
  } catch (error) {
    schema.source = `google.manual (models API error: ${error instanceof Error ? error.message : String(error)})`;
    return schema;
  }
}
