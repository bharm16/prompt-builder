import React, { type ReactNode } from 'react';
import type { Asset, AssetType } from '@shared/types/asset';
import { SidebarAssetsContextProvider } from '@/components/ToolSidebar/context';

interface SidebarAssetsProviderProps {
  children: ReactNode;
  assets: Asset[];
  assetsByType: Record<AssetType, Asset[]>;
  isLoadingAssets: boolean;
  onEditAsset: (assetId: string) => void;
  onCreateAsset: (type: AssetType) => void;
}

export function SidebarAssetsProvider({
  children,
  assets,
  assetsByType,
  isLoadingAssets,
  onEditAsset,
  onCreateAsset,
}: SidebarAssetsProviderProps): React.ReactElement {
  const value = {
    assets,
    assetsByType,
    isLoadingAssets,
    onEditAsset,
    onCreateAsset,
  };

  return <SidebarAssetsContextProvider value={value}>{children}</SidebarAssetsContextProvider>;
}
