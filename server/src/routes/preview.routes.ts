/**
 * Preview Routes
 *
 * Handles image preview generation endpoints
 */

import type { Router, Request, Response } from 'express';
import express from 'express';
import { logger } from '@infrastructure/Logger';
import { extractUserId } from '@utils/requestHelpers';
import { asyncHandler } from '@middleware/asyncHandler';
import type { PreviewRoutesServices } from './types';

/**
 * Create preview routes
 */
export function createPreviewRoutes(services: PreviewRoutesServices): Router {
  const router = express.Router();

  const { imageGenerationService } = services;

  // POST /api/preview/generate - Generate image preview
  router.post(
    '/generate',
    asyncHandler(async (req: Request, res: Response) => {
      // Check if service is available
      if (!imageGenerationService) {
        return res.status(503).json({
          success: false,
          error: 'Image generation service is not available',
          message: 'REPLICATE_API_TOKEN is not configured',
        });
      }

      const { prompt, aspectRatio } = req.body as { prompt?: unknown; aspectRatio?: string };
      const userId = extractUserId(req);

      if (!prompt) {
        return res.status(400).json({
          success: false,
          error: 'Prompt is required',
        });
      }

      if (typeof prompt !== 'string' || prompt.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Prompt must be a non-empty string',
        });
      }

      const startTime = performance.now();
      const operation = 'generatePreview';
      const requestId = (req as Request & { id?: string }).id;
      
      logger.debug(`Starting ${operation}`, {
        operation,
        requestId,
        userId,
        promptLength: typeof prompt === 'string' ? prompt.length : 0,
        aspectRatio,
      });

      try {
        const normalizedAspectRatio =
          typeof aspectRatio === 'string' && aspectRatio.trim().length > 0
            ? aspectRatio
            : undefined;
        const result = await imageGenerationService.generatePreview(prompt, {
          userId,
          ...(normalizedAspectRatio ? { aspectRatio: normalizedAspectRatio } : {}),
        });

        logger.info(`${operation} completed`, {
          operation,
          requestId,
          userId,
          duration: Math.round(performance.now() - startTime),
        });

        return res.json({
          success: true,
          data: result,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const statusCode = (error as { statusCode?: number }).statusCode || 
                          (errorMessage.includes('402') ? 402 : 
                           errorMessage.includes('429') ? 429 : 500);
        
        logger.error(`${operation} failed`, error as Error, {
          operation,
          requestId,
          userId,
          duration: Math.round(performance.now() - startTime),
          statusCode,
          promptPreview: typeof prompt === 'string' ? prompt.substring(0, 100) : undefined,
        });

        // Check if it's a configuration error
        if (errorMessage.includes('not configured')) {
          return res.status(503).json({
            success: false,
            error: 'Image generation service is not available',
            message: errorMessage,
          });
        }

        // Handle payment required (402)
        if (statusCode === 402) {
          return res.status(402).json({
            success: false,
            error: 'Payment required',
            message: errorMessage,
          });
        }

        // Handle rate limiting (429)
        if (statusCode === 429) {
          return res.status(429).json({
            success: false,
            error: 'Rate limit exceeded',
            message: errorMessage,
          });
        }

        return res.status(statusCode).json({
          success: false,
          error: 'Image generation failed',
          message: errorMessage,
        });
      }
    })
  );

  return router;
}
