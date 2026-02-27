import Replicate from 'replicate';
import OpenAI from 'openai';
import { LumaAI } from 'lumaai';
import type {
  KlingModelId,
  LumaModelId,
  SoraModelId,
  VideoGenerationOptions,
  VideoGenerationServiceOptions,
  VideoModelId,
} from '../types';
import type { StoredVideoAsset, VideoAssetStore } from '../storage';
import { storeVideoFromUrl } from '../storage/utils';
import { generateReplicateVideo } from './replicateProvider';
import { generateSoraVideo } from './soraProvider';
import { generateLumaVideo } from './lumaProvider';
import { generateKlingVideo, DEFAULT_KLING_BASE_URL } from './klingProvider';
import { generateVeoVideo, DEFAULT_VEO_BASE_URL } from './veoProvider';

type LogSink = {
  debug: (message: string, meta?: Record<string, unknown>) => void;
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, error?: Error, meta?: Record<string, unknown>) => void;
};

export type VideoProviderId = 'replicate' | 'openai' | 'luma' | 'kling' | 'gemini';

export interface VideoProvider {
  id: VideoProviderId;
  isAvailable: () => boolean;
  requiredKey?: string;
  generate: (
    prompt: string,
    modelId: VideoModelId,
    options: VideoGenerationOptions,
    assetStore: VideoAssetStore,
    log: LogSink
  ) => Promise<{ asset: StoredVideoAsset; seed?: number; resolvedAspectRatio?: string; providerCost?: { amount: number; currency: string; unit: string } }>;
}

export type VideoProviderMap = Record<VideoProviderId, VideoProvider>;

export function createVideoProviders(
  options: VideoGenerationServiceOptions,
  log: Pick<LogSink, 'warn'>
): VideoProviderMap {
  let replicate: Replicate | null = null;
  if (!options.apiToken) {
    log.warn('REPLICATE_API_TOKEN not provided, Replicate-based video generation will be disabled');
  } else {
    replicate = new Replicate({ auth: options.apiToken });
  }

  let openai: OpenAI | null = null;
  if (!options.openAIKey) {
    log.warn('OPENAI_API_KEY not provided, Sora video generation will be disabled');
  } else {
    openai = new OpenAI({ apiKey: options.openAIKey });
  }

  let luma: LumaAI | null = null;
  if (!options.lumaApiKey) {
    log.warn('LUMA_API_KEY or LUMAAI_API_KEY not provided, Luma video generation will be disabled');
  } else {
    luma = new LumaAI({ authToken: options.lumaApiKey });
  }

  let klingApiKey: string | null = null;
  if (!options.klingApiKey) {
    log.warn('KLING_API_KEY not provided, Kling video generation will be disabled');
  } else {
    klingApiKey = options.klingApiKey;
  }

  const klingBaseUrl = (options.klingBaseUrl || DEFAULT_KLING_BASE_URL).replace(/\/+$/, '');

  let geminiApiKey: string | null = null;
  if (!options.geminiApiKey) {
    log.warn('GEMINI_API_KEY not provided, Veo video generation will be disabled');
  } else {
    geminiApiKey = options.geminiApiKey;
  }

  const geminiBaseUrl = (options.geminiBaseUrl || DEFAULT_VEO_BASE_URL).replace(/\/+$/, '');

  const providers: VideoProviderMap = {
    replicate: {
      id: 'replicate',
      requiredKey: 'REPLICATE_API_TOKEN',
      isAvailable: () => Boolean(replicate),
      async generate(prompt, modelId, generationOptions, assetStore, providerLog) {
        if (!replicate) {
          throw new Error('Replicate API token is required for the selected video model.');
        }
        const { url, seed } = await generateReplicateVideo(
          replicate,
          prompt,
          modelId,
          generationOptions,
          providerLog
        );
        const asset = await storeVideoFromUrl(assetStore, url, providerLog);
        return { asset, ...(seed !== undefined ? { seed } : {}) };
      },
    },
    openai: {
      id: 'openai',
      requiredKey: 'OPENAI_API_KEY',
      isAvailable: () => Boolean(openai),
      async generate(prompt, modelId, generationOptions, assetStore, providerLog) {
        if (!openai) {
          throw new Error('Sora video generation requires OPENAI_API_KEY.');
        }
        const { asset, resolvedAspectRatio } = await generateSoraVideo(
          openai,
          prompt,
          modelId as SoraModelId,
          generationOptions,
          assetStore,
          providerLog
        );
        return { asset, ...(resolvedAspectRatio ? { resolvedAspectRatio } : {}) };
      },
    },
    luma: {
      id: 'luma',
      requiredKey: 'LUMA_API_KEY',
      isAvailable: () => Boolean(luma),
      async generate(prompt, _modelId, generationOptions, assetStore, providerLog) {
        if (!luma) {
          throw new Error('Luma video generation requires LUMA_API_KEY or LUMAAI_API_KEY.');
        }
        const url = await generateLumaVideo(luma, prompt, generationOptions, providerLog);
        const asset = await storeVideoFromUrl(assetStore, url, providerLog);
        return { asset };
      },
    },
    kling: {
      id: 'kling',
      requiredKey: 'KLING_API_KEY',
      isAvailable: () => Boolean(klingApiKey),
      async generate(prompt, modelId, generationOptions, assetStore, providerLog) {
        if (!klingApiKey) {
          throw new Error('Kling video generation requires KLING_API_KEY.');
        }
        const { url, resolvedAspectRatio } = await generateKlingVideo(
          klingApiKey,
          klingBaseUrl,
          prompt,
          modelId as KlingModelId,
          generationOptions,
          providerLog
        );
        const asset = await storeVideoFromUrl(assetStore, url, providerLog);
        return { asset, ...(resolvedAspectRatio ? { resolvedAspectRatio } : {}) };
      },
    },
    gemini: {
      id: 'gemini',
      requiredKey: 'GEMINI_API_KEY',
      isAvailable: () => Boolean(geminiApiKey),
      async generate(prompt, _modelId, generationOptions, assetStore, providerLog) {
        if (!geminiApiKey) {
          throw new Error('Veo video generation requires GEMINI_API_KEY.');
        }
        const asset = await generateVeoVideo(
          geminiApiKey,
          geminiBaseUrl,
          prompt,
          generationOptions,
          assetStore,
          providerLog
        );
        return { asset };
      },
    },
  };

  return providers;
}
