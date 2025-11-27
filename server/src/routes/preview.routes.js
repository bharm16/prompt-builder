/**
 * Preview Routes
 *
 * Handles image preview generation endpoints
 */

import express from 'express';
import { logger } from '@infrastructure/Logger';
import { asyncHandler } from '../middleware/asyncHandler.js';

/**
 * Create preview routes
 * @param {Object} services - Service instances
 * @returns {Router} Express router
 */
export function createPreviewRoutes(services) {
  const router = express.Router();

  const { imageGenerationService } = services;

  // POST /api/preview/generate - Generate image preview
  router.post(
    '/generate',
    asyncHandler(async (req, res) => {
      const { prompt, aspectRatio } = req.body;
      const userId = req.user?.uid || req.apiKey || 'anonymous';

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

      try {
        const result = await imageGenerationService.generatePreview(prompt, {
          aspectRatio,
          userId,
        });

        res.json({
          success: true,
          data: result,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const statusCode = error.statusCode || (errorMessage.includes('402') ? 402 : errorMessage.includes('429') ? 429 : 500);
        
        logger.error('Preview generation failed', {
          error: errorMessage,
          statusCode,
          userId,
          prompt: prompt.substring(0, 100),
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

        res.status(statusCode).json({
          success: false,
          error: 'Image generation failed',
          message: errorMessage,
        });
      }
    })
  );

  return router;
}

