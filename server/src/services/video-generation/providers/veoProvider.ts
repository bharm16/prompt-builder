import type { ReadableStream } from 'node:stream/web';
import { z } from 'zod';
import { sleep } from '../utils/sleep';
import type { VideoAssetStore, StoredVideoAsset } from '../storage';
import { toNodeReadableStream } from '../storage/utils';

type LogSink = {
  info: (message: string, meta?: Record<string, unknown>) => void;
};

export const DEFAULT_VEO_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
export const VEO_MODEL_ID = 'veo-3.1-generate-preview';

const VEO_STATUS_POLL_INTERVAL_MS = 10000;
const VEO_TASK_TIMEOUT_MS = 5 * 60 * 1000;

const VEO_START_RESPONSE_SCHEMA = z.object({
  name: z.string(),
});

const VEO_OPERATION_SCHEMA = z.object({
  name: z.string(),
  done: z.boolean().optional(),
  error: z.object({ message: z.string().optional() }).optional(),
  response: z.unknown().optional(),
});

async function veoFetch(
  baseUrl: string,
  apiKey: string,
  path: string,
  init: RequestInit
): Promise<unknown> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Non-JSON response (${response.status}): ${text.slice(0, 400)}`);
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${JSON.stringify(json).slice(0, 800)}`);
  }

  return json;
}

async function startVeoGeneration(
  baseUrl: string,
  apiKey: string,
  prompt: string
): Promise<string> {
  const json = await veoFetch(baseUrl, apiKey, `/models/${VEO_MODEL_ID}:predictLongRunning`, {
    method: 'POST',
    body: JSON.stringify({
      instances: [{ prompt }],
    }),
  });

  const parsed = VEO_START_RESPONSE_SCHEMA.parse(json);
  return parsed.name;
}

async function waitForVeoOperation(
  baseUrl: string,
  apiKey: string,
  operationName: string
): Promise<z.infer<typeof VEO_OPERATION_SCHEMA>> {
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

    if (Date.now() - start > VEO_TASK_TIMEOUT_MS) {
      throw new Error(`Timed out waiting for Veo operation ${operationName}`);
    }

    await sleep(VEO_STATUS_POLL_INTERVAL_MS);
  }
}

function extractVeoVideoUri(response: unknown): string | null {
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

async function downloadVeoVideoStream(
  apiKey: string,
  videoUri: string
): Promise<{ stream: ReadableStream<Uint8Array>; contentType: string }> {
  const response = await fetch(videoUri, {
    method: 'GET',
    headers: {
      'x-goog-api-key': apiKey,
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Veo download failed (${response.status}): ${text.slice(0, 400)}`);
  }

  const contentType = response.headers.get('content-type') || 'video/mp4';
  const body = response.body as ReadableStream<Uint8Array> | null;
  if (!body) {
    throw new Error('Veo download failed: empty response body.');
  }
  return { stream: body, contentType };
}

export async function generateVeoVideo(
  apiKey: string,
  baseUrl: string,
  prompt: string,
  assetStore: VideoAssetStore,
  log: LogSink
): Promise<StoredVideoAsset> {
  const operationName = await startVeoGeneration(baseUrl, apiKey, prompt);
  log.info('Veo generation started', { operationName, model: VEO_MODEL_ID });

  const operation = await waitForVeoOperation(baseUrl, apiKey, operationName);
  const videoUri = extractVeoVideoUri(operation.response);

  if (!videoUri) {
    throw new Error('Veo generation completed without a downloadable video URI.');
  }

  const { stream, contentType } = await downloadVeoVideoStream(apiKey, videoUri);
  return await assetStore.storeFromStream(toNodeReadableStream(stream), contentType);
}
