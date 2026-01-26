import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAssetState } from '../hooks/useAssetState';
import type { Asset } from '@shared/types/asset';

const makeAsset = (overrides?: Partial<Asset>): Asset => ({
  id: 'a1',
  userId: 'u1',
  type: 'character',
  trigger: '@Ada',
  name: 'Ada',
  textDefinition: 'Text',
  referenceImages: [],
  usageCount: 0,
  lastUsedAt: null,
  createdAt: 'now',
  updatedAt: 'now',
  ...overrides,
});

describe('useAssetState', () => {
  describe('error handling', () => {
    it('sets error and clears loading state', () => {
      const { result } = renderHook(() => useAssetState());

      act(() => {
        result.current.actions.setLoading(true);
      });

      act(() => {
        result.current.actions.setError('Failed');
      });

      expect(result.current.state.isLoading).toBe(false);
      expect(result.current.state.error).toBe('Failed');
    });

    it('does not decrement counts when deleting missing asset', () => {
      const { result } = renderHook(() => useAssetState());

      act(() => {
        result.current.actions.deleteAsset('missing');
      });

      expect(result.current.state.byType.character).toBe(0);
      expect(result.current.state.assets).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('filters assets by selected type', () => {
      const { result } = renderHook(() => useAssetState());
      const character = makeAsset({ id: 'c1', type: 'character' });
      const style = makeAsset({ id: 's1', type: 'style', trigger: '@Style' });

      act(() => {
        result.current.actions.setAssets({
          assets: [character, style],
          total: 2,
          byType: { character: 1, style: 1, location: 0, object: 0 },
        });
        result.current.actions.setFilter('style');
      });

      expect(result.current.filteredAssets).toEqual([style]);
    });

    it('opens and closes the editor with selected asset', () => {
      const { result } = renderHook(() => useAssetState());
      const asset = makeAsset({ id: 'x1' });

      act(() => {
        result.current.actions.openEditor('edit', asset, asset.type);
      });

      expect(result.current.state.editorOpen).toBe(true);
      expect(result.current.state.selectedAsset?.id).toBe('x1');

      act(() => {
        result.current.actions.closeEditor();
      });

      expect(result.current.state.editorOpen).toBe(false);
      expect(result.current.state.editorAssetType).toBeNull();
    });
  });

  describe('core behavior', () => {
    it('adds assets to the front and increments counts', () => {
      const { result } = renderHook(() => useAssetState());
      const asset = makeAsset({ id: 'new1', type: 'location' });

      act(() => {
        result.current.actions.addAsset(asset);
      });

      expect(result.current.state.assets[0]).toEqual(asset);
      expect(result.current.state.byType.location).toBe(1);
    });

    it('updates selected asset when asset changes', () => {
      const { result } = renderHook(() => useAssetState());
      const asset = makeAsset({ id: 'a1', name: 'Old' });
      const updated = { ...asset, name: 'New' };

      act(() => {
        result.current.actions.setAssets({
          assets: [asset],
          total: 1,
          byType: { character: 1, style: 0, location: 0, object: 0 },
        });
        result.current.actions.selectAsset(asset);
        result.current.actions.updateAsset(updated);
      });

      expect(result.current.state.selectedAsset?.name).toBe('New');
    });
  });
});
