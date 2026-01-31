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
import { safeUrlHost } from '@utils/url';
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
 * Replicate fallback model identifier (Depth Anything v2)
 */
const REPLICATE_DEPTH_MODEL_FALLBACK = 'chenxwh/depth-anything-v2' as const;

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
  /** Cache TTL in milliseconds (1 hour) */
  cacheTtlMs: 60 * 60 * 1000,
} as const;

// ============================================================================
// In-Memory Cache
// ============================================================================

interface CacheEntry {
  depthMapUrl: string;
  expiresAt: number;
}

/**
 * Simple in-memory cache for depth maps by image URL.
 * Makes repeated calls for the same image instant.
 */
const depthMapCache = new Map<string, CacheEntry>();

function getCachedDepthMap(imageUrl: string): string | null {
  const entry = depthMapCache.get(imageUrl);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    depthMapCache.delete(imageUrl);
    return null;
  }
  return entry.depthMapUrl;
}

function setCachedDepthMap(imageUrl: string, depthMapUrl: string): void {
  depthMapCache.set(imageUrl, {
    depthMapUrl,
    expiresAt: Date.now() + DEPTH_ESTIMATION_CONFIG.cacheTtlMs,
  });
}

// ============================================================================
// Warm Start (fal.ai cold start mitigation)
// ============================================================================

const FAL_WARM_START_CONFIG = {
  enabled: (() => {
    if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
      return false;
    }
    const flag = process.env.FAL_DEPTH_WARMUP_ENABLED;
    if (flag === 'true') return true;
    if (flag === 'false') return false;
    // Default to enabled in development, disabled in production unless explicitly enabled.
    return process.env.NODE_ENV !== 'production';
  })(),
  intervalMs: (() => {
    const raw = Number.parseInt(process.env.FAL_DEPTH_WARMUP_INTERVAL_MS || '', 10);
    if (Number.isFinite(raw) && raw >= 30_000) {
      return raw;
    }
    // Keep warm every 2 minutes by default.
    return 2 * 60 * 1000;
  })(),
  warmupImageUrl:
    process.env.FAL_DEPTH_WARMUP_IMAGE_URL ||
    'https://storage.googleapis.com/generativeai-downloads/images/cat.jpg',
} as const;

const getDepthStartupWarmupConfig = () =>
  ({
    enabled: (() => {
      if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
        return false;
      }
      const flag = process.env.DEPTH_WARMUP_ON_STARTUP;
      if (flag === 'true') return true;
      if (flag === 'false') return false;
      // Default to enabled so cold starts don't cause first-request timeouts.
      return true;
    })(),
    timeoutMs: (() => {
      const raw = Number.parseInt(process.env.DEPTH_WARMUP_TIMEOUT_MS || '', 10);
      if (Number.isFinite(raw) && raw >= 5_000) {
        return raw;
      }
      // Allow extra time for cold-start model spin-up.
      return 60_000;
    })(),
  }) as const;

const warmLog = logger.child({ service: 'FalDepthWarmer' });
const startupWarmLog = logger.child({ service: 'DepthWarmup' });
let warmerInitialized = false;
let warmIntervalId: ReturnType<typeof setInterval> | null = null;
let warmupInFlight: Promise<void> | null = null;
let lastWarmupAt = 0;
let replicateWarmupInFlight: Promise<boolean> | null = null;
let startupWarmupPromise: Promise<DepthWarmupResult> | null = null;

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Depth warmup timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

const runFalWarmup = (reason: 'startup' | 'interval'): Promise<void> => {
  if (warmupInFlight) {
    return warmupInFlight;
  }

  const startedAt = Date.now();
  const warmupImageUrlHost = safeUrlHost(FAL_WARM_START_CONFIG.warmupImageUrl);

  warmupInFlight = (async () => {
    try {
      warmLog.debug('Starting fal depth warmup', {
        operation: 'falDepthWarmup',
        reason,
        intervalMs: FAL_WARM_START_CONFIG.intervalMs,
        warmupImageUrlHost,
        lastWarmupAt: lastWarmupAt || null,
      });

      await fal.subscribe(FAL_DEPTH_MODEL, {
        input: {
          image_url: FAL_WARM_START_CONFIG.warmupImageUrl,
        },
        logs: false,
      });

      lastWarmupAt = Date.now();
      warmLog.info('Completed fal depth warmup', {
        operation: 'falDepthWarmup',
        reason,
        durationMs: lastWarmupAt - startedAt,
        warmupImageUrlHost,
      });
    } catch (error) {
      const errObj = error instanceof Error ? error : new Error(String(error));
      warmLog.warn('Fal depth warmup failed', {
        operation: 'falDepthWarmup',
        reason,
        durationMs: Date.now() - startedAt,
        warmupImageUrlHost,
        error: errObj.message,
      });
    } finally {
      warmupInFlight = null;
    }
  })();

  return warmupInFlight;
};

