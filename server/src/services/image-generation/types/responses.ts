/**
 * Image generation response types
 */

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
