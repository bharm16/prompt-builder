import type OpenAI from 'openai';
import type { ReadableStream } from 'node:stream/web';
import type { VideoGenerationOptions, SoraModelId } from '../types';
import { sleep } from '../utils/sleep';
import type { VideoAssetStore, StoredVideoAsset } from '../storage';
import { toNodeReadableStream } from '../storage/utils';

type LogSink = {
  debug: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  info: (message: string, meta?: Record<string, unknown>) => void;
};

const SORA_STATUS_POLL_INTERVAL_MS = 2000;
const SORA_SIZES_BY_ASPECT_RATIO: Record<string, string> = {
  '16:9': '1280x720',
  '9:16': '720x1280',
  '1:1': '1024x1024',
};

function resolveSoraSeconds(seconds?: VideoGenerationOptions['seconds']): '4' | '8' | '12' {
  if (seconds === '4' || seconds === '8' || seconds === '12') {
    return seconds;
  }
  return '8';
}

function resolveSoraSize(
  aspectRatio?: VideoGenerationOptions['aspectRatio'],
  sizeOverride?: string,
  log?: LogSink
): string {
  if (sizeOverride) {
    return sizeOverride;
  }
  if (aspectRatio && !SORA_SIZES_BY_ASPECT_RATIO[aspectRatio]) {
    log?.warn('Aspect ratio not mapped for Sora size; defaulting to 1280x720', { aspectRatio });
  }
  return SORA_SIZES_BY_ASPECT_RATIO[aspectRatio || '16:9'] || '1280x720';
}

export async function generateSoraVideo(
  openai: OpenAI,
  prompt: string,
  modelId: SoraModelId,
  options: VideoGenerationOptions,
  assetStore: VideoAssetStore,
  log: LogSink
): Promise<StoredVideoAsset> {
  if (options.inputReference) {
    log.debug('Sora inputReference provided; OpenAI Sora API call is text-only for now.');
  }

  const seconds = resolveSoraSeconds(options.seconds);
  const size = resolveSoraSize(options.aspectRatio, options.size, log);

  const job = await openai.videos.create({
    model: modelId,
    prompt,
    seconds,
    size,
  });

  let video = job;
  while (video.status === 'queued' || video.status === 'running') {
    await sleep(SORA_STATUS_POLL_INTERVAL_MS);
    video = await openai.videos.retrieve(video.id);
  }

  if (video.status !== 'completed') {
    throw new Error(`Sora video failed: ${JSON.stringify(video.error ?? video)}`);
  }

  const response = await openai.videos.downloadContent(video.id);
  const contentType = response.headers.get('content-type') || 'video/mp4';
  const stream = toNodeReadableStream(response.body as ReadableStream<Uint8Array> | null);
  return await assetStore.storeFromStream(stream, contentType);
}
