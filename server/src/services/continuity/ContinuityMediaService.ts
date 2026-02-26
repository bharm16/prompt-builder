import type { AssetService } from '@services/asset/AssetService';
import type { VideoGenerationService } from '@services/video-generation/VideoGenerationService';
import type { VideoGenerationOptions } from '@services/video-generation/types';
import type { StorageService } from '@services/storage/StorageService';
import { logger } from '@infrastructure/Logger';
import { spawnSync } from 'node:child_process';
import { assertUrlSafe } from '@server/shared/urlValidation';
import type { FrameBridgeService } from './FrameBridgeService';
import type { StyleReferenceService } from './StyleReferenceService';
import type { StyleAnalysisService } from './StyleAnalysisService';
import type { StyleReference } from './types';

export class ContinuityMediaService {
  private readonly log = logger.child({ service: 'ContinuityMediaService' });
  private static mediaBinaryProbeDone = false;

  constructor(
    private frameBridge: FrameBridgeService,
    private styleReference: StyleReferenceService,
    private styleAnalysis: StyleAnalysisService,
    private videoGenerator: VideoGenerationService,
    private assetService: AssetService,
    private storageService: StorageService
  ) {
    this.probeMediaBinaries();
  }

  async getVideoUrl(
    videoAssetId: string,
    userId?: string
  ): ReturnType<VideoGenerationService['getVideoUrl']> {
    const trimmedId = typeof videoAssetId === 'string' ? videoAssetId.trim() : '';
    if (!trimmedId) {
      return null;
    }

    const directUrl = await this.videoGenerator.getVideoUrl(trimmedId);
    if (directUrl) {
      return directUrl;
    }

    if (!userId || !trimmedId.startsWith('users/')) {
      return null;
    }

    try {
      const signed = await this.storageService.getViewUrl(userId, trimmedId);
      return signed.viewUrl || null;
    } catch (error) {
      this.log.warn('Failed to resolve continuity source from storage path', {
        userId,
        storagePath: trimmedId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  generateVideo(
    prompt: string,
    options: VideoGenerationOptions
  ): ReturnType<VideoGenerationService['generateVideo']> {
    return this.videoGenerator.generateVideo(prompt, options);
  }

  extractBridgeFrame(
    userId: string,
    videoId: string,
    videoUrl: string,
    shotId: string,
    position: Parameters<FrameBridgeService['extractBridgeFrame']>[4] = 'last'
  ): ReturnType<FrameBridgeService['extractBridgeFrame']> {
    return this.frameBridge.extractBridgeFrame(userId, videoId, videoUrl, shotId, position);
  }

  extractRepresentativeFrame(
    userId: string,
    videoId: string,
    videoUrl: string,
    shotId: string
  ): ReturnType<FrameBridgeService['extractRepresentativeFrame']> {
    return this.frameBridge.extractRepresentativeFrame(userId, videoId, videoUrl, shotId);
  }

  createStyleReferenceFromVideo(
    videoId: string,
    frame: Parameters<StyleReferenceService['createFromVideo']>[1]
  ): ReturnType<StyleReferenceService['createFromVideo']> {
    return this.styleReference.createFromVideo(videoId, frame);
  }

  async createStyleReferenceFromVideoAsset(
    userId: string,
    videoId: string,
    videoUrl: string,
    shotId: string,
    fallbackImageUrl?: string
  ): Promise<StyleReference> {
    try {
      const frame = await this.extractRepresentativeFrame(userId, videoId, videoUrl, shotId);
      return await this.createStyleReferenceFromVideo(videoId, frame);
    } catch (error) {
      if (!this.isMissingMediaBinary(error)) {
        throw error;
      }

      this.log.warn('Falling back to synthetic style reference because ffmpeg/ffprobe is unavailable', {
        userId,
        videoId,
        shotId,
        error: error instanceof Error ? error.message : String(error),
      });

      const trimmedFallbackImageUrl =
        typeof fallbackImageUrl === 'string' ? fallbackImageUrl.trim() : '';
      if (trimmedFallbackImageUrl) {
        try {
          return await this.createStyleReferenceFromImage(trimmedFallbackImageUrl);
        } catch (fallbackError) {
          this.log.warn('Source image fallback failed during style reference creation', {
            userId,
            videoId,
            shotId,
            sourceImageUrl: trimmedFallbackImageUrl,
            error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
          });
        }
      }

      const fallbackFrame: Parameters<StyleReferenceService['createFromVideo']>[1] = {
        id: `frame_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        sourceVideoId: videoId,
        sourceShotId: shotId,
        frameUrl: videoUrl,
        framePosition: 'representative',
        frameTimestamp: 0,
        resolution: { width: 1920, height: 1080 },
        aspectRatio: '16:9',
        extractedAt: new Date(),
      };

      return await this.createStyleReferenceFromVideo(videoId, fallbackFrame);
    }
  }

  async createStyleReferenceFromImage(sourceImageUrl: string): Promise<StyleReference> {
    const resolution = await this.resolveImageResolution(sourceImageUrl);
    return await this.styleReference.createFromImage(sourceImageUrl, resolution);
  }

  generateStyledKeyframe(
    payload: Parameters<StyleReferenceService['generateStyledKeyframe']>[0]
  ): ReturnType<StyleReferenceService['generateStyledKeyframe']> {
    return this.styleReference.generateStyledKeyframe(payload);
  }

  async analyzeStyleReference(styleReference: StyleReference): Promise<StyleReference> {
    if (this.isUnsupportedAnalysisUrl(styleReference.frameUrl)) {
      styleReference.analysisMetadata = {
        dominantColors: [],
        lightingDescription: 'Unable to analyze',
        moodDescription: 'Unable to analyze',
        confidence: 0,
      };
      return styleReference;
    }

    styleReference.analysisMetadata = await this.styleAnalysis.analyzeForDisplay(styleReference.frameUrl);
    return styleReference;
  }

  async getCharacterReferenceUrl(userId: string, assetId: string): Promise<string> {
    const character = await this.assetService.getAssetForGeneration(userId, assetId);
    if (!character.primaryImageUrl) {
      throw new Error('Character has no primary reference image');
    }
    return character.primaryImageUrl;
  }

  private async resolveImageResolution(imageUrl: string): Promise<{ width: number; height: number }> {
    assertUrlSafe(imageUrl, 'sourceImageUrl');
    const response = await fetch(imageUrl);
    if (!response.ok) {
      return { width: 1920, height: 1080 };
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const metadata = await (await import('sharp')).default(buffer).metadata();
    return { width: metadata.width || 1920, height: metadata.height || 1080 };
  }

  private isMissingMediaBinary(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      return true;
    }

    const message = error.message.toLowerCase();
    return message.includes('spawn ffprobe enoent') || message.includes('spawn ffmpeg enoent');
  }

  private isUnsupportedAnalysisUrl(url: string): boolean {
    const normalized = url.trim().toLowerCase();
    if (!normalized) {
      return true;
    }

    if (normalized.startsWith('data:video/')) {
      return true;
    }

    return /\.(mp4|mov|webm|m4v|mkv|avi)(\?|#|$)/i.test(normalized);
  }

  private probeMediaBinaries(): void {
    if (ContinuityMediaService.mediaBinaryProbeDone) {
      return;
    }
    ContinuityMediaService.mediaBinaryProbeDone = true;

    const ffprobeAvailable = this.hasExecutable('ffprobe');
    const ffmpegAvailable = this.hasExecutable('ffmpeg');

    if (ffprobeAvailable && ffmpegAvailable) {
      return;
    }

    this.log.warn('Continuity media extraction binaries missing in runtime', {
      ffprobeAvailable,
      ffmpegAvailable,
      environment: process.env.NODE_ENV || 'unknown',
      guidance: 'Install ffmpeg package in the runtime image (includes ffprobe).',
    });
  }

  private hasExecutable(command: string): boolean {
    const result = spawnSync(command, ['-version'], { stdio: 'ignore' });
    return !result.error && result.status === 0;
  }
}
