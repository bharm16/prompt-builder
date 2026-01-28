import { API_CONFIG } from '@/config/api.config';
import { buildFirebaseAuthHeaders } from '@/services/http/firebaseAuth';

export interface ReferenceImage {
  id: string;
  userId: string;
  imageUrl: string;
  thumbnailUrl: string;
  storagePath: string;
  thumbnailPath: string;
  label?: string | null;
  metadata: {
    width: number;
    height: number;
    sizeBytes: number;
    contentType: string;
    source?: string | null;
    originalName?: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const authHeaders = await buildFirebaseAuthHeaders();
  const headers: Record<string, string> = {
    ...authHeaders,
    ...(options.headers || {}),
  };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_CONFIG.baseURL}/reference-images${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 204) {
    return null;
  }

  let payload: Record<string, unknown> | null = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const errorMsg = (payload?.error ?? payload?.message ?? 'Reference image API error') as string;
    throw new Error(errorMsg);
  }

  return payload;
}

export const referenceImageApi = {
  async list(limit?: number): Promise<ReferenceImage[]> {
    const query = Number.isFinite(limit) ? `?limit=${limit}` : '';
    const payload = await fetchWithAuth(query ? `/${query}` : '/');
    return (payload?.images || []) as ReferenceImage[];
  },

  async upload(
    file: File,
    options: { label?: string; source?: string } = {}
  ): Promise<ReferenceImage> {
    const formData = new FormData();
    formData.append('file', file);
    if (options.label) {
      formData.append('label', options.label);
    }
    if (options.source) {
      formData.append('source', options.source);
    }

    const payload = await fetchWithAuth('/', {
      method: 'POST',
      body: formData,
    });

    return payload as unknown as ReferenceImage;
  },

  async uploadFromUrl(
    sourceUrl: string,
    options: { label?: string; source?: string } = {}
  ): Promise<ReferenceImage> {
    const payload = await fetchWithAuth('/from-url', {
      method: 'POST',
      body: JSON.stringify({
        sourceUrl,
        ...(options.label ? { label: options.label } : {}),
        ...(options.source ? { source: options.source } : {}),
      }),
    });
    return payload as unknown as ReferenceImage;
  },

  async delete(imageId: string): Promise<void> {
    await fetchWithAuth(`/${encodeURIComponent(imageId)}`, {
      method: 'DELETE',
    });
  },
};

export default referenceImageApi;
