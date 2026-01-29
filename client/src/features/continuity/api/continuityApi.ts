import { API_CONFIG } from '@/config/api.config';
import { buildFirebaseAuthHeaders } from '@/services/http/firebaseAuth';
import type { ContinuitySession, ContinuityShot, CreateSessionInput, CreateShotInput } from '../types';
import { z } from 'zod';
import {
  ContinuityApiResponseSchema,
  ContinuitySessionSchema,
  ContinuityShotSchema,
} from './schemas';

async function fetchWithAuth<T>(
  endpoint: string,
  schema: z.ZodType<T>,
  options: RequestInit = {}
): Promise<T> {
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

  const parsed = ContinuityApiResponseSchema(schema).safeParse(payload);
  if (!parsed.success) {
    throw new Error('Invalid continuity API response');
  }

  return parsed.data.data;
}

export const continuityApi = {
  createSession: (input: CreateSessionInput) =>
    fetchWithAuth('/sessions', ContinuitySessionSchema, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  listSessions: () =>
    fetchWithAuth('/sessions', z.array(ContinuitySessionSchema)),

  getSession: (sessionId: string) =>
    fetchWithAuth(`/sessions/${sessionId}`, ContinuitySessionSchema),

  addShot: (sessionId: string, input: CreateShotInput) =>
    fetchWithAuth(`/sessions/${sessionId}/shots`, ContinuityShotSchema, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  generateShot: (sessionId: string, shotId: string) =>
    fetchWithAuth(`/sessions/${sessionId}/shots/${shotId}/generate`, ContinuityShotSchema, {
      method: 'POST',
    }),

  updateShotStyleReference: (sessionId: string, shotId: string, styleReferenceId: string | null) =>
    fetchWithAuth(`/sessions/${sessionId}/shots/${shotId}/style-reference`, ContinuityShotSchema, {
      method: 'PUT',
      body: JSON.stringify({ styleReferenceId }),
    }),

  updatePrimaryStyleReference: (sessionId: string, input: Record<string, unknown>) =>
    fetchWithAuth(`/sessions/${sessionId}/style-reference`, ContinuitySessionSchema, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),

  updateSessionSettings: (sessionId: string, settings: Record<string, unknown>) =>
    fetchWithAuth(`/sessions/${sessionId}/settings`, ContinuitySessionSchema, {
      method: 'PUT',
      body: JSON.stringify({ settings }),
    }),

  createSceneProxy: (sessionId: string, input: Record<string, unknown>) =>
    fetchWithAuth(`/sessions/${sessionId}/scene-proxy`, ContinuitySessionSchema, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
};

export default continuityApi;
