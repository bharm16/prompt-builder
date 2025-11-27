/**
 * Types for route factories
 */

import type { Router } from 'express';
import type { ImageGenerationService } from '../services/image-generation/ImageGenerationService.js';
import type { AIModelService } from '../services/ai-model/AIModelService.js';

/**
 * Services object for preview routes
 */
export interface PreviewRoutesServices {
  imageGenerationService: ImageGenerationService;
}

/**
 * Route factory return type
 */
export type RouteFactory = () => Router;

