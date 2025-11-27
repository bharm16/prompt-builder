/**
 * Image Generation Service
 *
 * Handles image generation using Replicate's Flux Schnell model.
 * Provides low-fidelity preview images for prompt validation.
 */

import Replicate from 'replicate';
import { logger } from '@infrastructure/Logger';

/**
 * Image Generation Service
 * Wraps Replicate API calls for generating preview images
 */
export class ImageGenerationService {
  constructor(options = {}) {
    const apiToken = options.apiToken || process.env.REPLICATE_API_TOKEN;

    if (!apiToken) {
      logger.warn('REPLICATE_API_TOKEN not provided, image generation will be disabled');
      this.replicate = null;
    } else {
      this.replicate = new Replicate({
        auth: apiToken,
      });
    }

    // Flux Schnell model identifier
    this.model = 'black-forest-labs/flux-schnell';
  }

  /**
   * Generate a preview image from a prompt
   *
   * @param {string} prompt - The prompt text to generate an image from
   * @param {Object} options - Generation options
   * @param {string} options.aspectRatio - Aspect ratio (default: "16:9")
   * @param {string} options.userId - User ID for logging (optional)
   * @returns {Promise<Object>} Object with imageUrl and metadata
   * @throws {Error} If generation fails or service is not configured
   */
  async generatePreview(prompt, options = {}) {
    if (!this.replicate) {
      throw new Error('Image generation service is not configured. REPLICATE_API_TOKEN is required.');
    }

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      throw new Error('Prompt is required and must be a non-empty string');
    }

    const { aspectRatio = '16:9', userId = 'anonymous' } = options;

    // Map aspect ratio to Replicate's format
    // Flux Schnell supports: "1:1", "16:9", "21:9", "2:3", "3:2", "4:5", "5:4", "9:16", "9:21"
    const aspectRatioMap = {
      '16:9': '16:9',
      '1:1': '1:1',
      '21:9': '21:9',
      '2:3': '2:3',
      '3:2': '3:2',
      '4:5': '4:5',
      '5:4': '5:4',
      '9:16': '9:16',
      '9:21': '9:21',
    };

    const mappedAspectRatio = aspectRatioMap[aspectRatio] || '16:9';

    logger.info('Generating image preview', {
      prompt: prompt.substring(0, 100), // Log first 100 chars
      aspectRatio: mappedAspectRatio,
      userId,
    });

    try {
      const startTime = Date.now();

      // Call Replicate API
      const output = await this.replicate.run(this.model, {
        input: {
          prompt: prompt.trim(),
          aspect_ratio: mappedAspectRatio,
          output_format: 'webp',
          output_quality: 80, // Lower quality for faster generation
        },
      });

      const duration = Date.now() - startTime;

      // Replicate returns an array of URLs (usually one)
      const imageUrl = Array.isArray(output) ? output[0] : output;

      if (!imageUrl || typeof imageUrl !== 'string') {
        throw new Error('Invalid response from Replicate API: no image URL returned');
      }

      logger.info('Image preview generated successfully', {
        imageUrl: imageUrl.substring(0, 100), // Log partial URL
        duration,
        userId,
      });

      return {
        imageUrl,
        metadata: {
          aspectRatio: mappedAspectRatio,
          model: this.model,
          duration,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Image generation failed', {
        error: errorMessage,
        prompt: prompt.substring(0, 100),
        userId,
      });

      throw new Error(`Image generation failed: ${errorMessage}`);
    }
  }
}

