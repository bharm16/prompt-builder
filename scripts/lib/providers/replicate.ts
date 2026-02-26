import type { CapabilitiesSchema } from '../../../shared/capabilities';
import type { CatalogEntry } from '../modelCatalog';
import { transformOpenApiProperties } from '../transform';

interface ReplicateSchema {
  components?: {
    schemas?: Record<string, Record<string, unknown>>;
  };
}

interface ReplicateModelResponse {
  latest_version?: {
    openapi_schema?: ReplicateSchema;
  };
}

const REPLICATE_API_BASE = 'https://api.replicate.com/v1';

const isImageField = (key: string): boolean => {
  const normalized = key.toLowerCase();
  return normalized.includes('image');
};

export async function fetchReplicateCapabilities(
  entry: CatalogEntry,
  replicateToken: string,
  generatedAt: string,
  version: string,
  log: (message: string, meta?: Record<string, unknown>) => void
): Promise<CapabilitiesSchema> {
  if (!entry.replicateId) {
    throw new Error(`Catalog entry ${entry.id} is missing replicateId`);
  }

  const headers = { Authorization: `Bearer ${replicateToken}` };

  const fetchModel = async (modelId: string): Promise<ReplicateModelResponse> => {
    const url = `${REPLICATE_API_BASE}/models/${modelId}`;
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`Replicate API ${response.status} for ${modelId}`);
    }
    return (await response.json()) as ReplicateModelResponse;
  };

  log('Fetching Replicate schema', { model: entry.id, replicateId: entry.replicateId });
  const data = await fetchModel(entry.replicateId);

  const schemas =
    data.latest_version?.openapi_schema?.components?.schemas as
      | Record<string, Record<string, unknown>>
      | undefined;
  const properties = schemas?.Input?.properties as Record<string, Record<string, unknown>> | undefined;

  if (!properties) {
    throw new Error(`Missing Input.properties for Replicate model ${entry.replicateId}`);
  }

  const transformed = transformOpenApiProperties(properties, schemas);

  if (Array.isArray(entry.additionalReplicateIds) && entry.additionalReplicateIds.length > 0) {
    for (const extraId of entry.additionalReplicateIds) {
      try {
        const extra = await fetchModel(extraId);
        const extraProps =
          extra.latest_version?.openapi_schema?.components?.schemas?.Input?.properties as
            | Record<string, Record<string, unknown>>
            | undefined;
        if (!extraProps) {
          continue;
        }

        for (const key of Object.keys(extraProps)) {
          if (isImageField(key)) {
            transformed.features.image_to_video = true;
            const imageInput = transformed.fields.image_input;
            if (imageInput) {
              transformed.fields.image_input = {
                ...imageInput,
                default: true,
              };
            }
            break;
          }
        }

        if (Object.prototype.hasOwnProperty.call(extraProps, 'style_reference')) {
          transformed.features.style_reference = true;
          const styleReference = transformed.fields.style_reference;
          if (styleReference) {
            transformed.fields.style_reference = {
              ...styleReference,
              default: true,
            };
          }
        }
      } catch (error) {
        log('Additional Replicate model fetch failed (non-fatal)', {
          model: entry.id,
          additionalReplicateId: extraId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return {
    provider: entry.provider,
    model: entry.id,
    version,
    source: `replicate:${entry.replicateId}`,
    generated_at: generatedAt,
    fields: transformed.fields,
    features: {
      text_to_video: transformed.features.text_to_video,
      image_to_video: transformed.features.image_to_video,
    },
    ...(transformed.unknownFields.length > 0 ? { unknown_fields: transformed.unknownFields } : {}),
  };
}
