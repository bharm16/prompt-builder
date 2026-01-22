import React from 'react';
import { Box, MapPin, Palette, User } from 'lucide-react';
import type { Asset } from '@shared/types/asset';
import { cn } from '@/utils/cn';
import { getAssetTypeConfig } from '@/features/assets/config/assetConfig';

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  character: User,
  style: Palette,
  location: MapPin,
  object: Box,
};

interface AssetThumbnailProps {
  asset: Asset;
  onInsert: () => void;
  onEdit: () => void;
}

export function AssetThumbnail({
  asset,
  onInsert,
  onEdit,
}: AssetThumbnailProps): React.ReactElement {
  const primaryImage =
    asset.referenceImages?.find((img) => img.isPrimary) ||
    asset.referenceImages?.[0];
  const config = getAssetTypeConfig(asset.type);
  const Icon = TYPE_ICONS[asset.type] || Box;
  const triggerLabel = asset.trigger.startsWith('@')
    ? asset.trigger
    : `@${asset.trigger}`;

  return (
    <button
      type="button"
      onClick={onInsert}
      onContextMenu={(event) => {
        event.preventDefault();
        onEdit();
      }}
      className="flex w-full flex-col gap-1 rounded-lg bg-surface-2 p-1 text-left transition hover:bg-surface-3"
      title={asset.name}
    >
      <div
        className={cn(
          'flex aspect-square w-full items-center justify-center overflow-hidden rounded-md',
          primaryImage ? 'bg-surface-3' : config.bgClass
        )}
      >
        {primaryImage ? (
          <img
            src={primaryImage.thumbnailUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <Icon className={cn('h-5 w-5', config.colorClass)} />
        )}
      </div>
      <span className="truncate px-1 text-[11px] text-muted">{triggerLabel}</span>
    </button>
  );
}

export default AssetThumbnail;
