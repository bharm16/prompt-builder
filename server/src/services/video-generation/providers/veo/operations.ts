import { sleep } from '../../utils/sleep';
import { veoFetch } from './httpClient';
import { VEO_OPERATION_SCHEMA, VEO_START_RESPONSE_SCHEMA, type VeoOperation } from './schemas';

export async function startVeoGeneration(
  baseUrl: string,
  apiKey: string,
  prompt: string,
  modelId: string
): Promise<string> {
  const json = await veoFetch(baseUrl, apiKey, `/models/${modelId}:predictLongRunning`, {
    method: 'POST',
    body: JSON.stringify({
      instances: [{ prompt }],
    }),
  });

  const parsed = VEO_START_RESPONSE_SCHEMA.parse(json);
  return parsed.name;
}

export async function waitForVeoOperation(
  baseUrl: string,
  apiKey: string,
  operationName: string,
  options: { pollIntervalMs: number; timeoutMs: number }
): Promise<VeoOperation> {
  const start = Date.now();
  const cleanedName = operationName.replace(/^\/+/, '');

  while (true) {
    const json = await veoFetch(baseUrl, apiKey, `/${cleanedName}`, { method: 'GET' });
    const parsed = VEO_OPERATION_SCHEMA.parse(json);

    if (parsed.done) {
      if (parsed.error?.message) {
        throw new Error(`Veo generation failed: ${parsed.error.message}`);
      }
      return parsed;
    }

    if (Date.now() - start > options.timeoutMs) {
      throw new Error(`Timed out waiting for Veo operation ${operationName}`);
    }

    await sleep(options.pollIntervalMs);
  }
}

export function extractVeoVideoUri(response: unknown): string | null {
  if (!response || typeof response !== 'object') {
    return null;
  }

  const record = response as {
    generatedVideos?: Array<{ video?: { uri?: string } }>;
    generateVideoResponse?: { generatedSamples?: Array<{ video?: { uri?: string } }> };
  };

  const directUri = record.generatedVideos?.[0]?.video?.uri;
  if (directUri) {
    return directUri;
  }

  const sampleUri = record.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
  if (sampleUri) {
    return sampleUri;
  }

  return null;
}
