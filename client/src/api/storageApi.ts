import { API_CONFIG } from '@/config/api.config';
import { buildFirebaseAuthHeaders } from '@/services/http/firebaseAuth';

async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const authHeaders = await buildFirebaseAuthHeaders();
  const response = await fetch(`${API_CONFIG.baseURL}/storage${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...(options.headers || {}),
    },
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || 'Storage API error');
  }

  return payload.data;
}

export const storageApi = {
  getUploadUrl: (type: string, contentType: string, metadata: Record<string, unknown> = {}) =>
    fetchWithAuth('/upload-url', {
      method: 'POST',
      body: JSON.stringify({ type, contentType, metadata }),
    }),

  confirmUpload: (storagePath: string) =>
    fetchWithAuth('/confirm-upload', {
      method: 'POST',
      body: JSON.stringify({ storagePath }),
    }),

  saveFromUrl: (sourceUrl: string, type: string, metadata: Record<string, unknown> = {}) =>
    fetchWithAuth('/save-from-url', {
      method: 'POST',
      body: JSON.stringify({ sourceUrl, type, metadata }),
    }),

  getViewUrl: (path: string) =>
    fetchWithAuth(`/view-url?path=${encodeURIComponent(path)}`),

  getDownloadUrl: (path: string, filename?: string | null) => {
    const params = new URLSearchParams({ path });
    if (filename) {
      params.set('filename', filename);
    }
    return fetchWithAuth(`/download-url?${params.toString()}`);
  },

  listFiles: (options: { type?: string; limit?: number; cursor?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.type) params.set('type', options.type);
    if (options.limit) params.set('limit', String(options.limit));
    if (options.cursor) params.set('cursor', options.cursor);
    const query = params.toString();
    return fetchWithAuth(query ? `/list?${query}` : '/list');
  },

  getUsage: () => fetchWithAuth('/usage'),

  deleteFile: (path: string) =>
    fetchWithAuth(`/${encodeURI(path)}`, { method: 'DELETE' }),

  deleteFiles: (paths: string[]) =>
    fetchWithAuth('/delete-batch', {
      method: 'POST',
      body: JSON.stringify({ paths }),
    }),
};

export default storageApi;
