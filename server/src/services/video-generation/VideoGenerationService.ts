import Replicate from 'replicate';
import OpenAI from 'openai';
import { LumaAI } from 'lumaai';
import NodeCache from 'node-cache';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { logger } from '@infrastructure/Logger';
import { VIDEO_MODELS } from '@config/modelConfig';

interface ReplicateOptions {
  apiToken?: string;
  openAIKey?: string;
  lumaApiKey?: string;
  klingApiKey?: string;
  klingBaseUrl?: string;
  geminiApiKey?: string;
  geminiBaseUrl?: string;
}

type VideoModelKey = keyof typeof VIDEO_MODELS;
type VideoModelId = (typeof VIDEO_MODELS)[VideoModelKey];

interface VideoGenerationOptions {
  model?: VideoModelKey | VideoModelId;
  aspectRatio?: '16:9' | '9:16' | '21:9' | '1:1';
  numFrames?: number;
  fps?: number;
  negativePrompt?: string;
  startImage?: string;
  inputReference?: string;
  seconds?: '4' | '8' | '12';
  size?: string;
}

type KlingModelId = 'kling-v2-1-master';
type KlingAspectRatio = '16:9' | '9:16' | '1:1';

interface KlingTextToVideoInput {
  model_name?: KlingModelId;
  prompt: string;
  negative_prompt?: string;
  aspect_ratio?: KlingAspectRatio;
}

const DEFAULT_VIDEO_MODEL = VIDEO_MODELS.PRO || 'wan-video/wan-2.2-t2v-fast';
const VIDEO_MODEL_IDS = new Set<VideoModelId>(Object.values(VIDEO_MODELS) as VideoModelId[]);
const SORA_MODEL_ALIASES: Record<string, 'sora-2' | 'sora-2-pro'> = {
  'openai/sora-2': 'sora-2',
  'sora-2': 'sora-2',
  'sora-2-pro': 'sora-2-pro',
};

const KLING_MODEL_ALIASES: Record<string, 'kling-v2-1-master'> = {
  'kwaivgi/kling-v2.1': 'kling-v2-1-master',
  'kling-v2.1': 'kling-v2-1-master',
};

const VEO_MODEL_ALIASES: Record<string, 'google/veo-3'> = {
  'google/veo-3': 'google/veo-3',
  'veo-3': 'google/veo-3',
  'veo-3.1': 'google/veo-3',
  'veo-3.1-generate-preview': 'google/veo-3',
};

const SORA_SIZES_BY_ASPECT_RATIO: Record<string, string> = {
  '16:9': '1280x720',
  '9:16': '720x1280',
  '1:1': '1024x1024',
};

const SORA_STATUS_POLL_INTERVAL_MS = 2000;
const SORA_CONTENT_TTL_SECONDS = 60 * 10;
const LUMA_STATUS_POLL_INTERVAL_MS = 3000;
const KLING_STATUS_POLL_INTERVAL_MS = 2000;
const KLING_TASK_TIMEOUT_MS = 5 * 60 * 1000;
const KLING_DEFAULT_BASE_URL = 'https://api.klingai.com';
const VEO_STATUS_POLL_INTERVAL_MS = 10000;
const VEO_TASK_TIMEOUT_MS = 5 * 60 * 1000;
const VEO_DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const VEO_MODEL_ID = 'veo-3.1-generate-preview';

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

const VEO_START_RESPONSE_SCHEMA = z.object({
  name: z.string(),
});

const VEO_OPERATION_SCHEMA = z.object({
  name: z.string(),
  done: z.boolean().optional(),
  error: z.object({ message: z.string().optional() }).optional(),
  response: z.unknown().optional(),
});

interface StoredVideoContent {
  buffer: Buffer;
  contentType: string;
  createdAt: number;
}

/**
 * VideoGenerationService - Handles video generation using Replicate, OpenAI Sora, Luma, Kling, and Veo
 *
 * This service implements the 2025 hierarchy of video models,
 * primarily focusing on Wan 2.2 alongside select hosted providers.
 */
