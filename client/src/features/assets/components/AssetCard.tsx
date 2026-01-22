import React from 'react';
import { Edit, Trash2, Wand2, User, Palette, MapPin, Box } from 'lucide-react';
import type { Asset } from '@shared/types/asset';
import { getAssetTypeConfig } from '../config/assetConfig';

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  character: User,
  style: Palette,
  location: MapPin,
  object: Box,
};

interface AssetCardProps {
  asset: Asset;
  isSelected: boolean;
  onSelect: (asset: Asset) => void;
  onEdit: (asset: Asset) => void;
  onDelete: (assetId: string) => void;
  onUseInGeneration?: (asset: Asset) => void;
}

export function AssetCard({
  asset,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  onUseInGeneration,
}: AssetCardProps): React.ReactElement {
  const config = getAssetTypeConfig(asset.type);
  const TypeIcon = TYPE_ICONS[asset.type] || Box;

  const primaryImage =
    asset.referenceImages?.find((img) => img.isPrimary) || asset.referenceImages?.[0];

  return (
    <div
      onClick={() => onSelect(asset)}
      className={`group relative overflow-hidden rounded-xl border transition-all ${
        isSelected ? 'border-border-strong shadow-sm' : 'border-border hover:shadow-sm'
      }`}
    >
      <div className="aspect-square bg-surface-2">
        {primaryImage ? (
          <img
            src={primaryImage.thumbnailUrl || primaryImage.url}
            alt={asset.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className={`flex h-full w-full items-center justify-center ${config.bgClass}`}>
            <TypeIcon className={`h-12 w-12 ${config.colorClass} opacity-60`} />
          </div>
        )}
      </div>

      <div
        className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-xs font-medium ${config.bgClass} ${config.colorClass}`}
      >
        {config.label}
      </div>

      <div className="absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100">
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 via-black/10 to-transparent px-3 pb-3 pt-6">
          <div className="flex gap-1">
            {asset.type === 'character' && onUseInGeneration && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onUseInGeneration(asset);
                }}
                className="rounded-md bg-violet-600 p-1.5 text-white transition-colors hover:bg-violet-500"
                title="Use in generation"
              >
                <Wand2 className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onEdit(asset);
              }}
              className="rounded-md bg-black/60 p-1.5 text-white transition-colors hover:bg-black/70"
              title="Edit"
            >
              <Edit className="h-4 w-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              if (window.confirm(`Delete "${asset.name}"?`)) {
                onDelete(asset.id);
              }
            }}
            className="rounded-md bg-black/60 p-1.5 text-white transition-colors hover:bg-red-600"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="space-y-1 bg-surface-1 px-3 py-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-foreground">{asset.name}</h3>
            <p className={`truncate text-xs ${config.colorClass}`}>{asset.trigger}</p>
          </div>
        </div>
        <p className="ps-line-clamp-2 text-xs text-muted">{asset.textDefinition}</p>
        <p className="text-xs text-muted">
          {(asset.referenceImages?.length || 0).toString()} image
          {asset.referenceImages?.length !== 1 ? 's' : ''}
          {asset.usageCount > 0 ? ` · Used ${asset.usageCount}x` : ''}
        </p>
      </div>
    </div>
  );
}

export default AssetCard;
