import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useDetectedAssets } from '@features/prompt-optimizer/components/DetectedAssets/hooks/useDetectedAssets';
import type { Asset } from '@shared/types/asset';

const createAsset = (overrides: Partial<Asset> = {}): Asset => ({
  id: overrides.id ?? 'asset-1',
  userId: 'user-1',
  type: overrides.type ?? 'character',
  trigger: overrides.trigger ?? '@hero',
  name: overrides.name ?? 'Hero',
  textDefinition: overrides.textDefinition ?? 'hero',
  referenceImages: [],
  usageCount: 0,
  lastUsedAt: null,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  ...overrides,
});

describe('useDetectedAssets', () => {
  describe('error handling', () => {
    it('returns empty results when prompt is blank', () => {
      const { result } = renderHook(() => useDetectedAssets('   ', []));

      expect(result.current.detectedAssets).toEqual([]);
      expect(result.current.unresolvedTriggers).toEqual([]);
      expect(result.current.hasCharacter).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('deduplicates triggers and matches case-insensitively', () => {
      const hero = createAsset({ trigger: '@Hero' });
      const { result } = renderHook(() =>
        useDetectedAssets('@hero and @HERO in prompt', [hero])
      );

      expect(result.current.detectedAssets).toEqual([hero]);
      expect(result.current.unresolvedTriggers).toEqual([]);
      expect(result.current.hasCharacter).toBe(true);
      expect(result.current.characterCount).toBe(1);
    });
  });

  describe('core behavior', () => {
    it('returns unresolved triggers that are not in the asset list', () => {
      const hero = createAsset({ trigger: '@hero' });
      const { result } = renderHook(() =>
        useDetectedAssets('Use @hero with @style', [hero])
      );

      expect(result.current.detectedAssets).toEqual([hero]);
      expect(result.current.unresolvedTriggers).toEqual(['style']);
    });
  });
});
