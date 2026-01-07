/**
 * Types for route factories
 */

import type { Router } from 'express';
import type { ImageGenerationService } from '@services/image-generation/ImageGenerationService';
import type { VideoGenerationService } from '@services/video-generation/VideoGenerationService';
import type { AIModelService } from '@services/ai-model/AIModelService';
import type { UserCreditService } from '@services/credits/UserCreditService';
import type { VideoJobStore } from '@services/video-generation/jobs/VideoJobStore';

/**
 * Services object for preview routes
 */
export interface PreviewRoutesServices {
  imageGenerationService: ImageGenerationService | null;
  videoGenerationService: VideoGenerationService | null;
  videoJobStore?: VideoJobStore | null;
  userCreditService?: UserCreditService | null;
}

/**
 * Route factory return type
 */
export type RouteFactory = () => Router;
