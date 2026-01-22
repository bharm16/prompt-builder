import type { Asset, AssetListResponse } from '@shared/types/asset';

const API_BASE = '/api/assets';

async function handleError(response: Response, fallback: string): Promise<never> {
  try {
    const payload = await response.json();
    throw new Error(payload.error || payload.message || fallback);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(fallback);
  }
}

export const assetApi = {
  async list(type: string | null = null): Promise<AssetListResponse> {
    const url = type ? `${API_BASE}?type=${type}` : API_BASE;
    const response = await fetch(url, { credentials: 'include' });
    if (!response.ok) {
      return await handleError(response, 'Failed to fetch assets');
    }
    return await response.json();
  },

  async get(assetId: string): Promise<Asset> {
    const response = await fetch(`${API_BASE}/${assetId}`, {
      credentials: 'include',
    });
    if (!response.ok) {
      return await handleError(response, 'Failed to fetch asset');
    }
    return await response.json();
  },

  async create(data: {
    type: string;
    trigger: string;
    name: string;
    textDefinition: string;
    negativePrompt?: string;
  }): Promise<Asset> {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      return await handleError(response, 'Failed to create asset');
    }
    return await response.json();
  },

  async update(
    assetId: string,
    data: {
      trigger?: string;
      name?: string;
      textDefinition?: string;
      negativePrompt?: string;
    }
  ): Promise<Asset> {
    const response = await fetch(`${API_BASE}/${assetId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      return await handleError(response, 'Failed to update asset');
    }
    return await response.json();
  },

  async delete(assetId: string): Promise<boolean> {
    const response = await fetch(`${API_BASE}/${assetId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!response.ok) {
      return await handleError(response, 'Failed to delete asset');
    }
    return true;
  },

  async getSuggestions(query: string) {
    const response = await fetch(
      `${API_BASE}/suggestions?q=${encodeURIComponent(query)}`,
      {
        credentials: 'include',
      }
    );
    if (!response.ok) {
      return await handleError(response, 'Failed to get suggestions');
    }
    return await response.json();
  },

  async resolve(prompt: string) {
    const response = await fetch(`${API_BASE}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ prompt }),
    });
    if (!response.ok) {
      return await handleError(response, 'Failed to resolve prompt');
    }
    return await response.json();
  },

  async validate(prompt: string) {
    const response = await fetch(`${API_BASE}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ prompt }),
    });
    if (!response.ok) {
      return await handleError(response, 'Failed to validate triggers');
    }
    return await response.json();
  },

  async addImage(
    assetId: string,
    file: File,
    metadata: Record<string, string | undefined> = {}
  ) {
    const formData = new FormData();
    formData.append('image', file);
    Object.entries(metadata).forEach(([key, value]) => {
      if (value) {
        formData.append(key, value);
      }
    });

    const response = await fetch(`${API_BASE}/${assetId}/images`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    if (!response.ok) {
      return await handleError(response, 'Failed to upload image');
    }
    return await response.json();
  },

  async deleteImage(assetId: string, imageId: string): Promise<boolean> {
    const response = await fetch(`${API_BASE}/${assetId}/images/${imageId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!response.ok) {
      return await handleError(response, 'Failed to delete image');
    }
    return true;
  },

  async setPrimaryImage(assetId: string, imageId: string): Promise<Asset> {
    const response = await fetch(
      `${API_BASE}/${assetId}/images/${imageId}/primary`,
      {
        method: 'PATCH',
        credentials: 'include',
      }
    );
    if (!response.ok) {
      return await handleError(response, 'Failed to set primary image');
    }
    return await response.json();
  },

  async getForGeneration(assetId: string) {
    const response = await fetch(`${API_BASE}/${assetId}/for-generation`, {
      credentials: 'include',
    });
    if (!response.ok) {
      return await handleError(response, 'Asset not ready for generation');
    }
    return await response.json();
  },
};

export default assetApi;
