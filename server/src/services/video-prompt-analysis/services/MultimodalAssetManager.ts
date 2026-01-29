/**
 * Multimodal Asset Manager (MAM)
 *
 * Service for managing uploaded assets and referencing them consistently
 * across different model APIs. Handles image/video uploads, token caching,
 * and VLM-based asset description.
 *
 * @module MultimodalAssetManager
 */

import * as crypto from 'crypto';
import { sleep } from '@utils/sleep';

/**
 * Supported asset types
 */
export type AssetType = 'image' | 'video' | 'cameo';

/**
 * Supported video model providers
 */
export type ProviderType = 'runway' | 'luma' | 'kling' | 'sora' | 'veo';

/**
 * Asset upload request
 */
export interface AssetUploadRequest {
  /** Type of asset being uploaded */
  type: AssetType;
  /** Local file path (for file-based uploads) */
  localPath?: string;
  /** URL of the asset (for URL-based references) */
  url?: string;
  /** Raw buffer data (for in-memory uploads) */
  buffer?: Buffer;
  /** MIME type of the asset */
  mimeType?: string;
  /** Optional description provided by user */
  description?: string;
}

/**
 * Staged asset ready for provider upload
 */
export interface StagedAsset {
  /** Unique identifier for the staged asset */
  id: string;
  /** Type of asset */
  type: AssetType;
  /** Content hash for deduplication */
  contentHash: string;
  /** Original source (path or URL) */
  source: string;
  /** MIME type */
  mimeType: string;
  /** Size in bytes */
  sizeBytes: number;
  /** Timestamp when staged */
  stagedAt: Date;
  /** User-provided or VLM-generated description */
  description?: string;
}

/**
 * Provider-specific upload result
 */
export interface ProviderUploadResult {
  /** Provider identifier */
  provider: ProviderType;
  /** Provider-specific token or UUID */
  token: string;
  /** Provider-specific endpoint used */
  endpoint: string;
  /** Whether this was a cached result */
  fromCache: boolean;
  /** Timestamp of upload */
  uploadedAt: Date;
}

/**
 * Cameo token validation result
 */
export interface CameoValidationResult {
  /** Whether the token is valid */
  isValid: boolean;
  /** The validated token ID */
  tokenId?: string;
  /** Error message if invalid */
  error?: string;
  /** Provider the token is valid for */
  provider?: ProviderType;
}

/**
 * Asset description result from VLM
 */
export interface AssetDescriptionResult {
  /** Generated description */
  description: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Detected elements in the asset */
  detectedElements: string[];
  /** Whether this is a placeholder (VLM not available) */
  isPlaceholder: boolean;
}

/**
 * Cache entry for provider tokens
 */
interface TokenCacheEntry {
  /** Content hash of the asset */
  contentHash: string;
  /** Provider-specific token */
  token: string;
  /** Provider identifier */
  provider: ProviderType;
  /** When the token was cached */
  cachedAt: Date;
  /** Token expiration time (if applicable) */
  expiresAt?: Date;
}

/**
 * Mock provider endpoints for development
 * In production, these would be actual API endpoints
 */
const MOCK_PROVIDER_ENDPOINTS: Record<ProviderType, string> = {
  runway: 'https://api.runwayml.com/v1/assets',
  luma: 'https://api.lumalabs.ai/v1/assets',
  kling: 'https://api.kling.ai/v1/assets',
  sora: 'https://api.openai.com/v1/video/assets',
  veo: 'https://generativelanguage.googleapis.com/v1/assets',
};

/**
 * Valid Cameo token pattern (for Sora)
 * Format: @Cameo(uuid-format-id)
 */
const CAMEO_TOKEN_PATTERN = /^@Cameo\(([a-f0-9-]{36})\)$/i;

/**
 * Multimodal Asset Manager
 *
 * Manages asset uploads, caching, and provider-specific token generation.
 * Implements Requirements 12.1-12.6 for multimodal asset handling.
 */
export class MultimodalAssetManager {
  /** Staging area for assets pending upload */
  private stagingArea: Map<string, StagedAsset> = new Map();

  /** Token cache by content hash and provider */
  private tokenCache: Map<string, TokenCacheEntry> = new Map();

  /** VLM integration enabled flag */
  private vlmEnabled: boolean = false;

  constructor(options?: { vlmEnabled?: boolean }) {
    this.vlmEnabled = options?.vlmEnabled ?? false;
  }

