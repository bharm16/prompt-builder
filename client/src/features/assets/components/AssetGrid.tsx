import React from 'react';
import type { Asset } from '@shared/types/asset';
import AssetCard from './AssetCard';

interface AssetGridProps {
  assets: Asset[];
  selectedAsset: Asset | null;
  onSelect: (asset: Asset) => void;
  onEdit: (asset: Asset) => void;
  onDelete: (assetId: string) => void;
  onSelectForGeneration?: ((asset: Asset) => void) | undefined;
}

export function AssetGrid({
  assets,
  selectedAsset,
  onSelect,
  onEdit,
  onDelete,
  onSelectForGeneration,
}: AssetGridProps): React.ReactElement {
  return (
    <div className="grid flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {assets.map((asset) => (
        <AssetCard
          key={asset.id}
          asset={asset}
          isSelected={selectedAsset?.id === asset.id}
          onSelect={onSelect}
          onEdit={onEdit}
          onDelete={onDelete}
          onUseInGeneration={onSelectForGeneration}
        />
      ))}
    </div>
  );
}

export default AssetGrid;
