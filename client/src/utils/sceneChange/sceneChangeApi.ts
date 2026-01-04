import { API_CONFIG } from '@config/api.config';
import type { SceneChangeRequest, SceneChangeResponse } from './types';

export async function detectSceneChange(
  request: SceneChangeRequest,
  fetchImpl?: typeof fetch
): Promise<SceneChangeResponse> {
  const fetchFn =
    fetchImpl || (typeof fetch !== 'undefined' ? fetch : undefined);

  if (!fetchFn) {
    throw new Error('Fetch is not available in this environment.');
  }

  const response = await fetchFn('/api/detect-scene-change', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_CONFIG.apiKey,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return (await response.json()) as SceneChangeResponse;
}
