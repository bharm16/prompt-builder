import type { AssetService } from '@services/asset/AssetService';
import type { VideoGenerationService } from '@services/video-generation/VideoGenerationService';
import type { VideoGenerationOptions } from '@services/video-generation/types';
import type { FrameBridgeService } from './FrameBridgeService';
import type { StyleReferenceService } from './StyleReferenceService';
import type { StyleAnalysisService } from './StyleAnalysisService';
import type { StyleReference } from './types';

export class ContinuityMediaService {
  constructor(
    private frameBridge: FrameBridgeService,
    private styleReference: StyleReferenceService,
    private styleAnalysis: StyleAnalysisService,
    private videoGenerator: VideoGenerationService,
    private assetService: AssetService
  ) {}

  getVideoUrl(videoAssetId: string): ReturnType<VideoGenerationService['getVideoUrl']> {
    return this.videoGenerator.getVideoUrl(videoAssetId);
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
    shotId: string
  ): Promise<StyleReference> {
    const frame = await this.extractRepresentativeFrame(userId, videoId, videoUrl, shotId);
    return await this.createStyleReferenceFromVideo(videoId, frame);
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
    const response = await fetch(imageUrl);
    if (!response.ok) {
      return { width: 1920, height: 1080 };
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const metadata = await (await import('sharp')).default(buffer).metadata();
    return { width: metadata.width || 1920, height: metadata.height || 1080 };
  }
}
