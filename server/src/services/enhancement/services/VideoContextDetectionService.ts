/**
 * VideoContextDetectionService
 *
 * Detects video context and extracts video-specific information from prompts.
 * Handles model detection, section detection, phrase role analysis, and constraint generation.
 */

import { logger } from '@infrastructure/Logger';
import type {
  VideoService,
  VideoConstraints,
  EnhancementMetrics,
} from './types';

export interface VideoContextDetectionParams {
  fullPrompt: string;
  highlightedText: string;
  contextBefore: string;
  contextAfter: string;
  highlightedCategory: string | null;
  highlightedCategoryConfidence: number | null | undefined;
  metrics: EnhancementMetrics;
}

export interface VideoContextDetectionResult {
  isVideoPrompt: boolean;
  modelTarget: string | null;
  promptSection: string | null;
  highlightWordCount: number;
  phraseRole: string | null;
  videoConstraints: VideoConstraints | null;
}

/**
 * Service for detecting video context and extracting video-specific information
 */
export class VideoContextDetectionService {
  constructor(private readonly videoService: VideoService) {}

  /**
   * Detect video context and extract video-specific information
   */
  detectVideoContext(params: VideoContextDetectionParams): VideoContextDetectionResult {
    const isVideoPrompt = this.videoService.isVideoPrompt(params.fullPrompt);
    const highlightWordCount = this.videoService.countWords(params.highlightedText);
    const phraseRole = isVideoPrompt
      ? this.videoService.detectVideoPhraseRole(
          params.highlightedText,
          params.contextBefore,
          params.contextAfter,
          params.highlightedCategory
        )
      : null;
    const videoConstraints = isVideoPrompt
      ? this.videoService.getVideoReplacementConstraints({
          highlightWordCount,
          phraseRole,
          highlightedText: params.highlightedText,
          highlightedCategory: params.highlightedCategory,
          highlightedCategoryConfidence: params.highlightedCategoryConfidence ?? null,
        })
      : null;

    let modelTarget: string | null = null;
    let promptSection: string | null = null;

    if (isVideoPrompt) {
      const modelStart = Date.now();
      modelTarget = this.videoService.detectTargetModel(params.fullPrompt);
      params.metrics.modelDetection = Date.now() - modelStart;

      const sectionStart = Date.now();
      promptSection = this.videoService.detectPromptSection(
        params.highlightedText,
        params.fullPrompt,
        params.contextBefore
      );
      params.metrics.sectionDetection = Date.now() - sectionStart;
    }

    logger.debug('Model and section detection', {
      isVideoPrompt,
      modelTarget: modelTarget || 'none detected',
      promptSection: promptSection || 'main_prompt',
      modelDetectionTime: params.metrics.modelDetection,
      sectionDetectionTime: params.metrics.sectionDetection,
    });

    return {
      isVideoPrompt,
      modelTarget,
      promptSection,
      highlightWordCount,
      phraseRole,
      videoConstraints,
    };
  }
}