export class VideoGenerationService {
  private readonly replicate: Replicate | null;
  private readonly openai: OpenAI | null;
  private readonly luma: LumaAI | null;
  private readonly klingApiKey: string | null;
  private readonly klingBaseUrl: string;
  private readonly geminiApiKey: string | null;
  private readonly geminiBaseUrl: string;
  private readonly log = logger.child({ service: 'VideoGenerationService' });
  private readonly contentCache: NodeCache;

  constructor(options: ReplicateOptions) {
    if (!options.apiToken) {
      this.log.warn('REPLICATE_API_TOKEN not provided, Replicate-based video generation will be disabled');
      this.replicate = null;
    } else {
      this.replicate = new Replicate({
        auth: options.apiToken,
      });
    }

    if (!options.openAIKey) {
      this.log.warn('OPENAI_API_KEY not provided, Sora video generation will be disabled');
      this.openai = null;
    } else {
      this.openai = new OpenAI({ apiKey: options.openAIKey });
    }

    if (!options.lumaApiKey) {
      this.log.warn('LUMA_API_KEY or LUMAAI_API_KEY not provided, Luma video generation will be disabled');
      this.luma = null;
    } else {
      this.luma = new LumaAI({ authToken: options.lumaApiKey });
    }

    if (!options.klingApiKey) {
      this.log.warn('KLING_API_KEY not provided, Kling video generation will be disabled');
      this.klingApiKey = null;
    } else {
      this.klingApiKey = options.klingApiKey;
    }

    this.klingBaseUrl = (options.klingBaseUrl || KLING_DEFAULT_BASE_URL).replace(/\/+$/, '');

    if (!options.geminiApiKey) {
      this.log.warn('GEMINI_API_KEY not provided, Veo video generation will be disabled');
      this.geminiApiKey = null;
    } else {
      this.geminiApiKey = options.geminiApiKey;
    }

    this.geminiBaseUrl = (options.geminiBaseUrl || VEO_DEFAULT_BASE_URL).replace(/\/+$/, '');

    this.contentCache = new NodeCache({
      stdTTL: SORA_CONTENT_TTL_SECONDS,
      checkperiod: 120,
      useClones: false,
    });
  }

  /**
   * Generate a video from a prompt
   * 
   * @param prompt - The optimized prompt
   * @param options - Generation options (model, aspect ratio, etc.)
   * @returns URL of the generated video
   */
  async generateVideo(prompt: string, options: VideoGenerationOptions = {}): Promise<string> {
    const modelSelection = options.model || 'PRO';
    const modelId = this.resolveModelId(modelSelection);

    this.log.info('Starting video generation', {
      modelSelection,
      model: modelId,
      promptLength: prompt.length,
    });

    try {
      if (this.isOpenAISoraModel(modelId)) {
        return await this.generateSoraVideo(prompt, modelId, options);
      }

      if (this.isLumaModel(modelId)) {
        return await this.generateLumaVideo(prompt);
      }

      if (this.isKlingModel(modelId)) {
        return await this.generateKlingVideo(prompt, modelId, options);
      }

      if (this.isVeoModel(modelId)) {
        return await this.generateVeoVideo(prompt);
      }

      if (!this.replicate) {
        throw new Error('Replicate API token is required for the selected video model.');
      }

      const input = this.buildReplicateInput(modelId, prompt, options);

      this.log.info('Calling replicate.run', { modelId, input });

      // Use replicate.run() instead of predictions.create() + polling
      // casting modelId to any because the type definition might be strict about exact strings
      const output = (await this.replicate.run(modelId as any, { input })) as unknown;

      this.log.info('replicate.run finished', { 
        outputType: typeof output, 
        outputKeys: output && typeof output === 'object' ? Object.keys(output) : [],
        outputValue: typeof output === 'string' ? output : 'object' 
      });

      // Handle output
      if (typeof output === 'string') {
        // Direct URL string
        if (output.startsWith('http')) {
             return output;
        }
        // Maybe a path?
        this.log.warn('Output is a string but not http', { output });
      }

      // Check for file output with url() method (Replicate SDK v1.0.0+)
      if (output && typeof output === 'object') {
          // Check if it's a FileOutput object (has url method)
          if ('url' in output && typeof (output as any).url === 'function') {
              const url = (output as any).url();
              this.log.info('Extracted URL from FileOutput', { url: url.toString() });
              return url.toString();
          }
          
          // Check if it's a stream that we need to handle? 
          // Usually for web apps we want the URL. 
          // If replicate.run returns a stream, it might be because we requested a file.
          
          // If it is an array (some models return [url])
          if (Array.isArray(output) && output.length > 0 && typeof output[0] === 'string') {
              return output[0];
          }
      }

      // Fallback: If we can't extract a URL, log error and throw
      this.log.error('Could not extract video URL from output', undefined, { output });
      throw new Error('Invalid output format from Replicate: Could not extract video URL');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log.error('Video generation failed', error instanceof Error ? error : new Error(errorMessage));
      throw error;
    }
  }

