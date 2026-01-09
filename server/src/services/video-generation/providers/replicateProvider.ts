import type Replicate from 'replicate';
import type { VideoGenerationOptions, VideoModelId } from '../types';

type LogSink = {
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, error?: Error, meta?: Record<string, unknown>) => void;
};

const DEFAULT_WAN_NEGATIVE_PROMPT =
  'morphing, distorted, disfigured, text, watermark, low quality, blurry, static, extra limbs, fused fingers';

const WAN_ASPECT_RATIO_SIZE_MAP: Record<string, string> = {
  '16:9': '1280*720',
  '9:16': '720*1280',
  '1:1': '1024*1024',
  '4:3': '1024*768',
  '3:4': '768*1024',
};

function normalizeWanSize(rawSize: string): string | null {
  const cleaned = rawSize.trim().toLowerCase().replace(/\s+/g, '');
  if (!cleaned) {
    return null;
  }

  const match = cleaned.match(/^(\d{2,5})[x*](\d{2,5})$/);
  if (match) {
    return `${match[1]}*${match[2]}`;
  }

  return null;
}

function resolveWanSize(aspectRatio: string, rawSize?: string): string {
  if (typeof rawSize === 'string' && rawSize.trim().length > 0) {
    const cleaned = rawSize.trim().toLowerCase().replace(/\s+/g, '');
    if (!/^\d+p$/.test(cleaned)) {
      const normalized = normalizeWanSize(rawSize);
      if (normalized) {
        return normalized;
      }
    }
  }

  const normalizedAspectRatio = aspectRatio.trim();
  return (
    WAN_ASPECT_RATIO_SIZE_MAP[normalizedAspectRatio] ||
    WAN_ASPECT_RATIO_SIZE_MAP['16:9']
  );
}

export function buildReplicateInput(
  modelId: VideoModelId,
  prompt: string,
  options: VideoGenerationOptions
): Record<string, unknown> {
  const input: Record<string, unknown> = { prompt };

  const isWanModel = modelId.includes('wan');

  if (!isWanModel) {
    input.aspect_ratio = options.aspectRatio || '16:9';
    if (options.negativePrompt) {
      input.negative_prompt = options.negativePrompt;
    }
    return input;
  }

  const wanAspectRatio = options.aspectRatio || '16:9';
  const wanSize = resolveWanSize(wanAspectRatio, options.size);
  const wanNegativePrompt = options.negativePrompt || DEFAULT_WAN_NEGATIVE_PROMPT;

  input.negative_prompt = wanNegativePrompt;
  input.size = wanSize;
  input.num_frames = options.numFrames || 81;
  input.frames_per_second = options.fps || 16;
  input.prompt_extend = true;
  input.go_fast = true;
  input.sample_shift = 12;

  return input;
}

export async function generateReplicateVideo(
  replicate: Replicate,
  prompt: string,
  modelId: VideoModelId,
  options: VideoGenerationOptions,
  log: LogSink
): Promise<string> {
  const input = buildReplicateInput(modelId, prompt, options);

  log.info('Calling replicate.run', { modelId, input });

  const output = (await replicate.run(modelId as any, { input })) as unknown;

  log.info('replicate.run finished', {
    outputType: typeof output,
    outputKeys: output && typeof output === 'object' ? Object.keys(output) : [],
    outputValue: typeof output === 'string' ? output : 'object',
  });

  if (typeof output === 'string') {
    if (output.startsWith('http')) {
      return output;
    }
    log.warn('Output is a string but not http', { output });
  }

  if (output && typeof output === 'object') {
    if ('url' in output && typeof (output as any).url === 'function') {
      const url = (output as any).url();
      log.info('Extracted URL from FileOutput', { url: url.toString() });
      return url.toString();
    }

    if (Array.isArray(output) && output.length > 0 && typeof output[0] === 'string') {
      return output[0];
    }
  }

  log.error('Could not extract video URL from output', undefined, { output });
  throw new Error('Invalid output format from Replicate: Could not extract video URL');
}
