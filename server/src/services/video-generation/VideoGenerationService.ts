import Replicate from 'replicate';
import OpenAI from 'openai';
import { LumaAI } from 'lumaai';
import { logger } from '@infrastructure/Logger';
import { VideoContentStore } from './contentStore';
import {
  isKlingModel,
  isLumaModel,
  isOpenAISoraModel,
  isVeoModel,
  resolveModelId,
} from './modelResolver';
import { generateReplicateVideo } from './providers/replicateProvider';
import { generateSoraVideo } from './providers/soraProvider';
import { generateLumaVideo } from './providers/lumaProvider';
import { generateKlingVideo, DEFAULT_KLING_BASE_URL } from './providers/klingProvider';
import { generateVeoVideo, DEFAULT_VEO_BASE_URL } from './providers/veoProvider';
import type { ReplicateOptions, StoredVideoContent, VideoGenerationOptions } from './types';

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
  private readonly contentStore: VideoContentStore;

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

    this.klingBaseUrl = (options.klingBaseUrl || DEFAULT_KLING_BASE_URL).replace(/\/+$/, '');

    if (!options.geminiApiKey) {
      this.log.warn('GEMINI_API_KEY not provided, Veo video generation will be disabled');
      this.geminiApiKey = null;
    } else {
      this.geminiApiKey = options.geminiApiKey;
    }

    this.geminiBaseUrl = (options.geminiBaseUrl || DEFAULT_VEO_BASE_URL).replace(/\/+$/, '');

    this.contentStore = new VideoContentStore();
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
    const modelId = resolveModelId(modelSelection, this.log);

    this.log.info('Starting video generation', {
      modelSelection,
      model: modelId,
      promptLength: prompt.length,
    });

    try {
      if (isOpenAISoraModel(modelId)) {
        if (!this.openai) {
          throw new Error('Sora video generation requires OPENAI_API_KEY.');
        }
        return await generateSoraVideo(this.openai, prompt, modelId, options, this.contentStore, this.log);
      }

      if (isLumaModel(modelId)) {
        if (!this.luma) {
          throw new Error('Luma video generation requires LUMA_API_KEY or LUMAAI_API_KEY.');
        }
        return await generateLumaVideo(this.luma, prompt, this.log);
      }

      if (isKlingModel(modelId)) {
        if (!this.klingApiKey) {
          throw new Error('Kling video generation requires KLING_API_KEY.');
        }
        return await generateKlingVideo(this.klingApiKey, this.klingBaseUrl, prompt, modelId, options, this.log);
      }

      if (isVeoModel(modelId)) {
        if (!this.geminiApiKey) {
          throw new Error('Veo video generation requires GEMINI_API_KEY.');
        }
        return await generateVeoVideo(this.geminiApiKey, this.geminiBaseUrl, prompt, this.contentStore, this.log);
      }

      if (!this.replicate) {
        throw new Error('Replicate API token is required for the selected video model.');
      }

      return await generateReplicateVideo(this.replicate, prompt, modelId, options, this.log);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log.error('Video generation failed', error instanceof Error ? error : new Error(errorMessage));
      throw error;
    }
  }

  public getVideoContent(id: string): StoredVideoContent | null {
    return this.contentStore.get(id);
  }
}
