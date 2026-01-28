import { API_CONFIG } from '@/config/api.config';
import { buildFirebaseAuthHeaders } from '@/services/http/firebaseAuth';
import type { ContinuitySession, ContinuityShot } from '../types';

async function fetchWithAuth<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const authHeaders = await buildFirebaseAuthHeaders();
  const response = await fetch(`${API_CONFIG.baseURL}/continuity${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...(options.headers || {}),
    },
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || 'Continuity API error');
  }

  return payload.data as T;
}

export const continuityApi = {
  createSession: (input: Record<string, unknown>) =>
    fetchWithAuth<ContinuitySession>('/sessions', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  listSessions: () => fetchWithAuth<ContinuitySession[]>('/sessions'),

  getSession: (sessionId: string) => fetchWithAuth<ContinuitySession>(`/sessions/${sessionId}`),

  addShot: (sessionId: string, input: Record<string, unknown>) =>
    fetchWithAuth<ContinuityShot>(`/sessions/${sessionId}/shots`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  generateShot: (sessionId: string, shotId: string) =>
    fetchWithAuth<ContinuityShot>(`/sessions/${sessionId}/shots/${shotId}/generate`, {
      method: 'POST',
    }),

  updateShotStyleReference: (sessionId: string, shotId: string, styleReferenceId: string) =>
    fetchWithAuth<ContinuityShot>(`/sessions/${sessionId}/shots/${shotId}/style-reference`, {
      method: 'PUT',
      body: JSON.stringify({ styleReferenceId }),
    }),

  updatePrimaryStyleReference: (sessionId: string, input: Record<string, unknown>) =>
    fetchWithAuth<ContinuitySession>(`/sessions/${sessionId}/style-reference`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),

  createSceneProxy: (sessionId: string, input: Record<string, unknown>) =>
    fetchWithAuth<ContinuitySession>(`/sessions/${sessionId}/scene-proxy`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
};

export default continuityApi;
