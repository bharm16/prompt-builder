import React from 'react';
import { Check } from 'lucide-react';
import type { Asset } from '@shared/types/asset';
import { getAssetTypeConfig } from '@/features/assets/config/assetConfig';
import { cn } from '@/utils/cn';

interface AssetPopoverProps {
  asset: Asset;
  onEdit?: (() => void) | undefined;
}

export function AssetPopover({ asset, onEdit }: AssetPopoverProps): React.ReactElement {
  const primaryImage =
    asset.referenceImages?.find((img) => img.isPrimary) ||
    asset.referenceImages?.[0];
  const primaryImageUrl = primaryImage?.thumbnailUrl || primaryImage?.url;
  const config = getAssetTypeConfig(asset.type);
  const triggerLabel = asset.trigger.startsWith('@')
    ? asset.trigger
    : `@${asset.trigger}`;

  return (
    <div className="w-64 p-3">
      <div className="flex gap-3">
        <div
          className={cn(
            'flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg',
            primaryImageUrl ? 'bg-surface-2' : config.bgClass
          )}
        >
          {primaryImageUrl ? (
            <img
              src={primaryImageUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <span className={cn('text-xs font-semibold', config.colorClass)}>
              {config.label}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-foreground">{asset.name}</h4>
          <p className="text-xs text-muted">{triggerLabel}</p>
          <p className="mt-1 text-xs text-muted">
            {asset.referenceImages?.length || 0} reference images
          </p>
        </div>
      </div>

      {asset.type === 'character' && asset.faceEmbedding && (
        <div className="mt-2 flex items-center gap-1 text-xs text-emerald-600">
          <Check className="h-3 w-3" />
          Face embedding ready
        </div>
      )}

      {asset.textDefinition && (
        <p className="mt-2 text-xs text-muted line-clamp-3">{asset.textDefinition}</p>
      )}

      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="mt-3 w-full rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-surface-2"
        >
          Edit Asset
        </button>
      )}
    </div>
  );
}

export default AssetPopover;
