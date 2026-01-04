import type { CapabilitiesSchema } from '@shared/capabilities';
import { ApiClient, apiClient } from './ApiClient';

interface ProvidersResponse {
  providers: string[];
}

interface ModelsResponse {
  provider: string;
  models: string[];
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
}

export const capabilitiesApi = new CapabilitiesApi(apiClient);
