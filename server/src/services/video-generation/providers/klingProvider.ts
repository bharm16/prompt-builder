import { z } from 'zod';
import CircuitBreaker from 'opossum';
import type { KlingAspectRatio, KlingModelId, VideoGenerationOptions } from '../types';
import { sleep } from '../utils/sleep';
import { getProviderPollTimeoutMs } from './timeoutPolicy';

type LogSink = {
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
};

interface KlingTextToVideoInput {
  model_name?: KlingModelId;
  prompt: string;
  negative_prompt?: string;
  aspect_ratio?: KlingAspectRatio;
}

interface KlingImageToVideoInput {
  model_name?: KlingModelId;
  prompt: string;
  image: string;
  image_tail?: string;
  negative_prompt?: string;
  aspect_ratio?: KlingAspectRatio;
  duration?: '5' | '10';
  mode?: 'std' | 'pro';
}

export const DEFAULT_KLING_BASE_URL = 'https://api.klingai.com';

const KLING_STATUS_POLL_INTERVAL_MS = 2000;

const KLING_TASK_STATUS_SCHEMA = z.enum(['submitted', 'processing', 'succeed', 'failed']);

const KLING_CREATE_TASK_RESPONSE_SCHEMA = z.object({
  code: z.number(),
  message: z.string().optional(),
  request_id: z.string().optional(),
  data: z.object({
    task_id: z.string(),
    task_status: KLING_TASK_STATUS_SCHEMA,
    task_info: z.object({ external_task_id: z.string().optional() }).optional(),
    created_at: z.number().optional(),
    updated_at: z.number().optional(),
  }),
});

const KLING_I2V_CREATE_TASK_RESPONSE_SCHEMA = z.object({
  code: z.number(),
  message: z.string().optional(),
  request_id: z.string().optional(),
  data: z.object({
    task_id: z.string(),
    task_status: KLING_TASK_STATUS_SCHEMA,
  }),
});

const KLING_TASK_RESULT_RESPONSE_SCHEMA = z.object({
  code: z.number(),
  message: z.string().optional(),
  request_id: z.string().optional(),
  data: z.object({
    task_id: z.string(),
    task_status: KLING_TASK_STATUS_SCHEMA,
    task_status_msg: z.string().optional(),
    task_result: z
      .object({
        videos: z
          .array(
            z.object({
              id: z.string(),
              url: z.string(),
              duration: z.string().optional(),
            })
          )
          .optional(),
      })
      .optional(),
  }),
});

function resolveKlingAspectRatio(
  aspectRatio: VideoGenerationOptions['aspectRatio'],
  log: LogSink
): KlingAspectRatio | undefined {
  if (!aspectRatio) {
    return undefined;
  }
  if (aspectRatio === '21:9') {
    log.warn('Kling does not support 21:9; using 16:9 instead', { aspectRatio });
    return '16:9';
  }
  if (aspectRatio !== '16:9' && aspectRatio !== '9:16' && aspectRatio !== '1:1') {
    log.warn('Unsupported Kling aspect ratio; defaulting to 16:9', { aspectRatio });
    return '16:9';
  }
  return aspectRatio;
}

function resolveKlingDuration(seconds?: VideoGenerationOptions['seconds']): '5' | '10' | undefined {
  if (seconds === '5' || seconds === '10') {
    return seconds;
  }
  return undefined;
}

async function _rawKlingFetch(
  baseUrl: string,
  apiKey: string,
  path: string,
  init: RequestInit
): Promise<unknown> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
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
    // If it's a client error (4xx), we generally don't want to trip the breaker,
    // but throwing here will trip it by default unless we filter it in the breaker options.
    // For now, we allow it to bubble.
    throw new Error(`HTTP ${response.status}: ${JSON.stringify(json).slice(0, 800)}`);
  }

  return json;
}

const breaker = new CircuitBreaker(_rawKlingFetch, {
  timeout: 30000, // 30 seconds
  errorThresholdPercentage: 50,
  resetTimeout: 10000,
  name: 'KlingAPI',
});

// Don't trip on 4xx errors
breaker.fallback((error) => {
    // Re-throw if it's just the breaker mechanism
    if (error && error.message === 'Breaker is open') {
        throw new Error('Kling API Circuit Breaker Open');
    }
    throw error;
});

async function klingFetch(
  baseUrl: string,
  apiKey: string,
  path: string,
  init: RequestInit
): Promise<unknown> {
  return breaker.fire(baseUrl, apiKey, path, init);
}

