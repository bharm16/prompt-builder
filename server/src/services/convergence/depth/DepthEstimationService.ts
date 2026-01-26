/**
 * DepthEstimationService for Visual Convergence
 *
 * Integrates with fal.ai Depth Anything v2 (primary) with Replicate fallback for depth map generation.
 * Used to create depth maps from images for client-side camera motion rendering.
 *
 * Requirements:
 * - 5.1: Generate depth map from last generated image using Depth Anything v2
 * - 5.2: Use fal.ai API to run the depth estimation model
 * - 5.5: If depth estimation fails, offer text-only camera motion selection as fallback
 *
 * @module convergence/depth
 */

import { fal } from '@fal-ai/client';
import Replicate from 'replicate';
import { logger } from '@infrastructure/Logger';
import { isFalKeyPlaceholder, resolveFalApiKey } from '@utils/falApiKey';
import { withRetry } from '../helpers';
import type { StorageService } from '../storage';
import type { DepthEstimationProvider, FalDepthResponse } from './types';

// ============================================================================
// Configuration
// ============================================================================

/**
 * fal.ai model identifier for Depth Anything v2
 */
const FAL_DEPTH_MODEL = 'fal-ai/image-preprocessors/depth-anything/v2' as const;

/**
 * Replicate fallback model identifier (Depth Anything v1)
 */
const REPLICATE_DEPTH_MODEL_FALLBACK = 'cjwbw/depth-anything' as const;

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
 * Abstracts provider integration for easier testing.
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
   * (i.e., a provider is configured)
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
  /** fal.ai API key (defaults to FAL_KEY/FAL_API_KEY env vars) */
  falApiKey?: string | undefined;
  /** Replicate API token for fallback (defaults to REPLICATE_API_TOKEN env var) */
  replicateApiToken?: string | undefined;
  /** Storage service for persisting depth maps to GCS */
  storageService: StorageService;
  /** User ID for storage path organization */
  userId?: string | undefined;
}

/**
 * fal.ai-based implementation of DepthEstimationService with Replicate fallback.
 *
 * Uses Depth Anything v2 model to generate depth maps from images.
 * Depth maps are uploaded to GCS and served via signed URLs.
 */
export class ReplicateDepthEstimationService implements DepthEstimationService {
  private readonly log = logger.child({ service: 'DepthEstimationService' });
  private readonly falAvailable: boolean;
  private readonly replicate: Replicate | null;
  private readonly storageService: StorageService;
  private readonly userId: string;

  constructor(options: DepthEstimationServiceOptions) {
    const falApiKey = resolveFalApiKey(options.falApiKey);
    const replicateApiToken = options.replicateApiToken || process.env.REPLICATE_API_TOKEN;

    if (falApiKey) {
      fal.config({ credentials: falApiKey });
      this.falAvailable = true;
    } else {
      this.falAvailable = false;
      const envFalKey = options.falApiKey ? null : process.env.FAL_KEY;
      if (isFalKeyPlaceholder(envFalKey)) {
        this.log.warn('FAL_KEY appears to reference another env var; fal.ai depth estimation unavailable');
      } else {
        this.log.warn('FAL_KEY/FAL_API_KEY not provided, fal.ai depth estimation unavailable');
      }
    }

    if (replicateApiToken) {
      this.replicate = new Replicate({ auth: replicateApiToken });
    } else {
      this.replicate = null;
    }

    if (!this.falAvailable && !this.replicate) {
      this.log.warn('No depth estimation providers available');
    }

    this.storageService = options.storageService;
    this.userId = options.userId || 'anonymous';
  }

  /**
   * Check if the depth estimation service is available
   */
  isAvailable(): boolean {
    return this.falAvailable || this.replicate !== null;
  }