  private resolveModelId(model?: VideoModelKey | VideoModelId): VideoModelId {
    if (!model) {
      return DEFAULT_VIDEO_MODEL;
    }

    if (Object.prototype.hasOwnProperty.call(VIDEO_MODELS, model)) {
      return VIDEO_MODELS[model as VideoModelKey];
    }

    if (typeof model === 'string' && Object.prototype.hasOwnProperty.call(SORA_MODEL_ALIASES, model)) {
      return SORA_MODEL_ALIASES[model];
    }

    if (typeof model === 'string' && Object.prototype.hasOwnProperty.call(KLING_MODEL_ALIASES, model)) {
      return KLING_MODEL_ALIASES[model];
    }

    if (typeof model === 'string' && Object.prototype.hasOwnProperty.call(VEO_MODEL_ALIASES, model)) {
      return VEO_MODEL_ALIASES[model];
    }

    if (model === 'luma') {
      return 'luma-ray3';
    }

    if (VIDEO_MODEL_IDS.has(model as VideoModelId)) {
      return model as VideoModelId;
    }

    this.log.warn('Unknown video model requested; falling back to default', { model });
    return DEFAULT_VIDEO_MODEL;
  }

  private isOpenAISoraModel(modelId: VideoModelId): modelId is 'sora-2' | 'sora-2-pro' {
    return modelId === 'sora-2' || modelId === 'sora-2-pro';
  }

  private isLumaModel(modelId: VideoModelId): modelId is 'luma-ray3' {
    return modelId === 'luma-ray3';
  }

  private isKlingModel(modelId: VideoModelId): modelId is KlingModelId {
    return modelId === 'kling-v2-1-master';
  }

  private isVeoModel(modelId: VideoModelId): modelId is 'google/veo-3' {
    return modelId === 'google/veo-3';
  }

  private buildReplicateInput(
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
      input.resolution = '480p'; // Default for fast model
      input.frames_per_second = options.fps || 16;
      input.sample_shift = 8; // User example used 12, I'll stick to 8 or 12. Let's use 8 as previously decided for stability, or 12 as per example.
      // User example used 12. Let's use 12 to match the "working" example.
      input.sample_shift = 12;
    }

