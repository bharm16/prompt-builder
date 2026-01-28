/**
 * Property-based tests for MAM Token Caching
 *
 * Tests the following correctness property:
 * - Property 10: MAM Token Caching
 *
 * For any asset uploaded to MAM, subsequent requests for the same asset
 * (by content hash) SHALL return the cached token without re-uploading,
 * and the cached token SHALL be valid for the target provider.
 *
 * @module mam-token-caching.property.test
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

import {
  MultimodalAssetManager,
  type AssetType,
  type ProviderType,
} from '@services/video-prompt-analysis/services/MultimodalAssetManager';

describe('MultimodalAssetManager Property Tests', () => {
  // Asset types for testing
  const assetTypes: AssetType[] = ['image', 'video', 'cameo'];

  // Provider types for testing
  const providerTypes: ProviderType[] = ['runway', 'luma', 'kling', 'sora', 'veo'];

  /**
   * Property 10: MAM Token Caching
   *
   * For any asset uploaded to MAM, subsequent requests for the same asset
   * (by content hash) SHALL return the cached token without re-uploading,
   * and the cached token SHALL be valid for the target provider.
   *
   * **Feature: video-model-optimization, Property 10: MAM Token Caching**
   * **Validates: Requirements 12.3, 12.5**
   */
  describe('Property 10: MAM Token Caching', () => {
    it('returns cached token for same content hash without re-uploading', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...assetTypes),
          fc.constantFrom(...providerTypes),
          fc.stringMatching(/^[a-zA-Z0-9]{10,100}$/),
          async (assetType, provider, content) => {
            // Create fresh MAM instance for each iteration
            const mam = new MultimodalAssetManager();
            
            // Stage an asset with specific content
            const buffer = Buffer.from(content);
            const staged = await mam.stageAsset({
              type: assetType,
              buffer,
              mimeType: 'application/octet-stream',
            });

            // First upload - should not be from cache
            const firstResult = await mam.uploadToProvider(staged.id, provider);
            expect(firstResult.fromCache).toBe(false);
            expect(firstResult.token).toBeDefined();
            expect(firstResult.provider).toBe(provider);

            // Second upload with same asset - should be from cache
            const secondResult = await mam.uploadToProvider(staged.id, provider);
            expect(secondResult.fromCache).toBe(true);
            expect(secondResult.token).toBe(firstResult.token);
            expect(secondResult.provider).toBe(provider);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('cached token is valid for target provider', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...assetTypes),
          fc.constantFrom(...providerTypes),
          fc.stringMatching(/^[a-zA-Z0-9]{10,100}$/),
          async (assetType, provider, content) => {
            const mam = new MultimodalAssetManager();
            const buffer = Buffer.from(content);
            const staged = await mam.stageAsset({
              type: assetType,
              buffer,
              mimeType: 'application/octet-stream',
            });

            // Upload to provider
            const result = await mam.uploadToProvider(staged.id, provider);

            // Token should follow provider-specific format
            const tokenFormats: Record<ProviderType, RegExp> = {
              runway: /^rw_[a-f0-9]+$/,
              luma: /^luma_[a-f0-9]+$/,
              kling: /^@Element\([a-f0-9]+\)$/,
              sora: /^sora_asset_[a-f0-9]+$/,
              veo: /^veo_[a-f0-9]+$/,
            };

            expect(result.token).toMatch(tokenFormats[provider]);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('getCachedToken returns token after upload', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...assetTypes),
          fc.constantFrom(...providerTypes),
          fc.stringMatching(/^[a-zA-Z0-9]{10,100}$/),
          async (assetType, provider, content) => {
            const mam = new MultimodalAssetManager();
            const buffer = Buffer.from(content);
            const staged = await mam.stageAsset({
              type: assetType,
              buffer,
              mimeType: 'application/octet-stream',
            });

            // Before upload, no cached token
            const beforeCache = mam.getCachedToken(staged.contentHash, provider);
            expect(beforeCache).toBeUndefined();

            // Upload to provider
            const uploadResult = await mam.uploadToProvider(staged.id, provider);

            // After upload, cached token should exist
            const afterCache = mam.getCachedToken(staged.contentHash, provider);
            expect(afterCache).toBe(uploadResult.token);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('hasValidCachedToken returns correct status', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...assetTypes),
          fc.constantFrom(...providerTypes),
          fc.stringMatching(/^[a-zA-Z0-9]{10,100}$/),
          async (assetType, provider, content) => {
            const mam = new MultimodalAssetManager();
            const buffer = Buffer.from(content);
            const staged = await mam.stageAsset({
              type: assetType,
              buffer,
              mimeType: 'application/octet-stream',
            });

            // Before upload
            expect(mam.hasValidCachedToken(staged.contentHash, provider)).toBe(false);

            // After upload
            await mam.uploadToProvider(staged.id, provider);
            expect(mam.hasValidCachedToken(staged.contentHash, provider)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('different providers get different tokens for same asset', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...assetTypes),
          fc.stringMatching(/^[a-zA-Z0-9]{10,100}$/),
          async (assetType, content) => {
            const mam = new MultimodalAssetManager();
            const buffer = Buffer.from(content);
            const staged = await mam.stageAsset({
              type: assetType,
              buffer,
              mimeType: 'application/octet-stream',
            });

            // Upload to all providers
            const tokens: Record<string, string> = {};
            for (const provider of providerTypes) {
              const result = await mam.uploadToProvider(staged.id, provider);
              tokens[provider] = result.token;
            }

            // Each provider should have a unique token format
            const uniqueTokens = new Set(Object.values(tokens));
            expect(uniqueTokens.size).toBe(providerTypes.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('same content staged multiple times returns same staged asset', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...assetTypes),
          fc.stringMatching(/^[a-zA-Z0-9]{10,100}$/),
          async (assetType, content) => {
            const mam = new MultimodalAssetManager();
            const buffer = Buffer.from(content);

            // Stage same content twice
            const staged1 = await mam.stageAsset({
              type: assetType,
              buffer,
              mimeType: 'application/octet-stream',
            });

            const staged2 = await mam.stageAsset({
              type: assetType,
              buffer,
              mimeType: 'application/octet-stream',
            });

            // Should return same staged asset (deduplication)
            expect(staged1.id).toBe(staged2.id);
            expect(staged1.contentHash).toBe(staged2.contentHash);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('clearTokenCache removes all cached tokens', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...assetTypes),
          fc.constantFrom(...providerTypes),
          fc.stringMatching(/^[a-zA-Z0-9]{10,100}$/),
          async (assetType, provider, content) => {
            const mam = new MultimodalAssetManager();
            const buffer = Buffer.from(content);
            const staged = await mam.stageAsset({
              type: assetType,
              buffer,
              mimeType: 'application/octet-stream',
            });

            // Upload and verify cache
            await mam.uploadToProvider(staged.id, provider);
            expect(mam.hasValidCachedToken(staged.contentHash, provider)).toBe(true);

            // Clear cache
            mam.clearTokenCache();

            // Cache should be empty
            expect(mam.hasValidCachedToken(staged.contentHash, provider)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Cameo Token Validation', () => {
    it('validates correctly formatted Cameo tokens', () => {
      const mam = new MultimodalAssetManager();
      fc.assert(
        fc.property(
          // Generate valid UUIDs
          fc.uuid(),
          (uuid) => {
            const token = `@Cameo(${uuid})`;
            const result = mam.validateCameoToken(token);

            expect(result.isValid).toBe(true);
            expect(result.tokenId).toBe(uuid);
            expect(result.provider).toBe('sora');
            expect(result.error).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('rejects invalid Cameo token formats', () => {
      const mam = new MultimodalAssetManager();
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }).filter(
            (s) => !s.match(/^@Cameo\([a-f0-9-]{36}\)$/i)
          ),
          (invalidToken) => {
            const result = mam.validateCameoToken(invalidToken);

            expect(result.isValid).toBe(false);
            expect(result.error).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Asset Description', () => {
    it('returns user-provided description when available', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...assetTypes),
          // Use unique content for each iteration
          fc.stringMatching(/^[a-zA-Z0-9]{10,100}$/),
          fc.stringMatching(/^[a-zA-Z0-9]{10,100}$/),
          async (assetType, content, description) => {
            const mam = new MultimodalAssetManager();
            const buffer = Buffer.from(content);
            const staged = await mam.stageAsset({
              type: assetType,
              buffer,
              mimeType: 'application/octet-stream',
              description,
            });

            const result = await mam.describeAsset(staged.id);

            expect(result.description).toBe(description);
            expect(result.confidence).toBe(1.0);
            expect(result.isPlaceholder).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('returns placeholder description when VLM disabled and no user description', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...assetTypes),
          fc.stringMatching(/^[a-zA-Z0-9]{10,100}$/),
          async (assetType, content) => {
            const mam = new MultimodalAssetManager();
            const buffer = Buffer.from(content);
            const staged = await mam.stageAsset({
              type: assetType,
              buffer,
              mimeType: 'application/octet-stream',
            });

            const result = await mam.describeAsset(staged.id);

            expect(result.isPlaceholder).toBe(true);
            expect(result.confidence).toBe(0.0);
            // Description should contain type-specific text
            expect(result.description.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Staging Area Management', () => {
    it('getStagedAsset returns correct asset', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...assetTypes),
          fc.stringMatching(/^[a-zA-Z0-9]{10,100}$/),
          async (assetType, content) => {
            const mam = new MultimodalAssetManager();
            const buffer = Buffer.from(content);
            const staged = await mam.stageAsset({
              type: assetType,
              buffer,
              mimeType: 'application/octet-stream',
            });

            const retrieved = mam.getStagedAsset(staged.id);

            expect(retrieved).toBeDefined();
            expect(retrieved?.id).toBe(staged.id);
            expect(retrieved?.type).toBe(assetType);
            expect(retrieved?.contentHash).toBe(staged.contentHash);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('removeStagedAsset removes asset from staging', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...assetTypes),
          fc.stringMatching(/^[a-zA-Z0-9]{10,100}$/),
          async (assetType, content) => {
            const mam = new MultimodalAssetManager();
            const buffer = Buffer.from(content);
            const staged = await mam.stageAsset({
              type: assetType,
              buffer,
              mimeType: 'application/octet-stream',
            });

            // Asset should exist
            expect(mam.getStagedAsset(staged.id)).toBeDefined();

            // Remove asset
            const removed = mam.removeStagedAsset(staged.id);
            expect(removed).toBe(true);

            // Asset should no longer exist
            expect(mam.getStagedAsset(staged.id)).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('clearStagingArea removes all staged assets', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.stringMatching(/^[a-zA-Z0-9]{10,50}$/), { minLength: 1, maxLength: 5 }),
          async (contents) => {
            const mam = new MultimodalAssetManager();
            // Stage multiple assets
            const stagedIds: string[] = [];
            for (const content of contents) {
              const staged = await mam.stageAsset({
                type: 'image',
                buffer: Buffer.from(content),
                mimeType: 'image/png',
              });
              stagedIds.push(staged.id);
            }

            // Verify assets exist
            const stats = mam.getCacheStats();
            expect(stats.stagedCount).toBeGreaterThan(0);

            // Clear staging area
            mam.clearStagingArea();

            // All assets should be removed
            for (const id of stagedIds) {
              expect(mam.getStagedAsset(id)).toBeUndefined();
            }
            expect(mam.getCacheStats().stagedCount).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
