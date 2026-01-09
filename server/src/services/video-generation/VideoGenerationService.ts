import Replicate from 'replicate';
import OpenAI from 'openai';
import { LumaAI } from 'lumaai';
import { logger } from '@infrastructure/Logger';
import {
  isKlingModel,
  isLumaModel,
  isOpenAISoraModel,
  isVeoModel,
  resolveModelSelection,
} from './modelResolver';
import { generateReplicateVideo } from './providers/replicateProvider';
import { generateSoraVideo } from './providers/soraProvider';
import { generateLumaVideo } from './providers/lumaProvider';
import { generateKlingVideo, DEFAULT_KLING_BASE_URL } from './providers/klingProvider';
import { generateVeoVideo, DEFAULT_VEO_BASE_URL } from './providers/veoProvider';
import { createVideoAssetStore, type StoredVideoAsset, type VideoAssetStore, type VideoAssetStream } from './storage';
import { storeVideoFromUrl } from './storage/utils';
import type {
  VideoAvailabilityReport,
  VideoGenerationOptions,
  VideoGenerationResult,
  VideoGenerationServiceOptions,
  VideoModelId,
  VideoModelAvailability,
  VideoProviderAvailability,
} from './types';
import { AppError } from '@types/common';

/**
 * VideoGenerationService - Orchestrates video generation providers
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
  private readonly assetStore: VideoAssetStore;

  constructor(options: VideoGenerationServiceOptions) {
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

    this.klingBaseUrl = (options.klingBaseUrl || DEFAULT_KLING_BASE_URL).replace(/\/+$/, '');

    if (!options.geminiApiKey) {
      this.log.warn('GEMINI_API_KEY not provided, Veo video generation will be disabled');
      this.geminiApiKey = null;
    } else {
      this.geminiApiKey = options.geminiApiKey;
    }

    this.geminiBaseUrl = (options.geminiBaseUrl || DEFAULT_VEO_BASE_URL).replace(/\/+$/, '');
    this.assetStore = options.assetStore ?? createVideoAssetStore();
  }

  /**
   * Generate a video from a prompt
   *
   * @param prompt - The optimized prompt
   * @param options - Generation options (model, aspect ratio, etc.)
   * @returns Stored video asset details
   */
  async generateVideo(
    prompt: string,
    options: VideoGenerationOptions = {}
  ): Promise<VideoGenerationResult> {
    const modelSelection = typeof options.model === 'string' ? options.model.trim() : options.model;
    const availability = this.getModelAvailability(modelSelection);
    if (!availability.available) {
      throw new AppError(
        availability.message || 'Requested video model is not available',
        'VIDEO_MODEL_UNAVAILABLE',
        availability.statusCode || 424,
        {
          model: modelSelection || 'auto',
          reason: availability.reason,
          requiredKey: availability.requiredKey,
          resolvedModelId: availability.resolvedModelId,
        }
      );
    }

    const resolution = resolveModelSelection(modelSelection, this.log);
    const modelId = availability.resolvedModelId || resolution.modelId;

    this.log.info('Starting video generation', {
      modelSelection: modelSelection || 'auto',
      model: modelId,
      promptLength: prompt.length,
    });

    try {
      if (isOpenAISoraModel(modelId)) {
        if (!this.openai) {
          throw new Error('Sora video generation requires OPENAI_API_KEY.');
        }
        const asset = await generateSoraVideo(
          this.openai,
          prompt,
          modelId,
          options,
          this.assetStore,
          this.log
        );
        return this.formatResult(asset);
      }

      if (isLumaModel(modelId)) {
        if (!this.luma) {
          throw new Error('Luma video generation requires LUMA_API_KEY or LUMAAI_API_KEY.');
        }
        const url = await generateLumaVideo(this.luma, prompt, this.log);
        const asset = await storeVideoFromUrl(this.assetStore, url, this.log);
        return this.formatResult(asset);
      }

      if (isKlingModel(modelId)) {
        if (!this.klingApiKey) {
          throw new Error('Kling video generation requires KLING_API_KEY.');
        }
        const url = await generateKlingVideo(
          this.klingApiKey,
          this.klingBaseUrl,
          prompt,
          modelId,
          options,
          this.log
        );
        const asset = await storeVideoFromUrl(this.assetStore, url, this.log);
        return this.formatResult(asset);
      }

      if (isVeoModel(modelId)) {
        if (!this.geminiApiKey) {
          throw new Error('Veo video generation requires GEMINI_API_KEY.');
        }
        const asset = await generateVeoVideo(
          this.geminiApiKey,
          this.geminiBaseUrl,
          prompt,
          this.assetStore,
          this.log
        );
        return this.formatResult(asset);
      }

      if (!this.replicate) {
        throw new Error('Replicate API token is required for the selected video model.');
      }

      const url = await generateReplicateVideo(this.replicate, prompt, modelId, options, this.log);
      const asset = await storeVideoFromUrl(this.assetStore, url, this.log);
      return this.formatResult(asset);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log.error('Video generation failed', error instanceof Error ? error : new Error(errorMessage));
      throw error;
    }
  }

  public async getVideoContent(id: string): Promise<VideoAssetStream | null> {
    return await this.assetStore.getStream(id);
  }

  public async getVideoUrl(id: string): Promise<string | null> {
    return await this.assetStore.getPublicUrl(id);
  }

  public getProviderAvailability(): VideoProviderAvailability {
    return {
      replicate: !!this.replicate,
      openai: !!this.openai,
      luma: !!this.luma,
      kling: !!this.klingApiKey,
      gemini: !!this.geminiApiKey,
    };
  }

  public getModelAvailability(model?: string | null): VideoModelAvailability {
    const resolution = resolveModelSelection(model || undefined, this.log);
    const providers = this.getProviderAvailability();
    const isAuto =
      !model ||
      (typeof model === 'string' &&
        (model.trim().length === 0 || model.trim().toLowerCase() === 'auto'));
    const autoModelId = isAuto ? this.resolveAutoModelId(providers) : null;
    const resolvedId = autoModelId || resolution.modelId;

    if (isAuto && !autoModelId) {
      return {
        id: 'auto',
        available: false,
        reason: 'missing_credentials',
        statusCode: 424,
        message: 'No video generation providers are configured.',
      };
    }

    const normalizedModel = typeof model === 'string' ? model.trim().toLowerCase() : '';

    if (model && normalizedModel !== 'auto' && resolution.resolvedBy === 'default') {
      return {
        id: model,
        available: false,
        reason: 'unsupported_model',
        statusCode: 400,
        message: `Unknown video model: ${model}`,
      };
    }

    if (isOpenAISoraModel(resolvedId)) {
      if (!providers.openai) {
        return {
          id: model || resolvedId,
          available: false,
          reason: 'missing_credentials',
          requiredKey: 'OPENAI_API_KEY',
          resolvedModelId: resolvedId,
          statusCode: 424,
          message: 'Sora video generation requires OPENAI_API_KEY.',
        };
      }
      return { id: model || resolvedId, available: true, resolvedModelId: resolvedId };
    }

    if (isLumaModel(resolvedId)) {
      if (!providers.luma) {
        return {
          id: model || resolvedId,
          available: false,
          reason: 'missing_credentials',
          requiredKey: 'LUMA_API_KEY',
          resolvedModelId: resolvedId,
          statusCode: 424,
          message: 'Luma video generation requires LUMA_API_KEY or LUMAAI_API_KEY.',
        };
      }
      return { id: model || resolvedId, available: true, resolvedModelId: resolvedId };
    }

    if (isKlingModel(resolvedId)) {
      if (!providers.kling) {
        return {
          id: model || resolvedId,
          available: false,
          reason: 'missing_credentials',
          requiredKey: 'KLING_API_KEY',
          resolvedModelId: resolvedId,
          statusCode: 424,
          message: 'Kling video generation requires KLING_API_KEY.',
        };
      }
      return { id: model || resolvedId, available: true, resolvedModelId: resolvedId };
    }

    if (isVeoModel(resolvedId)) {
      if (!providers.gemini) {
        return {
          id: model || resolvedId,
          available: false,
          reason: 'missing_credentials',
          requiredKey: 'GEMINI_API_KEY',
          resolvedModelId: resolvedId,
          statusCode: 424,
          message: 'Veo video generation requires GEMINI_API_KEY.',
        };
      }
      return { id: model || resolvedId, available: true, resolvedModelId: resolvedId };
    }

    if (!providers.replicate) {
      return {
        id: model || resolvedId,
        available: false,
        reason: 'missing_credentials',
        requiredKey: 'REPLICATE_API_TOKEN',
        resolvedModelId: resolvedId,
        statusCode: 424,
        message: 'Replicate API token is required for the selected video model.',
      };
    }

    return { id: model || resolvedId, available: true, resolvedModelId: resolvedId };
  }

  private resolveAutoModelId(providers: VideoProviderAvailability): VideoModelId | null {
    if (providers.replicate) {
      return resolveModelSelection('PRO').modelId;
    }
    if (providers.openai) {
      return 'sora-2';
    }
    if (providers.luma) {
      return 'luma-ray3';
    }
    if (providers.kling) {
      return 'kling-v2-1-master';
    }
    if (providers.gemini) {
      return 'google/veo-3';
    }
    return null;
  }

  public getAvailabilityReport(modelIds: string[]): VideoAvailabilityReport {
    const providers = this.getProviderAvailability();
    const uniqueIds = Array.from(new Set(modelIds));
    const models = uniqueIds.map((id) => this.getModelAvailability(id));
    const availableModels = models.filter((model) => model.available).map((model) => model.id);
    return { providers, models, availableModels };
  }

  private formatResult(asset: StoredVideoAsset): VideoGenerationResult {
    return {
      assetId: asset.id,
      videoUrl: asset.url,
      contentType: asset.contentType,
    };
  }
}