    return input;
  }

  private resolveSoraSeconds(seconds?: VideoGenerationOptions['seconds']): '4' | '8' | '12' {
    if (seconds === '4' || seconds === '8' || seconds === '12') {
      return seconds;
    }
    return '8';
  }

  private resolveSoraSize(aspectRatio?: VideoGenerationOptions['aspectRatio'], sizeOverride?: string): string {
    if (sizeOverride) {
      return sizeOverride;
    }
    if (aspectRatio && !SORA_SIZES_BY_ASPECT_RATIO[aspectRatio]) {
      this.log.warn('Aspect ratio not mapped for Sora size; defaulting to 1280x720', { aspectRatio });
    }
    return SORA_SIZES_BY_ASPECT_RATIO[aspectRatio || '16:9'] || '1280x720';
  }

  private resolveKlingAspectRatio(
    aspectRatio?: VideoGenerationOptions['aspectRatio']
  ): KlingAspectRatio | undefined {
    if (!aspectRatio) {
      return undefined;
    }
    if (aspectRatio === '21:9') {
      this.log.warn('Kling does not support 21:9; using 16:9 instead', { aspectRatio });
      return '16:9';
    }
    if (aspectRatio !== '16:9' && aspectRatio !== '9:16' && aspectRatio !== '1:1') {
      this.log.warn('Unsupported Kling aspect ratio; defaulting to 16:9', { aspectRatio });
      return '16:9';
    }
    return aspectRatio;
  }

  private async generateLumaVideo(prompt: string): Promise<string> {
    if (!this.luma) {
      throw new Error('Luma video generation requires LUMA_API_KEY or LUMAAI_API_KEY.');
    }

    const generation = await this.luma.generations.create({ prompt });
    this.log.info('Luma generation started', { generationId: generation.id });

    let result = generation;
    while (result.state !== 'completed') {
      if (result.state === 'failed') {
        throw new Error('Luma generation failed');
      }
      await this.sleep(LUMA_STATUS_POLL_INTERVAL_MS);
      result = await this.luma.generations.get(generation.id);
    }

    const videoUrl = result.assets?.video;
    if (!videoUrl) {
      throw new Error('Luma generation completed without a video asset.');
    }

    return videoUrl;
  }

  private async generateKlingVideo(
    prompt: string,
    modelId: KlingModelId,
    options: VideoGenerationOptions
  ): Promise<string> {
    if (!this.klingApiKey) {
      throw new Error('Kling video generation requires KLING_API_KEY.');
    }

    const aspectRatio = this.resolveKlingAspectRatio(options.aspectRatio);
    const input: KlingTextToVideoInput = {
      model_name: modelId,
      prompt,
      ...(options.negativePrompt ? { negative_prompt: options.negativePrompt } : {}),
      ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
    };

    const taskId = await this.createKlingTask(input);
    this.log.info('Kling generation started', { modelId, taskId });

    return await this.waitForKlingVideo(taskId);
  }

  private async klingFetch(path: string, init: RequestInit): Promise<unknown> {
    if (!this.klingApiKey) {
      throw new Error('Kling video generation requires KLING_API_KEY.');
    }

    const response = await fetch(`${this.klingBaseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.klingApiKey}`,
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

  private async createKlingTask(input: KlingTextToVideoInput): Promise<string> {
    const json = await this.klingFetch('/v1/videos/text2video', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    const parsed = KLING_CREATE_TASK_RESPONSE_SCHEMA.parse(json);

    if (parsed.code !== 0) {
      throw new Error(`Kling error code=${parsed.code}: ${parsed.message ?? 'unknown error'}`);
    }

    return parsed.data.task_id;
  }

  private async getKlingTask(taskIdOrExternalId: string) {
    const json = await this.klingFetch(`/v1/videos/text2video/${encodeURIComponent(taskIdOrExternalId)}`, {
      method: 'GET',
    });
    const parsed = KLING_TASK_RESULT_RESPONSE_SCHEMA.parse(json);

    if (parsed.code !== 0) {
      throw new Error(`Kling error code=${parsed.code}: ${parsed.message ?? 'unknown error'}`);
    }

    return parsed.data;
  }

  private async waitForKlingVideo(
    taskId: string,
    options?: { timeoutMs?: number; pollMs?: number }
  ): Promise<string> {
    const timeoutMs = options?.timeoutMs ?? KLING_TASK_TIMEOUT_MS;
    const pollMs = options?.pollMs ?? KLING_STATUS_POLL_INTERVAL_MS;
    const start = Date.now();

    while (true) {
      const task = await this.getKlingTask(taskId);

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

      await this.sleep(pollMs);
    }
  }

  private async generateVeoVideo(prompt: string): Promise<string> {
    if (!this.geminiApiKey) {
      throw new Error('Veo video generation requires GEMINI_API_KEY.');
    }

    const operationName = await this.startVeoGeneration(prompt);
    this.log.info('Veo generation started', { operationName, model: VEO_MODEL_ID });

    const operation = await this.waitForVeoOperation(operationName);
    const videoUri = this.extractVeoVideoUri(operation.response);

    if (!videoUri) {
      throw new Error('Veo generation completed without a downloadable video URI.');
    }

    const { buffer, contentType } = await this.downloadVeoVideo(videoUri);
    const contentId = this.storeVideoContent(buffer, contentType);

    return this.buildContentUrl(contentId);
  }

  private async startVeoGeneration(prompt: string): Promise<string> {
    const json = await this.veoFetch(`/models/${VEO_MODEL_ID}:predictLongRunning`, {
      method: 'POST',
      body: JSON.stringify({
        instances: [{ prompt }],
      }),
    });

    const parsed = VEO_START_RESPONSE_SCHEMA.parse(json);
    return parsed.name;
  }

  private async waitForVeoOperation(operationName: string): Promise<z.infer<typeof VEO_OPERATION_SCHEMA>> {
    const timeoutMs = VEO_TASK_TIMEOUT_MS;
    const start = Date.now();
    const cleanedName = operationName.replace(/^\/+/, '');

    while (true) {
      const json = await this.veoFetch(`/${cleanedName}`, { method: 'GET' });
      const parsed = VEO_OPERATION_SCHEMA.parse(json);

      if (parsed.done) {
        if (parsed.error?.message) {
          throw new Error(`Veo generation failed: ${parsed.error.message}`);
        }
        return parsed;
      }

      if (Date.now() - start > timeoutMs) {
        throw new Error(`Timed out waiting for Veo operation ${operationName}`);
      }

      await this.sleep(VEO_STATUS_POLL_INTERVAL_MS);
    }
  }

  private extractVeoVideoUri(response: unknown): string | null {
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

  private async downloadVeoVideo(videoUri: string): Promise<{ buffer: Buffer; contentType: string }> {
    const response = await fetch(videoUri, {
      method: 'GET',
      headers: {
        'x-goog-api-key': this.geminiApiKey || '',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Veo download failed (${response.status}): ${text.slice(0, 400)}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'video/mp4';
    return { buffer: Buffer.from(arrayBuffer), contentType };
  }

  private async veoFetch(path: string, init: RequestInit): Promise<unknown> {
    if (!this.geminiApiKey) {
      throw new Error('Veo video generation requires GEMINI_API_KEY.');
    }

    const response = await fetch(`${this.geminiBaseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.geminiApiKey,
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

  private async generateSoraVideo(
    prompt: string,
    modelId: 'sora-2' | 'sora-2-pro',
    options: VideoGenerationOptions
  ): Promise<string> {
    if (!this.openai) {
      throw new Error('Sora video generation requires OPENAI_API_KEY.');
    }

    if (options.inputReference) {
      this.log.debug('Sora inputReference provided; OpenAI Sora API call is text-only for now.');
    }

    const seconds = this.resolveSoraSeconds(options.seconds);
    const size = this.resolveSoraSize(options.aspectRatio, options.size);

    const job = await this.openai.videos.create({
      model: modelId,
      prompt,
      seconds,
      size,
    });

    let video = job;
    while (video.status === 'queued' || video.status === 'running') {
      await this.sleep(SORA_STATUS_POLL_INTERVAL_MS);
      video = await this.openai.videos.retrieve(video.id);
    }

    if (video.status !== 'completed') {
      throw new Error(`Sora video failed: ${JSON.stringify(video.error ?? video)}`);
    }

    const response = await this.openai.videos.downloadContent(video.id);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentId = this.storeVideoContent(buffer, 'video/mp4');

    return this.buildContentUrl(contentId);
  }

  private storeVideoContent(buffer: Buffer, contentType: string): string {
    const id = uuidv4();
    const entry: StoredVideoContent = {
      buffer,
      contentType,
      createdAt: Date.now(),
    };
    this.contentCache.set(id, entry);
    return id;
  }

  private buildContentUrl(id: string): string {
    return `/api/preview/video/content/${id}`;
  }

  public getVideoContent(id: string): StoredVideoContent | null {
    const entry = this.contentCache.get<StoredVideoContent>(id);
    return entry ?? null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