const runReplicateWarmup = (
  replicateApiToken: string,
  warmupImageUrl: string
): Promise<boolean> => {
  if (replicateWarmupInFlight) {
    return replicateWarmupInFlight;
  }

  const startedAt = Date.now();
  const warmupImageUrlHost = safeUrlHost(warmupImageUrl);
  replicateWarmupInFlight = (async () => {
    try {
      startupWarmLog.debug('Starting Replicate depth warmup', {
        operation: 'replicateDepthWarmup',
        warmupImageUrlHost,
      });

      const replicate = new Replicate({ auth: replicateApiToken });
      await replicate.run(REPLICATE_DEPTH_MODEL_FALLBACK as `${string}/${string}`, {
        input: { image: warmupImageUrl },
      });

      startupWarmLog.info('Completed Replicate depth warmup', {
        operation: 'replicateDepthWarmup',
        durationMs: Date.now() - startedAt,
        warmupImageUrlHost,
      });

      return true;
    } catch (error) {
      const errObj = error instanceof Error ? error : new Error(String(error));
      startupWarmLog.warn('Replicate depth warmup failed', {
        operation: 'replicateDepthWarmup',
        durationMs: Date.now() - startedAt,
        warmupImageUrlHost,
        error: errObj.message,
      });
      return false;
    } finally {
      replicateWarmupInFlight = null;
    }
  })();

  return replicateWarmupInFlight;
};

export interface DepthWarmupResult {
  success: boolean;
  provider?: DepthEstimationProvider;
  durationMs?: number;
  message?: string;
  skipped?: boolean;
}

/**
 * Initialize a periodic fal depth warmer to reduce cold starts.
 *
 * This function is safe to call multiple times; it will only initialize once.
 */
export function initializeDepthWarmer(): void {
  if (warmerInitialized || !FAL_WARM_START_CONFIG.enabled) {
    return;
  }

  const falApiKey = resolveFalApiKey();
  if (!falApiKey) {
    warmLog.warn('Fal depth warmer skipped: FAL_KEY/FAL_API_KEY not configured', {
      operation: 'falDepthWarmup',
      enabled: FAL_WARM_START_CONFIG.enabled,
    });
    return;
  }

  fal.config({ credentials: falApiKey });
  warmerInitialized = true;

  const warmupImageUrlHost = safeUrlHost(FAL_WARM_START_CONFIG.warmupImageUrl);
  warmLog.info('Fal depth warmer enabled', {
    operation: 'falDepthWarmup',
    intervalMs: FAL_WARM_START_CONFIG.intervalMs,
    warmupImageUrlHost,
  });

  if (lastWarmupAt === 0) {
    void runFalWarmup('startup');
  }

  warmIntervalId = setInterval(() => {
    void runFalWarmup('interval');
  }, FAL_WARM_START_CONFIG.intervalMs);

  if (warmIntervalId && typeof warmIntervalId.unref === 'function') {
    warmIntervalId.unref();
  }
}

/**
 * Warm up depth estimation at startup to avoid first-request timeouts.
 */
