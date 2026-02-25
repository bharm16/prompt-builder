import type { LumaAI } from 'lumaai';
import { sleep } from '../utils/sleep';
import type { VideoGenerationOptions } from '../types';
import { getProviderPollTimeoutMs } from './timeoutPolicy';

type LogSink = {
  info: (message: string, meta?: Record<string, unknown>) => void;
};

const LUMA_STATUS_POLL_INTERVAL_MS = 3000;

interface LumaKeyframe {
  type: 'image';
  url: string;
}

interface LumaKeyframes {
  frame0?: LumaKeyframe;
  frame1?: LumaKeyframe;
}

type LumaAspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '21:9' | '9:21';

function resolveLumaAspectRatio(
  aspectRatio: VideoGenerationOptions['aspectRatio']
): LumaAspectRatio | undefined {
  if (
    aspectRatio === '16:9' ||
    aspectRatio === '9:16' ||
    aspectRatio === '1:1' ||
    aspectRatio === '21:9'
  ) {
    return aspectRatio;
  }
  return undefined;
}

export function buildLumaKeyframes(options: VideoGenerationOptions): LumaKeyframes | undefined {
  const hasStart = Boolean(options.startImage);
  const hasEnd = Boolean(options.endImage);

  if (!hasStart && !hasEnd) {
    return undefined;
  }

  const keyframes: LumaKeyframes = {};

  if (hasStart) {
    keyframes.frame0 = {
      type: 'image',
      url: options.startImage!,
    };
  }

  if (hasEnd) {
    keyframes.frame1 = {
      type: 'image',
      url: options.endImage!,
    };
  }

  return keyframes;
}

export async function generateLumaVideo(
  luma: LumaAI,
  prompt: string,
  options: VideoGenerationOptions,
  log: LogSink
): Promise<string> {
  const timeoutMs = getProviderPollTimeoutMs();
  const keyframes = buildLumaKeyframes(options);
  const aspectRatio = resolveLumaAspectRatio(options.aspectRatio);

  const generation = await luma.generations.create({
    prompt,
    model: 'ray-2',
    ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
    ...(keyframes ? { keyframes } : {}),
  });
  if (!generation.id) {
    throw new Error('Luma generation did not return an id');
  }
  log.info('Luma generation started', {
    generationId: generation.id,
    hasStartImage: Boolean(options.startImage),
    hasEndImage: Boolean(options.endImage),
    mode:
      options.endImage && options.startImage
        ? 'interpolation'
        : options.startImage
          ? 'i2v'
          : options.endImage
            ? 'end-frame-only'
            : 't2v',
  });

  let result = generation;
  const start = Date.now();
  while (result.state !== 'completed') {
    if (result.state === 'failed') {
      throw new Error('Luma generation failed');
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Timed out waiting for Luma generation ${generation.id}`);
    }
    await sleep(LUMA_STATUS_POLL_INTERVAL_MS);
    result = await luma.generations.get(generation.id);
  }

  const videoUrl = result.assets?.video;
  if (!videoUrl) {
    throw new Error('Luma generation completed without a video asset.');
  }

  return videoUrl;
}
