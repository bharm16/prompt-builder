/**
 * Image Generation Service
 *
 * Handles image generation using Replicate's Flux Schnell model.
 * Provides low-fidelity preview images for prompt validation.
 */

import Replicate from 'replicate';
import { logger } from '@infrastructure/Logger.js';
import type { ImageGenerationOptions, ImageGenerationResult, ImageGenerationServiceOptions } from './types.js';

interface ReplicateClient {
  predictions: {
    create: (params: {
      model: string;
      input: {
        prompt: string;
        aspect_ratio: string;
        output_format: string;
        output_quality: number;
      };
    }) => Promise<ReplicatePrediction>;
    get: (id: string) => Promise<ReplicatePrediction>;
  };
}

interface ReplicatePrediction {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output: string | string[] | null | undefined;
  error?: string | null;
  logs?: string | null;
}

/**
 * Image Generation Service
 * Wraps Replicate API calls for generating preview images
 */
export class ImageGenerationService {
  private readonly replicate: ReplicateClient | null;
  private readonly model: string;

  constructor(options: ImageGenerationServiceOptions = {}) {
    const apiToken = options.apiToken || process.env.REPLICATE_API_TOKEN;

    if (!apiToken) {
      logger.warn('REPLICATE_API_TOKEN not provided, image generation will be disabled');
      this.replicate = null;
    } else {
      this.replicate = new Replicate({
        auth: apiToken,
      }) as ReplicateClient;
    }

    // Flux Schnell model identifier
    this.model = 'black-forest-labs/flux-schnell';
  }

  /**
   * Generate a preview image from a prompt
   */
  async generatePreview(
    prompt: string | null | undefined,
    options: ImageGenerationOptions = {}
  ): Promise<ImageGenerationResult> {
    if (!this.replicate) {
      throw new Error('Image generation service is not configured. REPLICATE_API_TOKEN is required.');
    }

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      throw new Error('Prompt is required and must be a non-empty string');
    }

    const { aspectRatio = '16:9', userId = 'anonymous' } = options;

