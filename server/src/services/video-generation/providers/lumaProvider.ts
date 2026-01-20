import type { LumaAI } from 'lumaai';
import { sleep } from '../utils/sleep';
import type { VideoGenerationOptions } from '../types';

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

function buildLumaKeyframes(options: VideoGenerationOptions): LumaKeyframes | undefined {
  if (!options.startImage) {
    return undefined;
  }

  return {
    frame0: {
      type: 'image',
      url: options.startImage,
    },
  };
}

export async function generateLumaVideo(
  luma: LumaAI,
  prompt: string,
  options: VideoGenerationOptions,
  log: LogSink
): Promise<string> {
  const keyframes = buildLumaKeyframes(options);

  const generation = await luma.generations.create({
    prompt,
    model: 'ray-2',
    ...(keyframes ? { keyframes } : {}),
  });
  if (!generation.id) {
    throw new Error('Luma generation did not return an id');
  }
  log.info('Luma generation started', {
    generationId: generation.id,
    hasStartImage: Boolean(options.startImage),
  });

  let result = generation;
  while (result.state !== 'completed') {
    if (result.state === 'failed') {
      throw new Error('Luma generation failed');
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