  /**
   * Stage an asset for upload
   *
   * Accepts image/video uploads and stores them in a temporary staging area.
   * Computes content hash for deduplication.
   *
   * @param request - Asset upload request
   * @returns Staged asset with unique ID and content hash
   *
   * Implements Requirement 12.1
   */
  async stageAsset(request: AssetUploadRequest): Promise<StagedAsset> {
    // Determine source and compute content hash
    const source = request.localPath || request.url || 'buffer';
    const contentHash = await this.computeContentHash(request);
    const mimeType = request.mimeType || this.inferMimeType(source);

    // Check if already staged with same hash
    const existingStaged = this.findStagedByHash(contentHash);
    if (existingStaged) {
      return existingStaged;
    }

    // Create staged asset
    const stagedAsset: StagedAsset = {
      id: this.generateAssetId(),
      type: request.type,
      contentHash,
      source,
      mimeType,
      sizeBytes: request.buffer?.length || 0,
      stagedAt: new Date(),
      ...(request.description ? { description: request.description } : {}),
    };

    this.stagingArea.set(stagedAsset.id, stagedAsset);
    return stagedAsset;
  }

  /**
   * Upload a staged asset to a specific provider
   *
   * Uploads the asset to the provider's specific endpoint and returns
   * the provider-specific token or UUID.
   *
   * @param assetId - ID of the staged asset
   * @param provider - Target provider
   * @returns Provider upload result with token
   *
   * Implements Requirements 12.2, 12.3
   */
  async uploadToProvider(
    assetId: string,
    provider: ProviderType
  ): Promise<ProviderUploadResult> {
    const stagedAsset = this.stagingArea.get(assetId);
    if (!stagedAsset) {
      throw new Error(`Asset not found in staging: ${assetId}`);
    }

    // Check cache first (Requirement 12.5)
    const cacheKey = this.getCacheKey(stagedAsset.contentHash, provider);
    const cachedEntry = this.tokenCache.get(cacheKey);

    if (cachedEntry && !this.isTokenExpired(cachedEntry)) {
      return {
        provider,
        token: cachedEntry.token,
        endpoint: MOCK_PROVIDER_ENDPOINTS[provider],
        fromCache: true,
        uploadedAt: cachedEntry.cachedAt,
      };
    }

    // Mock upload - in production this would call actual provider APIs
    const token = await this.mockProviderUpload(stagedAsset, provider);

    // Cache the token
    const cacheEntry: TokenCacheEntry = {
      contentHash: stagedAsset.contentHash,
      token,
      provider,
      cachedAt: new Date(),
      // Tokens typically expire after 24 hours
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
    this.tokenCache.set(cacheKey, cacheEntry);

    return {
      provider,
      token,
      endpoint: MOCK_PROVIDER_ENDPOINTS[provider],
      fromCache: false,
      uploadedAt: new Date(),
    };
  }

  /**
   * Get cached token for an asset if available
   *
   * Returns the cached provider token without re-uploading.
   *
   * @param contentHash - Content hash of the asset
   * @param provider - Target provider
   * @returns Cached token or undefined
   *
   * Implements Requirement 12.5
   */
  getCachedToken(contentHash: string, provider: ProviderType): string | undefined {
    const cacheKey = this.getCacheKey(contentHash, provider);
    const entry = this.tokenCache.get(cacheKey);

    if (entry && !this.isTokenExpired(entry)) {
      return entry.token;
    }

    return undefined;
  }

  /**
   * Check if a token is cached for the given content hash and provider
   *
   * @param contentHash - Content hash of the asset
   * @param provider - Target provider
   * @returns true if a valid cached token exists
   */
  hasValidCachedToken(contentHash: string, provider: ProviderType): boolean {
    return this.getCachedToken(contentHash, provider) !== undefined;
  }

  /**
   * Validate a Cameo identity token
   *
   * Validates that a Cameo token is properly formatted and valid
   * for use with Sora.
   *
   * @param token - Cameo token string (e.g., @Cameo(uuid))
   * @returns Validation result
   *
   * Implements Requirement 12.4
   */
  validateCameoToken(token: string): CameoValidationResult {
    const match = token.match(CAMEO_TOKEN_PATTERN);

    if (!match) {
      return {
        isValid: false,
        error: 'Invalid Cameo token format. Expected @Cameo(uuid)',
      };
    }

    const tokenId = match[1];

    // Validate UUID format
    if (!tokenId || !this.isValidUUID(tokenId)) {
      return {
        isValid: false,
        error: 'Invalid UUID in Cameo token',
      };
    }

    // In production, this would verify the token against Sora's API
    return {
      isValid: true,
      tokenId,
      provider: 'sora',
    };
  }

  /**
   * Generate a text description for an asset using VLM
   *
   * Uses a Vision Language Model to generate a description of the asset
   * for concept reinforcement (required for Runway).
   *
   * @param assetId - ID of the staged asset
   * @returns Asset description result
   *
   * Implements Requirement 12.6
   */
  async describeAsset(assetId: string): Promise<AssetDescriptionResult> {
    const stagedAsset = this.stagingArea.get(assetId);
    if (!stagedAsset) {
      throw new Error(`Asset not found in staging: ${assetId}`);
    }

    // If user provided description, use it
    if (stagedAsset.description) {
      return {
        description: stagedAsset.description,
        confidence: 1.0,
        detectedElements: [],
        isPlaceholder: false,
      };
    }

    // VLM integration placeholder
    // In production, this would call a VLM API (e.g., GPT-4V, Gemini Vision)
    if (!this.vlmEnabled) {
      return this.generatePlaceholderDescription(stagedAsset);
    }

    // Mock VLM response for now
    return this.mockVLMDescription(stagedAsset);
  }

  /**
   * Get a staged asset by ID
   *
   * @param assetId - Asset ID
   * @returns Staged asset or undefined
   */
  getStagedAsset(assetId: string): StagedAsset | undefined {
    return this.stagingArea.get(assetId);
  }

  /**
   * Remove a staged asset
   *
   * @param assetId - Asset ID to remove
   * @returns true if removed, false if not found
   */
  removeStagedAsset(assetId: string): boolean {
    return this.stagingArea.delete(assetId);
  }

  /**
   * Clear all staged assets
   */
  clearStagingArea(): void {
    this.stagingArea.clear();
  }

  /**
   * Clear the token cache
   */
  clearTokenCache(): void {
    this.tokenCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { stagedCount: number; cachedTokens: number } {
    return {
      stagedCount: this.stagingArea.size,
      cachedTokens: this.tokenCache.size,
    };
  }

  // Private helper methods

  /**
   * Compute content hash for deduplication
   */
  private async computeContentHash(request: AssetUploadRequest): Promise<string> {
    let data: string;

    if (request.buffer) {
      data = request.buffer.toString('base64');
    } else if (request.url) {
      // For URLs, hash the URL itself (content would require fetching)
      data = request.url;
    } else if (request.localPath) {
      // For local paths, hash the path (content would require reading)
      data = request.localPath;
    } else {
      data = Date.now().toString();
    }

    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Find a staged asset by content hash
   */
  private findStagedByHash(contentHash: string): StagedAsset | undefined {
    for (const asset of this.stagingArea.values()) {
      if (asset.contentHash === contentHash) {
        return asset;
      }
    }
    return undefined;
  }

  /**
   * Generate a unique asset ID
   */
  private generateAssetId(): string {
    return `asset_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Infer MIME type from source
   */
  private inferMimeType(source: string): string {
    const ext = source.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      mp4: 'video/mp4',
      webm: 'video/webm',
      mov: 'video/quicktime',
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
  }

  /**
   * Get cache key for content hash and provider
   */
  private getCacheKey(contentHash: string, provider: ProviderType): string {
    return `${contentHash}:${provider}`;
  }

  /**
   * Check if a cached token is expired
   */
  private isTokenExpired(entry: TokenCacheEntry): boolean {
    if (!entry.expiresAt) {
      return false;
    }
    return new Date() > entry.expiresAt;
  }

  /**
   * Validate UUID format
   */
  private isValidUUID(uuid: string): boolean {
    const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
    return uuidPattern.test(uuid);
  }

  /**
   * Mock provider upload (placeholder for actual API calls)
   */
  private async mockProviderUpload(
    asset: StagedAsset,
    provider: ProviderType
  ): Promise<string> {
    // Simulate network delay
    await sleep(10);

    // Generate provider-specific token format
    const tokenFormats: Record<ProviderType, () => string> = {
      runway: () => `rw_${asset.contentHash.substring(0, 16)}`,
      luma: () => `luma_${asset.contentHash.substring(0, 16)}`,
      kling: () => `@Element(${asset.contentHash.substring(0, 8)})`,
      sora: () => `sora_asset_${asset.contentHash.substring(0, 16)}`,
      veo: () => `veo_${asset.contentHash.substring(0, 16)}`,
    };

    return tokenFormats[provider]();
  }

  /**
   * Generate placeholder description when VLM is not available
   */
  private generatePlaceholderDescription(asset: StagedAsset): AssetDescriptionResult {
    const typeDescriptions: Record<AssetType, string> = {
      image: 'An image asset',
      video: 'A video asset',
      cameo: 'A cameo identity reference',
    };

    return {
      description: `${typeDescriptions[asset.type]} from ${asset.source}`,
      confidence: 0.0,
      detectedElements: [],
      isPlaceholder: true,
    };
  }

  /**
   * Mock VLM description (placeholder for actual VLM integration)
   */
  private async mockVLMDescription(asset: StagedAsset): Promise<AssetDescriptionResult> {
    // Simulate VLM processing delay
    await sleep(50);

    // Generate mock description based on asset type
    const descriptions: Record<AssetType, string> = {
      image: 'A detailed image showing visual elements with clear composition',
      video: 'A video clip with motion and temporal progression',
      cameo: 'A reference identity for consistent character appearance',
    };

    return {
      description: descriptions[asset.type],
      confidence: 0.85,
      detectedElements: ['subject', 'background', 'lighting'],
      isPlaceholder: false,
    };
  }
}

/**
 * Singleton instance for convenience
 */
export const multimodalAssetManager = new MultimodalAssetManager();
