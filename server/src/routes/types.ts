/**
 * Types for route factories
 */

import type { Router } from 'express';
import type { ImageGenerationService } from '@services/image-generation/ImageGenerationService';
import type { AIModelService } from '@services/ai-model/AIModelService';

/**
 * Services object for preview routes
 */
export interface PreviewRoutesServices {
  imageGenerationService: ImageGenerationService | null;
}

/**
 * Route factory return type
 */
export type RouteFactory = () => Router;