    // Map aspect ratio to Replicate's format
    // Flux Schnell supports: "1:1", "16:9", "21:9", "2:3", "3:2", "4:5", "5:4", "9:16", "9:21"
    const aspectRatioMap: Record<string, string> = {
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

      // Use predictions API directly for better error handling and status visibility
      // Create the prediction
      const prediction = await this.replicate.predictions.create({
        model: this.model,
        input: {
          prompt: prompt.trim(),
          aspect_ratio: mappedAspectRatio,
          output_format: 'webp',
          output_quality: 80, // Lower quality for faster generation
        },
      });

      logger.info('Prediction created', {
        predictionId: prediction.id,
        status: prediction.status,
        userId,
      });

      // Poll until completion (with timeout)
      const maxWaitTime = 60000; // 60 seconds max
      const pollInterval = 1000; // Poll every second
      const endTime = Date.now() + maxWaitTime;
      let currentPrediction = prediction;
      
      while (Date.now() < endTime) {
        if (currentPrediction.status === 'succeeded') {
          break;
        } else if (currentPrediction.status === 'failed' || currentPrediction.status === 'canceled') {
          logger.error('Prediction failed', {
            predictionId: currentPrediction.id,
            status: currentPrediction.status,
            error: currentPrediction.error,
            logs: currentPrediction.logs,
            userId,
          });
          throw new Error(`Image generation failed: ${currentPrediction.error || 'Unknown error'}`);
        }
        
        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        
        // Get updated prediction status
        currentPrediction = await this.replicate.predictions.get(prediction.id);
        
        logger.debug('Polling prediction', {
          predictionId: currentPrediction.id,
          status: currentPrediction.status,
          userId,
        });
      }
      
      if (currentPrediction.status !== 'succeeded') {
        throw new Error(`Prediction timed out or failed. Status: ${currentPrediction.status}`);
      }

      const output = currentPrediction.output;
      const duration = Date.now() - startTime;

      // Check if output is null or undefined
      if (output === null || output === undefined) {
        logger.error('Replicate API returned null/undefined output', {
          userId,
          duration,
        });
        throw new Error('Replicate API returned no output. The image generation may have failed silently.');
      }

      // Log the raw output for debugging
      logger.info('Replicate API response received', {
        outputType: typeof output,
        isArray: Array.isArray(output),
        outputLength: Array.isArray(output) ? output.length : null,
        outputPreview: JSON.stringify(output, null, 2).substring(0, 1000),
        userId,
      });

      // Handle different response formats from Replicate
      // Flux Schnell typically returns an array with a single URL string
      let imageUrl: string | null = null;
      
      if (typeof output === 'string') {
        // Direct URL string
        imageUrl = output;
      } else if (Array.isArray(output)) {
        // Array of URLs or objects containing URLs
        // First, try to find a direct string URL
        const stringUrl = output.find(item => {
          if (typeof item === 'string') {
            return item.startsWith('http://') || item.startsWith('https://');
          }
          return false;
        });
        
        if (stringUrl) {
          imageUrl = stringUrl as string;
        } else {
          // If no string URL found, check if array contains objects with URL properties
          for (const item of output) {
            if (item && typeof item === 'object') {
              const itemObj = item as Record<string, unknown>;
              // Check common URL fields in the object
              const urlFromObject = itemObj.url || 
                                   itemObj.imageUrl || 
                                   itemObj.output || 
                                   itemObj.src ||
                                   (Array.isArray(itemObj.urls) ? itemObj.urls[0] : null) ||
                                   (Array.isArray(itemObj.files) ? itemObj.files[0] : null);
              
              if (urlFromObject && typeof urlFromObject === 'string' && 
                  (urlFromObject.startsWith('http://') || urlFromObject.startsWith('https://'))) {
                imageUrl = urlFromObject;
                break;
              }
              
              // Also check nested structures
              if (itemObj.output && typeof itemObj.output === 'string' && 
                  (itemObj.output.startsWith('http://') || itemObj.output.startsWith('https://'))) {
                imageUrl = itemObj.output;
                break;
              }
            }
          }
          
          // Last resort: if array has one element and it's an object, log it for debugging
          if (!imageUrl && output.length === 1 && typeof output[0] === 'object') {
            const firstItem = output[0] as Record<string, unknown>;
            const keys = Object.keys(firstItem);
            const values = Object.values(firstItem);
            const stringified = JSON.stringify(firstItem, null, 2);
            
            logger.warn('Array contains object but no URL found', {
              objectKeys: keys,
              objectValues: values,
              objectValue: stringified,
              objectType: typeof firstItem,
              isNull: firstItem === null,
              isEmpty: keys.length === 0,
              userId,
            });
            
            // Check if object has any non-enumerable properties or special cases
            if (keys.length === 0 && firstItem !== null) {
              logger.error('Empty object in array - possible Replicate API issue', {
                fullOutput: JSON.stringify(output, null, 2),
                userId,
              });
            }
          }
        }
      } else if (output && typeof output === 'object') {
        const outputObj = output as Record<string, unknown>;
        // Object response - check common fields
        // First check if it's a prediction object
        if ('status' in outputObj) {
          if (outputObj.status === 'succeeded' && outputObj.output) {
            // Prediction completed, extract from output field
            if (typeof outputObj.output === 'string') {
              imageUrl = outputObj.output;
            } else if (Array.isArray(outputObj.output)) {
              const url = outputObj.output.find(item => typeof item === 'string' && (item.startsWith('http://') || item.startsWith('https://'))) || outputObj.output[0];
              imageUrl = typeof url === 'string' ? url : null;
            }
          } else if (outputObj.status !== 'succeeded') {
            logger.warn('Prediction not completed', {
              status: outputObj.status,
              error: outputObj.error,
              output,
              userId,
            });
            throw new Error(`Image generation failed with status: ${outputObj.status}${outputObj.error ? '. ' + outputObj.error : ''}`);
          }
        }
        
        // Try other common fields
        if (!imageUrl) {
          const url = outputObj.url || 
                     outputObj.imageUrl || 
                     outputObj.output || 
                     (Array.isArray(outputObj.output) ? outputObj.output[0] : null) ||
                     (Array.isArray(outputObj.files) ? outputObj.files[0] : null) ||
                     (outputObj.urls && Array.isArray(outputObj.urls) ? outputObj.urls[0] : null);
          imageUrl = typeof url === 'string' ? url : null;
        }
        
        // If still no URL, check if output.output is a nested structure
        if (!imageUrl && outputObj.output) {
          if (typeof outputObj.output === 'string') {
            imageUrl = outputObj.output;
          } else if (Array.isArray(outputObj.output)) {
            const url = outputObj.output.find(item => typeof item === 'string' && (item.startsWith('http://') || item.startsWith('https://'))) || outputObj.output[0];
            imageUrl = typeof url === 'string' ? url : null;
          } else if (outputObj.output && typeof outputObj.output === 'object') {
            const nested = outputObj.output as Record<string, unknown>;
            imageUrl = typeof nested.url === 'string' ? nested.url : null;
          }
        }
      }

      // Validate that we have a valid URL string
      if (!imageUrl || typeof imageUrl !== 'string') {
        // Enhanced logging for debugging
        const errorDetails: Record<string, unknown> = {
          output: JSON.stringify(output, null, 2).substring(0, 2000),
          outputType: typeof output,
          isArray: Array.isArray(output),
          userId,
        };
        
        if (Array.isArray(output)) {
          errorDetails.arrayLength = output.length;
          errorDetails.arrayItems = output.map((item, idx) => ({
            index: idx,
            type: typeof item,
            isObject: typeof item === 'object' && item !== null,
            keys: typeof item === 'object' && item !== null ? Object.keys(item) : null,
            value: typeof item === 'object' ? JSON.stringify(item, null, 2).substring(0, 500) : String(item),
          }));
        } else if (output && typeof output === 'object') {
          errorDetails.outputKeys = Object.keys(output);
        }
        
        logger.error('Unexpected Replicate response format', errorDetails);
        
        // Provide a more helpful error message
        if (Array.isArray(output) && output.length > 0 && typeof output[0] === 'object' && Object.keys(output[0]).length === 0) {
          throw new Error('Replicate API returned an empty response. The image generation may have failed or the model is still processing. Please try again.');
        }
        
        throw new Error('Invalid response from Replicate API: no image URL returned. Response format: ' + typeof output + (output && typeof output === 'object' && !Array.isArray(output) ? ', keys: ' + Object.keys(output).join(', ') : ''));
      }

      // Validate URL format
      if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
        logger.error('Invalid URL format returned', {
          imageUrl: imageUrl.substring(0, 100),
          userId,
        });
        throw new Error('Invalid image URL format returned from Replicate API');
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
      
      // Parse Replicate API errors for better error messages
      let parsedError = errorMessage;
      let statusCode = 500;
      
      // Check for payment required (402)
      if (errorMessage.includes('402') || errorMessage.includes('Insufficient credit')) {
        statusCode = 402;
        try {
          // Try to extract JSON from error message
          const jsonMatch = errorMessage.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const errorData = JSON.parse(jsonMatch[0]) as { detail?: string; title?: string };
            parsedError = errorData.detail || errorData.title || 'Insufficient credit. Please add payment method to your Replicate account.';
          } else {
            parsedError = 'Insufficient credit. Please add payment method to your Replicate account.';
          }
        } catch {
          parsedError = 'Insufficient credit. Please add payment method to your Replicate account.';
        }
      }
      // Check for rate limiting (429)
      else if (errorMessage.includes('429') || errorMessage.includes('rate limit') || errorMessage.includes('throttled')) {
        statusCode = 429;
        try {
          const jsonMatch = errorMessage.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const errorData = JSON.parse(jsonMatch[0]) as { detail?: string };
            parsedError = errorData.detail || 'Rate limit exceeded. Please wait a moment and try again.';
          } else {
            parsedError = 'Rate limit exceeded. Please wait a moment and try again.';
          }
        } catch {
          parsedError = 'Rate limit exceeded. Please wait a moment and try again.';
        }
      }
      
      logger.error('Image generation failed', {
        error: errorMessage,
        parsedError,
        statusCode,
        prompt: prompt.substring(0, 100),
        userId,
      });

      const enhancedError = new Error(parsedError) as Error & { statusCode?: number };
      enhancedError.statusCode = statusCode;
      throw enhancedError;
    }
  }
}

