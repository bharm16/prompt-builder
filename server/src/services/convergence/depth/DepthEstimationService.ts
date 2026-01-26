/**
 * DepthEstimationService for Visual Convergence
 *
 * Integrates with Replicate API to run Depth Anything v2 model for depth map generation.
 * Used to create depth maps from images for client-side camera motion rendering.
 *
 * Requirements:
 * - 5.1: Generate depth map from last generated image using Depth Anything v2
 * - 5.2: Use Replicate API to run the depth estimation model
 * - 5.5: If depth estimation fails, offer text-only camera motion selection as fallback
 *
 * @module convergence/depth
 */

import Replicate from 'replicate';
import { logger } from '@infrastructure/Logger';
import { withRetry } from '../helpers';
import type { StorageService } from '../storage';

// ============================================================================
// Configuration
// ============================================================================

/**
 * Alternative model identifier (shorter version that Replicate resolves)
 */
const DEPTH_MODEL_SHORT = 'cjwbw/depth-anything-v2' as const;

/**
 * Configuration for depth estimation
 */
const DEPTH_ESTIMATION_CONFIG = {
  /** Maximum retries for API calls */
  maxRetries: 2,
  /** Base delay for exponential backoff (ms) */
  baseDelayMs: 1000,
  /** Timeout for depth estimation (5 minutes) */
  timeoutMs: 5 * 60 * 1000,
} as const;

// ============================================================================
// Interface
// ============================================================================

/**
 * Interface for depth estimation operations.
 * Abstracts the Replicate API integration for easier testing.
 */
export interface DepthEstimationService {
  /**
   * Generate a depth map from an image URL
   *
   * @param imageUrl - URL of the source image (GCS URL)
   * @returns URL of the generated depth map (GCS URL after upload)
   * @throws Error if depth estimation fails after retries
   */
  estimateDepth(imageUrl: string): Promise<string>;

  /**
   * Check if the depth estimation service is available
   * (i.e., API token is configured)
   *
   * @returns true if the service can be used
   */
  isAvailable(): boolean;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * Options for creating a DepthEstimationService
 */
export interface DepthEstimationServiceOptions {
  /** Replicate API token (defaults to REPLICATE_API_TOKEN env var) */
  apiToken?: string | undefined;
  /** Storage service for persisting depth maps to GCS */
  storageService: StorageService;
  /** User ID for storage path organization */
  userId?: string | undefined;
}

/**
 * Replicate-based implementation of DepthEstimationService.
 *
 * Uses Depth Anything v2 model to generate depth maps from images.
 * Depth maps are uploaded to GCS and served via signed URLs.
 */
export class ReplicateDepthEstimationService implements DepthEstimationService {
  private readonly log = logger.child({ service: 'DepthEstimationService' });
  private readonly replicate: Replicate | null;
  private readonly storageService: StorageService;
  private readonly userId: string;

  constructor(options: DepthEstimationServiceOptions) {
    const apiToken = options.apiToken || process.env.REPLICATE_API_TOKEN;

    if (apiToken) {
      this.replicate = new Replicate({ auth: apiToken });
    } else {
      this.replicate = null;
      this.log.warn('REPLICATE_API_TOKEN not provided, depth estimation will be unavailable');
    }

    this.storageService = options.storageService;
    this.userId = options.userId || 'anonymous';
  }

  /**
   * Check if the depth estimation service is available
   */
  isAvailable(): boolean {
    return this.replicate !== null;
  }