export function warmupDepthEstimationOnStartup(): Promise<DepthWarmupResult> {
  if (startupWarmupPromise) {
    return startupWarmupPromise;
  }

  startupWarmupPromise = (async () => {
    const startupWarmupConfig = getDepthStartupWarmupConfig();
    if (!startupWarmupConfig.enabled) {
      return { success: false, skipped: true, message: 'disabled' };
    }

    if (process.env.PROMPT_OUTPUT_ONLY === 'true') {
      return { success: false, skipped: true, message: 'PROMPT_OUTPUT_ONLY' };
    }

    const falApiKey = resolveFalApiKey();
    const replicateApiToken = process.env.REPLICATE_API_TOKEN;

    if (!falApiKey && !replicateApiToken) {
      return { success: false, skipped: true, message: 'no-providers' };
    }

    const warmupImageUrl = FAL_WARM_START_CONFIG.warmupImageUrl;
    const warmupImageUrlHost = safeUrlHost(warmupImageUrl);
    const timeoutMs = startupWarmupConfig.timeoutMs;
    const startedAt = Date.now();

    if (falApiKey) {
      fal.config({ credentials: falApiKey });

      if (lastWarmupAt > 0) {
        return {
          success: true,
          provider: 'fal.ai',
          durationMs: 0,
          message: 'already-warmed',
        };
      }

      startupWarmLog.info('Depth warmup starting (fal.ai)', {
        operation: 'depthStartupWarmup',
        provider: 'fal.ai',
        timeoutMs,
        warmupImageUrlHost,
      });

      const beforeWarmupAt = lastWarmupAt;
      try {
        await withTimeout(runFalWarmup('startup'), timeoutMs);
      } catch (error) {
        const errObj = error instanceof Error ? error : new Error(String(error));
        startupWarmLog.warn('Depth warmup timed out (fal.ai)', {
          operation: 'depthStartupWarmup',
          provider: 'fal.ai',
          timeoutMs,
          warmupImageUrlHost,
          error: errObj.message,
        });
      }

      const durationMs = Date.now() - startedAt;
      if (lastWarmupAt > beforeWarmupAt) {
        return { success: true, provider: 'fal.ai', durationMs };
      }

      return {
        success: false,
        provider: 'fal.ai',
        durationMs,
        message: 'fal-warmup-failed',
      };
    }

    startupWarmLog.info('Depth warmup starting (replicate)', {
      operation: 'depthStartupWarmup',
      provider: 'replicate',
      timeoutMs,
      warmupImageUrlHost,
    });

    let replicateSuccess = false;
    try {
      replicateSuccess = await withTimeout(
        runReplicateWarmup(replicateApiToken!, warmupImageUrl),
        timeoutMs
      );
    } catch (error) {
      const errObj = error instanceof Error ? error : new Error(String(error));
      startupWarmLog.warn('Depth warmup timed out (replicate)', {
        operation: 'depthStartupWarmup',
        provider: 'replicate',
        timeoutMs,
        warmupImageUrlHost,
        error: errObj.message,
      });
    }

    const durationMs = Date.now() - startedAt;
    if (replicateSuccess) {
      return { success: true, provider: 'replicate', durationMs };
    }

    return {
      success: false,
      provider: 'replicate',
      durationMs,
      message: 'replicate-warmup-failed',
    };
  })();

  return startupWarmupPromise;
}

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

    // If the warmer was not started at app bootstrap, start it on first construction.
    if (this.falAvailable) {
      initializeDepthWarmer();
    }
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

    const cachedDepthMap = getCachedDepthMap(imageUrl);
    if (cachedDepthMap) {
      this.log.debug('Depth estimation cache hit', {
        imageUrlHost: this.getUrlHost(imageUrl),
        cacheTtlMs: DEPTH_ESTIMATION_CONFIG.cacheTtlMs,
      });
      return cachedDepthMap;
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

      // Return the temporary URL directly - fal.ai/Replicate URLs are valid for hours
      // and the client media proxy handles CORS. This saves 1-3 seconds per request.
      // If persistence is needed later, GCS upload can be done asynchronously.
      const signedUrl = depthMapTempUrl;

      setCachedDepthMap(imageUrl, signedUrl);

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

      // Depth Anything v2 returns grey/color depth URLs as fields
      const depthKeys = ['grey_depth', 'gray_depth', 'color_depth', 'colour_depth'];
      for (const key of depthKeys) {
        if (!(key in outputRecord)) continue;
        const value = outputRecord[key];
        if (typeof value === 'string' && value.startsWith('http')) {
          return value;
        }
        if (value && typeof value === 'object') {
          const valueRecord = value as Record<string, unknown>;
          if ('url' in valueRecord && typeof valueRecord.url === 'function') {
            const url = (valueRecord.url as () => unknown)();
            return typeof url === 'string' ? url : String(url);
          }
          if ('url' in valueRecord && typeof valueRecord.url === 'string') {
            return valueRecord.url;
          }
        }
      }

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
