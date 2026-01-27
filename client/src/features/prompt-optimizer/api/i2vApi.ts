import { buildFirebaseAuthHeaders } from '@/services/http/firebaseAuth';
import type { ImageObservation } from '../types/i2v';

export interface ImageObservationRequest {
  image: string;
  skipCache?: boolean;
}

export interface ImageObservationResponse {
  success: boolean;
  observation?: ImageObservation;
  error?: string;
  cached: boolean;
  usedFastPath: boolean;
  durationMs: number;
}

export interface ImageObservationFetchOptions {
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}

export async function observeImage(
  payload: ImageObservationRequest,
  options: ImageObservationFetchOptions = {}
): Promise<ImageObservationResponse> {
  const fetchFn = options.fetchImpl || (typeof fetch !== 'undefined' ? fetch : undefined);
  if (!fetchFn) {
    throw new Error('Fetch is not available in this environment.');
  }

  const authHeaders = await buildFirebaseAuthHeaders();
  const response = await fetchFn('/api/image/observe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify(payload),
    ...(options.signal ? { signal: options.signal } : {}),
  });

  if (!response.ok) {
    throw new Error(`Failed to observe image: ${response.status}`);
  }

  return (await response.json()) as ImageObservationResponse;
}

export const i2vApi = {
  observeImage,
};
