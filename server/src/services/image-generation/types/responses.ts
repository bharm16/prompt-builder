/**
 * Image generation response types
 */

/**
 * Image generation result
 */
export interface ImageGenerationResult {
  imageUrl: string;
  storagePath?: string;
  viewUrl?: string;
  viewUrlExpiresAt?: string;
  sizeBytes?: number;
  metadata: {
    aspectRatio: string;
    model: string;
    duration: number;
    generatedAt: string;
  };
}
