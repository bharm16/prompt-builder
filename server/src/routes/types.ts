/**
 * Types for route factories
 */

import type { Router } from 'express';
import type { ImageGenerationService } from '@services/image-generation/ImageGenerationService';
import type { VideoGenerationService } from '@services/video-generation/VideoGenerationService';
import type { AIModelService } from '@services/ai-model/AIModelService';

/**
 * Services object for preview routes
 */
export interface PreviewRoutesServices {
  imageGenerationService: ImageGenerationService | null;
  videoGenerationService: VideoGenerationService | null;
}

/**
 * Route factory return type
 */
export type RouteFactory = () => Router;

