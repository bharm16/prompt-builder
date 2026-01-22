import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Asset, AssetType } from '@shared/types/asset';
import { assetsSidebarApi } from '../api/assetsSidebarApi';

const DEFAULT_EXPANDED: AssetType[] = ['character', 'style', 'location', 'object'];

export function useAssetsSidebar() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<AssetType>>(
    () => new Set(DEFAULT_EXPANDED)
  );

  const refresh = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await assetsSidebarApi.list();
      setAssets(result.assets ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assets');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const byType = useMemo(() => {
    const grouped: Record<AssetType, Asset[]> = {
      character: [],
      style: [],
      location: [],
      object: [],
    };
    for (const asset of assets) {
      grouped[asset.type]?.push(asset);
    }
    return grouped;
  }, [assets]);

  const toggleSection = useCallback((type: AssetType) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  return {
    assets,
    byType,
    isLoading,
    error,
    expandedSections,
    toggleSection,
    refresh,
  };
}

export default useAssetsSidebar;
