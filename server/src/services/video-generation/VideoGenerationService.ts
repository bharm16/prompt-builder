import { logger } from '@infrastructure/Logger';
import { createVideoAssetStore, type VideoAssetStore, type VideoAssetStream } from './storage';
import type {
  VideoAvailabilityReport,
  VideoGenerationOptions,
  VideoGenerationResult,
  VideoGenerationServiceOptions,
  VideoModelAvailability,
  VideoProviderAvailability,
} from './types';
import { createProviderClients, type ProviderClients } from './providers/ProviderClients';
import { getProviderAvailability } from './providers/ProviderRegistry';
import { generateVideoWorkflow } from './workflows/generateVideo';
import { getAvailabilityReport, getModelAvailability } from './availability';

/**
 * VideoGenerationService - Orchestrates video generation providers
 */
export class VideoGenerationService {
  private readonly clients: ProviderClients;
  private readonly log = logger.child({ service: 'VideoGenerationService' });
  private readonly assetStore: VideoAssetStore;

  constructor(options: VideoGenerationServiceOptions) {
    this.clients = createProviderClients(options, this.log);
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
    return await generateVideoWorkflow(prompt, options, this.clients, this.assetStore, this.log);
  }

  public async getVideoContent(id: string): Promise<VideoAssetStream | null> {
    return await this.assetStore.getStream(id);
  }

  public async getVideoUrl(id: string): Promise<string | null> {
    return await this.assetStore.getPublicUrl(id);
  }

  public getProviderAvailability(): VideoProviderAvailability {
    return getProviderAvailability(this.clients);
  }

  public getModelAvailability(model?: string | null): VideoModelAvailability {
    return getModelAvailability(model, this.getProviderAvailability(), this.log);
  }

  public getAvailabilityReport(modelIds: string[]): VideoAvailabilityReport {
    return getAvailabilityReport(modelIds, this.getProviderAvailability(), this.log);
  }
}
