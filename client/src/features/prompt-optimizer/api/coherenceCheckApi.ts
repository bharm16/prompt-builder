import { buildFirebaseAuthHeaders } from '@/services/http/firebaseAuth';
import type { CoherenceCheckRequest, CoherenceCheckResult } from '../types/coherence';

export interface CoherenceCheckFetchOptions {
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}

export async function checkPromptCoherence(
  payload: CoherenceCheckRequest,
  options: CoherenceCheckFetchOptions = {}
): Promise<CoherenceCheckResult> {
  const fetchFn = options.fetchImpl || (typeof fetch !== 'undefined' ? fetch : undefined);
  if (!fetchFn) {
    throw new Error('Fetch is not available in this environment.');
  }

  const authHeaders = await buildFirebaseAuthHeaders();
  const response = await fetchFn('/api/check-prompt-coherence', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify(payload),
    ...(options.signal ? { signal: options.signal } : {}),
  });

  if (!response.ok) {
    throw new Error(`Failed to check coherence: ${response.status}`);
  }

  return (await response.json()) as CoherenceCheckResult;
}
