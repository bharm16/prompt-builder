import type Replicate from 'replicate';
import type { VideoGenerationOptions, VideoModelId } from '../types';

type LogSink = {
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, error?: Error, meta?: Record<string, unknown>) => void;
};

export function buildReplicateInput(
  modelId: VideoModelId,
  prompt: string,
  options: VideoGenerationOptions
): Record<string, unknown> {
  const input: Record<string, unknown> = { prompt };

  input.aspect_ratio = options.aspectRatio || '16:9';

  if (options.negativePrompt) {
    input.negative_prompt = options.negativePrompt;
  }

  // Wan 2.x specific parameters based on the fast model requirements
  if (modelId.includes('wan')) {
    input.num_frames = options.numFrames || 81;
    input.go_fast = true;
    input.resolution =
      typeof options.size === 'string' && /p$/i.test(options.size) ? options.size : '480p';
    input.frames_per_second = options.fps || 16;
    input.sample_shift = 12;
  }

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
