import { z } from 'zod';
import type { CapabilitiesSchema } from '@shared/capabilities';
import { ApiClient, apiClient } from './ApiClient';

const CapabilityValueSchema = z.union([z.string(), z.number(), z.boolean()]);
const CapabilityFieldTypeSchema = z.enum(['enum', 'int', 'bool', 'string']);

const CapabilityConditionSchema = z.object({
  field: z.string(),
  eq: CapabilityValueSchema.optional(),
  neq: CapabilityValueSchema.optional(),
  in: z.array(CapabilityValueSchema).optional(),
  not_in: z.array(CapabilityValueSchema).optional(),
});

const CapabilityValueRuleSchema = z.object({
  if: CapabilityConditionSchema,
  values: z.array(CapabilityValueSchema),
});

const CapabilityFieldConstraintsSchema = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  available_if: z.array(CapabilityConditionSchema).optional(),
  disabled_if: z.array(CapabilityConditionSchema).optional(),
  available_values_if: z.array(CapabilityValueRuleSchema).optional(),
});

const CapabilityFieldUISchema = z.object({
  label: z.string().optional(),
  control: z.enum(['select', 'segmented', 'toggle', 'input']).optional(),
  group: z.string().optional(),
  order: z.number().optional(),
  description: z.string().optional(),
  placeholder: z.string().optional(),
});

const CapabilityFieldSchema = z.object({
  type: CapabilityFieldTypeSchema,
  values: z.array(CapabilityValueSchema).optional(),
  default: CapabilityValueSchema.optional(),
  constraints: CapabilityFieldConstraintsSchema.optional(),
  ui: CapabilityFieldUISchema.optional(),
});

const ModelFeaturesSchema = z.object({
  text_to_video: z.boolean(),
  image_to_video: z.boolean(),
  video_to_video: z.boolean().optional(),
});

const CapabilitiesSchemaSchema = z.object({
  provider: z.string(),
  model: z.string(),
  version: z.string(),
  source: z.string().optional(),
  generated_at: z.string().optional(),
  features: ModelFeaturesSchema.optional(),
  fields: z.record(CapabilityFieldSchema),
  unknown_fields: z.array(z.string()).optional(),
});

const ProvidersResponseSchema = z.object({
  providers: z.array(z.string()),
});

const ModelsResponseSchema = z.object({
  provider: z.string(),
  models: z.array(z.string()),
});

const VideoAvailabilityModelSchema = z.object({
  id: z.string(),
  available: z.boolean(),
  supportsImageInput: z.boolean().optional(),
  supportsI2V: z.boolean().optional(),
  planTier: z.string().optional(),
  entitled: z.boolean().optional(),
});

const VideoAvailabilityResponseSchema = z.object({
  availableModels: z.array(z.string()),
  availableCapabilityModels: z.array(z.string()).optional(),
  models: z.array(VideoAvailabilityModelSchema).optional(),
});

const CapabilitiesRegistrySchema = z.record(z.record(CapabilitiesSchemaSchema));

type ModelsResponse = z.infer<typeof ModelsResponseSchema>;
type VideoAvailabilityResponse = z.infer<typeof VideoAvailabilityResponseSchema>;

export class CapabilitiesApi {
  constructor(private readonly client: ApiClient) {}

  async getCapabilities(provider: string, model: string): Promise<CapabilitiesSchema> {
    const encodedProvider = encodeURIComponent(provider);
    const encodedModel = encodeURIComponent(model);
    return CapabilitiesSchemaSchema.parse(
      await this.client.get(`/capabilities?provider=${encodedProvider}&model=${encodedModel}`)
    );
  }

  async listProviders(): Promise<string[]> {
    const data = ProvidersResponseSchema.parse(await this.client.get('/providers'));
    return data.providers;
  }

  async listModels(provider: string): Promise<ModelsResponse> {
    const encodedProvider = encodeURIComponent(provider);
    return ModelsResponseSchema.parse(
      await this.client.get(`/models?provider=${encodedProvider}`)
    );
  }

  async getRegistry(): Promise<Record<string, Record<string, CapabilitiesSchema>>> {
    return CapabilitiesRegistrySchema.parse(await this.client.get('/registry'));
  }

  async getVideoAvailability(): Promise<VideoAvailabilityResponse> {
    return VideoAvailabilityResponseSchema.parse(
      await this.client.get('/preview/video/availability')
    );
  }
}

export const capabilitiesApi = new CapabilitiesApi(apiClient);
