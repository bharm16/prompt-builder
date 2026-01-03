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

  const { imageGenerationService, videoGenerationService } = services;

  // POST /api/preview/generate - Generate image preview
  router.post(
    '/generate',
    asyncHandler(async (req: Request, res: Response) => {
      // ... existing code ...
    })
  );

  // POST /api/preview/video/generate - Generate video preview
  router.post(
    '/video/generate',
    asyncHandler(async (req: Request, res: Response) => {
      // Check if service is available
      if (!videoGenerationService) {
        return res.status(503).json({
          success: false,
          error: 'Video generation service is not available',
          message: 'No video generation provider is configured',
        });
      }

      const { prompt, aspectRatio, model, startImage, inputReference } = req.body as { 
        prompt?: unknown; 
        aspectRatio?: '16:9' | '9:16' | '21:9' | '1:1';
        model?: string;
        startImage?: unknown;
        inputReference?: unknown;
      };
      const userId = extractUserId(req);

      if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Prompt must be a non-empty string',
        });
      }

      if (startImage !== undefined && typeof startImage !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'startImage must be a string URL',
        });
      }

      if (inputReference !== undefined && typeof inputReference !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'inputReference must be a string URL',
        });
      }

      const startTime = performance.now();
      const operation = 'generateVideoPreview';
      const requestId = (req as Request & { id?: string }).id;
      
      logger.debug(`Starting ${operation}`, {
        operation,
        requestId,
        userId,
        promptLength: prompt.length,
        aspectRatio,
        model,
      });

      try {
        const result = await videoGenerationService.generateVideo(prompt, {
          ...(aspectRatio ? { aspectRatio } : {}),
          ...(model ? { model: model as any } : {}),
          ...(startImage ? { startImage } : {}),
          ...(inputReference ? { inputReference } : {}),
        });

        logger.info(`${operation} completed`, {
          operation,
          requestId,
          userId,
          duration: Math.round(performance.now() - startTime),
        });

        return res.json({
          success: true,
          videoUrl: result,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const statusCode = (error as { statusCode?: number }).statusCode || 500;
        
        logger.error(`${operation} failed`, error as Error, {
          operation,
          requestId,
          userId,
          duration: Math.round(performance.now() - startTime),
          statusCode,
        });

        return res.status(statusCode).json({
          success: false,
          error: 'Video generation failed',
          message: errorMessage,
        });
      }
    })
  );

  // GET /api/preview/video/content/:contentId - Serve cached video bytes
  router.get(
    '/video/content/:contentId',
    asyncHandler(async (req: Request, res: Response) => {
      if (!videoGenerationService) {
        return res.status(503).json({
          success: false,
          error: 'Video generation service is not available',
        });
      }

      const { contentId } = req.params as { contentId?: string };
      if (!contentId) {
        return res.status(400).json({
          success: false,
          error: 'contentId is required',
        });
      }

      const entry = videoGenerationService.getVideoContent(contentId);
      if (!entry) {
        return res.status(404).json({
          success: false,
          error: 'Video content not found or expired',
        });
      }

      res.setHeader('Content-Type', entry.contentType);
      res.setHeader('Cache-Control', 'private, max-age=600');
      return res.send(entry.buffer);
    })
  );

  return router;
}
