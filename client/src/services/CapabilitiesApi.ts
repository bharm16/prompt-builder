import type { CapabilitiesSchema } from '@shared/capabilities';
import { ApiClient, apiClient } from './ApiClient';

interface ProvidersResponse {
  providers: string[];
}

interface ModelsResponse {
  provider: string;
  models: string[];
}

interface VideoAvailabilityModel {
  id: string;
  available: boolean;
  supportsImageInput?: boolean;
}

interface VideoAvailabilityResponse {
  availableModels: string[];
  models?: VideoAvailabilityModel[];
}

export class CapabilitiesApi {
  constructor(private readonly client: ApiClient) {}

  async getCapabilities(provider: string, model: string): Promise<CapabilitiesSchema> {
    const encodedProvider = encodeURIComponent(provider);
    const encodedModel = encodeURIComponent(model);
    return (await this.client.get(
      `/capabilities?provider=${encodedProvider}&model=${encodedModel}`
    )) as CapabilitiesSchema;
  }

  async listProviders(): Promise<string[]> {
    const data = (await this.client.get('/providers')) as ProvidersResponse;
    return data.providers;
  }

  async listModels(provider: string): Promise<ModelsResponse> {
    const encodedProvider = encodeURIComponent(provider);
    return (await this.client.get(`/models?provider=${encodedProvider}`)) as ModelsResponse;
  }

  async getRegistry(): Promise<Record<string, Record<string, CapabilitiesSchema>>> {
    return (await this.client.get('/registry')) as Record<
      string,
      Record<string, CapabilitiesSchema>
    >;
  }

  async getVideoAvailability(): Promise<VideoAvailabilityResponse> {
    return (await this.client.get('/preview/video/availability')) as VideoAvailabilityResponse;
  }
}

export const capabilitiesApi = new CapabilitiesApi(apiClient);
