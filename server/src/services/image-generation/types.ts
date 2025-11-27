/**
 * Types for image generation service
 */

/**
 * Image generation options
 */
export interface ImageGenerationOptions {
  aspectRatio?: string;
  userId?: string;
}

/**
 * Image generation result
 */
export interface ImageGenerationResult {
  imageUrl: string;
  metadata: {
    aspectRatio: string;
    model: string;
    duration: number;
    generatedAt: string;
  };
}

/**
 * Image generation service options
 */
export interface ImageGenerationServiceOptions {
  apiToken?: string;
}

