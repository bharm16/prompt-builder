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
        logger.error('Preview generation failed', {
          error: errorMessage,
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

        res.status(500).json({
          success: false,
          error: 'Image generation failed',
          message: errorMessage,
        });
      }
    })
  );

  return router;
}

