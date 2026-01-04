import type { LumaAI } from 'lumaai';
import { sleep } from '../utils/sleep';

type LogSink = {
  info: (message: string, meta?: Record<string, unknown>) => void;
};

const LUMA_STATUS_POLL_INTERVAL_MS = 3000;

export async function generateLumaVideo(
  luma: LumaAI,
  prompt: string,
  log: LogSink
): Promise<string> {
  const generation = await luma.generations.create({ prompt });
  log.info('Luma generation started', { generationId: generation.id });

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
