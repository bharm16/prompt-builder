import { z } from 'zod';
import type { KlingAspectRatio, KlingModelId, VideoGenerationOptions } from '../types';
import { sleep } from '../utils/sleep';

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

export const DEFAULT_KLING_BASE_URL = 'https://api.klingai.com';

const KLING_STATUS_POLL_INTERVAL_MS = 2000;
const KLING_TASK_TIMEOUT_MS = 5 * 60 * 1000;

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

async function klingFetch(
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
    throw new Error(`HTTP ${response.status}: ${JSON.stringify(json).slice(0, 800)}`);
  }

  return json;
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

    if (Date.now() - start > KLING_TASK_TIMEOUT_MS) {
      throw new Error(`Timed out waiting for Kling task ${taskId}`);
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
  const aspectRatio = resolveKlingAspectRatio(options.aspectRatio, log);
  const input: KlingTextToVideoInput = {
    model_name: modelId,
    prompt,
    ...(options.negativePrompt ? { negative_prompt: options.negativePrompt } : {}),
    ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
  };

  const taskId = await createKlingTask(baseUrl, apiKey, input);
  log.info('Kling generation started', { modelId, taskId });

  return await waitForKlingVideo(baseUrl, apiKey, taskId);
}