  /**
   * Generate a depth map from an image URL
   *
   * Uses fal.ai Depth Anything v2 with Replicate fallback and retry logic.
   * The resulting depth map is uploaded to GCS and returned as a signed URL.
   *
   * @param imageUrl - URL of the source image
   * @returns Signed GCS URL of the generated depth map
   * @throws Error if depth estimation fails after retries
   */
  async estimateDepth(imageUrl: string): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error('Depth estimation service is not available: no providers configured');
    }

    const startTime = Date.now();
    const primaryProvider: DepthEstimationProvider = this.falAvailable ? 'fal.ai' : 'replicate';
    this.log.info('Starting depth estimation', {
      imageUrlHost: this.getUrlHost(imageUrl),
      primaryProvider,
    });

    try {
      let depthMapTempUrl: string;

      if (this.falAvailable) {
        try {
          depthMapTempUrl = await withRetry(
            () => this.runFalDepthEstimation(imageUrl),
            DEPTH_ESTIMATION_CONFIG.maxRetries,
            DEPTH_ESTIMATION_CONFIG.baseDelayMs
          );
        } catch (falError) {
          this.log.warn('fal.ai depth estimation failed, trying Replicate fallback', {
            error: (falError as Error).message,
          });

          if (this.replicate) {
            depthMapTempUrl = await withRetry(
              () => this.runReplicateDepthEstimation(imageUrl),
              DEPTH_ESTIMATION_CONFIG.maxRetries,
              DEPTH_ESTIMATION_CONFIG.baseDelayMs
            );
          } else {
            throw falError;
          }
        }
      } else if (this.replicate) {
        depthMapTempUrl = await withRetry(
          () => this.runReplicateDepthEstimation(imageUrl),
          DEPTH_ESTIMATION_CONFIG.maxRetries,
          DEPTH_ESTIMATION_CONFIG.baseDelayMs
        );
      } else {
        throw new Error('No depth estimation providers available');
      }

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
   * Run the depth estimation model on fal.ai
   *
   * @param imageUrl - URL of the source image
   * @returns Temporary URL of the generated depth map
   */
  private async runFalDepthEstimation(imageUrl: string): Promise<string> {
    this.log.debug('Calling fal.ai depth estimation', {
      model: FAL_DEPTH_MODEL,
      imageUrlHost: this.getUrlHost(imageUrl),
    });

    const result = await fal.subscribe(FAL_DEPTH_MODEL, {
      input: {
        image_url: imageUrl,
      },
      logs: false,
    });

    const depthMapUrl = (result as { data?: FalDepthResponse }).data?.image?.url;

    if (!depthMapUrl) {
      throw new Error('Invalid output format from fal.ai: Could not extract depth map URL');
    }

    this.log.debug('fal.ai depth estimation response', {
      outputUrl: depthMapUrl,
    });

    return depthMapUrl;
  }

  /**
   * Run the depth estimation model on Replicate
   *
   * @param imageUrl - URL of the source image
   * @returns Temporary URL of the generated depth map
   */
  private async runReplicateDepthEstimation(imageUrl: string): Promise<string> {
    if (!this.replicate) {
      throw new Error('Replicate client not initialized');
    }

    this.log.debug('Calling Replicate depth estimation (fallback)', {
      model: REPLICATE_DEPTH_MODEL_FALLBACK,
      imageUrlHost: this.getUrlHost(imageUrl),
    });

    const input = {
      image: imageUrl,
    };

    const output = await this.replicate.run(
      REPLICATE_DEPTH_MODEL_FALLBACK as `${string}/${string}`,
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
 * @param replicateApiToken - Optional Replicate API token
 * @param falApiKey - Optional fal.ai API key
 * @returns DepthEstimationService instance
 */
export function createDepthEstimationServiceForUser(
  storageService: StorageService,
  userId: string,
  replicateApiToken?: string,
  falApiKey?: string
): DepthEstimationService {
  return new ReplicateDepthEstimationService({
    storageService,
    userId,
    replicateApiToken,
    falApiKey,
  });
}

export default ReplicateDepthEstimationService;
