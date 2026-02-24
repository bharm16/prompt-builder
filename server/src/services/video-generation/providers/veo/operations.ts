import { sleep } from '@services/video-generation/utils/sleep';
import { veoFetch } from './httpClient';
import { VEO_OPERATION_SCHEMA, VEO_START_RESPONSE_SCHEMA, type VeoOperation } from './schemas';
import type { VeoInlineData } from './imageUtils';

export interface VeoGenerationInput {
  prompt: string;
  startImage?: VeoInlineData;
  lastFrame?: VeoInlineData;
  referenceImages?: Array<{ image: VeoInlineData; referenceType: 'asset' | 'style' }>;
  extendVideo?: VeoInlineData;
  parameters?: {
    aspectRatio?: string;
    resolution?: string;
    durationSeconds?: number;
    seed?: number;
    numberOfVideos?: number;
    personGeneration?: string;
  };
}

export async function startVeoGeneration(
  baseUrl: string,
  apiKey: string,
  input: VeoGenerationInput,
  modelId: string
): Promise<string> {
  const instance: Record<string, unknown> = { prompt: input.prompt };
  if (input.startImage) {
    instance.image = input.startImage;
  }
  if (input.extendVideo) {
    instance.video = input.extendVideo;
  }

  const parameters: Record<string, unknown> = {};
  if (input.lastFrame) {
    parameters.lastFrame = input.lastFrame;
  }
  if (input.referenceImages?.length) {
    parameters.referenceImages = input.referenceImages.map((ref) => ({
      image: ref.image,
      referenceType: ref.referenceType,
    }));
  }
  if (input.parameters) {
    const p = input.parameters;
    if (p.aspectRatio) {
      parameters.aspectRatio = p.aspectRatio;
    }
    if (p.resolution) {
      parameters.resolution = p.resolution;
    }
    if (p.durationSeconds) {
      parameters.durationSeconds = p.durationSeconds;
    }
    if (p.seed !== undefined && p.seed !== 0) {
      parameters.seed = p.seed;
    }
    if (p.numberOfVideos) {
      parameters.numberOfVideos = p.numberOfVideos;
    }
    if (p.personGeneration) {
      parameters.personGeneration = p.personGeneration;
    }
  }

  const body: Record<string, unknown> = { instances: [instance] };
  if (Object.keys(parameters).length > 0) {
    body.parameters = parameters;
  }

  const json = await veoFetch(baseUrl, apiKey, `/models/${modelId}:predictLongRunning`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

  return VEO_START_RESPONSE_SCHEMA.parse(json).name;
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