  /**
   * Generate a depth map from an image URL
   *
   * Uses Depth Anything v2 via Replicate API with retry logic.
   * The resulting depth map is uploaded to GCS and returned as a signed URL.
   *
   * @param imageUrl - URL of the source image
   * @returns Signed GCS URL of the generated depth map
   * @throws Error if depth estimation fails after retries
   */
  async estimateDepth(imageUrl: string): Promise<string> {
    if (!this.replicate) {
      throw new Error('Depth estimation service is not available: missing API token');
    }

    const startTime = Date.now();
    this.log.info('Starting depth estimation', {
      imageUrlHost: this.getUrlHost(imageUrl),
    });

    try {
      // Use withRetry for resilience (Requirement 5.5 fallback handled by caller)
      const depthMapTempUrl = await withRetry(
        () => this.runDepthEstimation(imageUrl),
        DEPTH_ESTIMATION_CONFIG.maxRetries,
        DEPTH_ESTIMATION_CONFIG.baseDelayMs
      );

      // Upload depth map to GCS and generate a signed URL
      const destination = `convergence/${this.userId}/depth/${Date.now()}-depth.png`;
      const signedUrl = await this.storageService.upload(depthMapTempUrl, destination);

      const duration = Date.now() - startTime;
      this.log.info('Depth estimation completed', {
        duration,
        signedUrl,
      });

      return signedUrl;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.log.error('Depth estimation failed', error as Error, {
        imageUrlHost: this.getUrlHost(imageUrl),
        duration,
      });
      throw error;
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Run the depth estimation model on Replicate
   *
   * @param imageUrl - URL of the source image
   * @returns Temporary URL of the generated depth map
   */
  private async runDepthEstimation(imageUrl: string): Promise<string> {
    if (!this.replicate) {
      throw new Error('Replicate client not initialized');
    }

    this.log.debug('Calling Replicate depth estimation', {
      model: DEPTH_MODEL_SHORT,
      imageUrlHost: this.getUrlHost(imageUrl),
    });

    const input = {
      image: imageUrl,
    };

    const output = await this.replicate.run(
      DEPTH_MODEL_SHORT as `${string}/${string}`,
      { input }
    );

    this.log.debug('Replicate depth estimation response', {
      outputType: typeof output,
      outputKeys: output && typeof output === 'object' ? Object.keys(output) : [],
    });

    // Extract URL from output
    const depthMapUrl = this.extractUrlFromOutput(output);

    if (!depthMapUrl) {
      throw new Error('Invalid output format from Replicate: Could not extract depth map URL');
    }

    return depthMapUrl;
  }

  /**
   * Extract URL from Replicate output
   *
   * Handles various output formats:
   * - Direct string URL
   * - FileOutput object with url() method
   * - Array of URLs
   */
  private extractUrlFromOutput(output: unknown): string | null {
    // Direct string URL
    if (typeof output === 'string' && output.startsWith('http')) {
      return output;
    }

    // Object with url property or method
    if (output && typeof output === 'object') {
      const outputRecord = output as Record<string, unknown>;

      // FileOutput with url() method
      if ('url' in outputRecord && typeof outputRecord.url === 'function') {
        const url = (outputRecord.url as () => unknown)();
        return typeof url === 'string' ? url : String(url);
      }

      // Direct url property
      if ('url' in outputRecord && typeof outputRecord.url === 'string') {
        return outputRecord.url;
      }

      // Array of URLs
      if (Array.isArray(output) && output.length > 0) {
        const firstItem = output[0];
        if (typeof firstItem === 'string' && firstItem.startsWith('http')) {
          return firstItem;
        }
      }
    }

    return null;
  }

  /**
   * Safely extract hostname from URL for logging
   */
  private getUrlHost(url: string): string | null {
    try {
      return new URL(url).hostname;
    } catch {
      return null;
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a DepthEstimationService instance
 *
 * @param options - Service configuration options
 * @returns DepthEstimationService instance
 */
export function createDepthEstimationService(
  options: DepthEstimationServiceOptions
): DepthEstimationService {
  return new ReplicateDepthEstimationService(options);
}

/**
 * Create a DepthEstimationService with a specific user context
 *
 * @param storageService - Storage service for GCS uploads
 * @param userId - User ID for storage path organization
 * @param apiToken - Optional Replicate API token
 * @returns DepthEstimationService instance
 */
export function createDepthEstimationServiceForUser(
  storageService: StorageService,
  userId: string,
  apiToken?: string
): DepthEstimationService {
  return new ReplicateDepthEstimationService({
    storageService,
    userId,
    apiToken,
  });
}

export default ReplicateDepthEstimationService;