async function createKlingTask(
  baseUrl: string,
  apiKey: string,
  input: KlingTextToVideoInput
): Promise<string> {
  const json = await klingFetch(baseUrl, apiKey, '/v1/videos/text2video', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  const parsed = KLING_CREATE_TASK_RESPONSE_SCHEMA.parse(json);

  if (parsed.code !== 0) {
    throw new Error(`Kling error code=${parsed.code}: ${parsed.message ?? 'unknown error'}`);
  }

  return parsed.data.task_id;
}

async function createKlingImageToVideoTask(
  baseUrl: string,
  apiKey: string,
  input: KlingImageToVideoInput
): Promise<string> {
  const json = await klingFetch(baseUrl, apiKey, '/v1/videos/image2video', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  const parsed = KLING_I2V_CREATE_TASK_RESPONSE_SCHEMA.parse(json);

  if (parsed.code !== 0) {
    throw new Error(`Kling i2v error code=${parsed.code}: ${parsed.message ?? 'unknown error'}`);
  }

  return parsed.data.task_id;
}

async function getKlingTask(baseUrl: string, apiKey: string, taskIdOrExternalId: string) {
  const json = await klingFetch(
    baseUrl,
    apiKey,
    `/v1/videos/text2video/${encodeURIComponent(taskIdOrExternalId)}`,
    {
      method: 'GET',
    }
  );
  const parsed = KLING_TASK_RESULT_RESPONSE_SCHEMA.parse(json);

  if (parsed.code !== 0) {
    throw new Error(`Kling error code=${parsed.code}: ${parsed.message ?? 'unknown error'}`);
  }

  return parsed.data;
}

async function waitForKlingVideo(
  baseUrl: string,
  apiKey: string,
  taskId: string
): Promise<string> {
  const timeoutMs = getProviderPollTimeoutMs();
  const start = Date.now();

  while (true) {
    const task = await getKlingTask(baseUrl, apiKey, taskId);

    if (task.task_status === 'succeed') {
      const url = task.task_result?.videos?.[0]?.url;
      if (!url) {
        throw new Error('Kling task succeeded but no video URL was returned.');
      }
      return url;
    }

    if (task.task_status === 'failed') {
      throw new Error(`Kling task failed: ${task.task_status_msg ?? 'no reason provided'}`);
    }

    if (Date.now() - start > timeoutMs) {
      throw new Error(`Timed out waiting for Kling task ${taskId}`);
    }

    await sleep(KLING_STATUS_POLL_INTERVAL_MS);
  }
}

async function waitForKlingImageToVideo(
  baseUrl: string,
  apiKey: string,
  taskId: string
): Promise<string> {
  const timeoutMs = getProviderPollTimeoutMs();
  const start = Date.now();

  while (true) {
    const json = await klingFetch(
      baseUrl,
      apiKey,
      `/v1/videos/image2video/${encodeURIComponent(taskId)}`,
      { method: 'GET' }
    );
    const parsed = KLING_TASK_RESULT_RESPONSE_SCHEMA.parse(json);

    if (parsed.code !== 0) {
      throw new Error(`Kling error code=${parsed.code}: ${parsed.message ?? 'unknown error'}`);
    }

    const task = parsed.data;

    if (task.task_status === 'succeed') {
      const url = task.task_result?.videos?.[0]?.url;
      if (!url) {
        throw new Error('Kling i2v task succeeded but no video URL was returned.');
      }
      return url;
    }

    if (task.task_status === 'failed') {
      throw new Error(`Kling i2v task failed: ${task.task_status_msg ?? 'no reason provided'}`);
    }

    if (Date.now() - start > timeoutMs) {
      throw new Error(`Timed out waiting for Kling i2v task ${taskId}`);
    }

    await sleep(KLING_STATUS_POLL_INTERVAL_MS);
  }
}

export async function generateKlingVideo(
  apiKey: string,
  baseUrl: string,
  prompt: string,
  modelId: KlingModelId,
  options: VideoGenerationOptions,
  log: LogSink
): Promise<string> {
  if (options.startImage) {
    return generateKlingImageToVideo(apiKey, baseUrl, prompt, modelId, options, log);
  }

  const aspectRatio = resolveKlingAspectRatio(options.aspectRatio, log);
  const input: KlingTextToVideoInput = {
    model_name: modelId,
    prompt,
    ...(options.negativePrompt ? { negative_prompt: options.negativePrompt } : {}),
    ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
  };

  const taskId = await createKlingTask(baseUrl, apiKey, input);
  log.info('Kling t2v generation started', { modelId, taskId });

  return await waitForKlingVideo(baseUrl, apiKey, taskId);
}

async function generateKlingImageToVideo(
  apiKey: string,
  baseUrl: string,
  prompt: string,
  modelId: KlingModelId,
  options: VideoGenerationOptions,
  log: LogSink
): Promise<string> {
  const aspectRatio = resolveKlingAspectRatio(options.aspectRatio, log);
  const duration = resolveKlingDuration(options.seconds);
  const input: KlingImageToVideoInput = {
    model_name: modelId,
    prompt,
    image: options.startImage!,
    ...(options.endImage ? { image_tail: options.endImage } : {}),
    ...(options.negativePrompt ? { negative_prompt: options.negativePrompt } : {}),
    ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
    ...(duration ? { duration } : {}),
  };

  const taskId = await createKlingImageToVideoTask(baseUrl, apiKey, input);
  log.info('Kling i2v generation started', {
    modelId,
    taskId,
    imageUrl: options.startImage,
    hasEndImage: Boolean(options.endImage),
  });

  return await waitForKlingImageToVideo(baseUrl, apiKey, taskId);
}
