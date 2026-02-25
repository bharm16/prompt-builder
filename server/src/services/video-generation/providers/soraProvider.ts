import type OpenAI from 'openai';
import type { ReadableStream } from 'node:stream/web';
import type { VideoGenerationOptions, SoraModelId } from '../types';
import { sleep } from '../utils/sleep';
import type { VideoAssetStore, StoredVideoAsset } from '../storage';
import { toNodeReadableStream } from '../storage/utils';
import { getProviderPollTimeoutMs } from './timeoutPolicy';

type LogSink = {
  debug: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  info: (message: string, meta?: Record<string, unknown>) => void;
};

const SORA_STATUS_POLL_INTERVAL_MS = 2000;
type SoraVideoSize = '720x1280' | '1280x720' | '1024x1792' | '1792x1024';
const SORA_SIZES_BY_ASPECT_RATIO: Record<'16:9' | '9:16', SoraVideoSize> = {
  '16:9': '1280x720',
  '9:16': '720x1280',
};
const SORA_SIZES: SoraVideoSize[] = ['720x1280', '1280x720', '1024x1792', '1792x1024'];

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
): SoraVideoSize {
  if (sizeOverride) {
    if (SORA_SIZES.includes(sizeOverride as SoraVideoSize)) {
      return sizeOverride as SoraVideoSize;
    }
    log?.warn('Unsupported Sora size override; defaulting to 1280x720', { sizeOverride });
  }
  if (aspectRatio === '9:16') {
    return SORA_SIZES_BY_ASPECT_RATIO['9:16'];
  }
  if (aspectRatio === '1:1') {
    log?.warn('Sora does not support 1:1; defaulting to 1280x720', { aspectRatio });
  }
  return SORA_SIZES_BY_ASPECT_RATIO['16:9'];
}

async function resolveSoraInputReference(inputReference: string, log: LogSink): Promise<Response> {
  log.debug('Fetching Sora input reference', { inputReference });
  const response = await fetch(inputReference);
  if (!response.ok) {
    log.warn('Failed to fetch Sora input reference', {
      inputReference,
      status: response.status,
      statusText: response.statusText,
    });
    throw new Error(`Failed to fetch inputReference (${response.status})`);
  }
  return response;
}

export async function generateSoraVideo(
  openai: OpenAI,
  prompt: string,
  modelId: SoraModelId,
  options: VideoGenerationOptions,
  assetStore: VideoAssetStore,
  log: LogSink
): Promise<StoredVideoAsset> {
  const timeoutMs = getProviderPollTimeoutMs();
  const resolvedInputReference = options.inputReference || options.startImage;
  const inputReference = resolvedInputReference
    ? await resolveSoraInputReference(resolvedInputReference, log)
    : undefined;

  const seconds = resolveSoraSeconds(options.seconds);
  const size = resolveSoraSize(options.aspectRatio, options.size, log);

  const job = await openai.videos.create({
    model: modelId,
    prompt,
    seconds,
    size,
    ...(inputReference ? { input_reference: inputReference } : {}),
  });

  let video = job;
  const start = Date.now();
  while (video.status === 'queued' || video.status === 'in_progress') {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Timed out waiting for Sora video ${video.id}`);
    }
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
