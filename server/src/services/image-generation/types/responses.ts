/**
 * Image generation response types
 */

/**
 * Image generation result
 */
export interface ImageGenerationResult {
  imageUrl: string;
  /**
   * Original provider URL (publicly accessible, e.g., Replicate CDN).
   * Use this for chaining operations like storyboard frames where the
   * next generation needs to reference the previous image.
   * Falls back to imageUrl if not stored separately.
   */
  providerUrl?: string;
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
