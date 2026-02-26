import React, { useEffect, useState } from 'react';
import { Box, MapPin, Palette, User } from '@promptstudio/system/components/ui';
import type { Asset } from '@shared/types/asset';
import { cn } from '@/utils/cn';
import { getAssetTypeConfig } from '@/features/assets/config/assetConfig';
import { useResolvedMediaUrl } from '@/hooks/useResolvedMediaUrl';

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
  const thumbnailUrl = primaryImage?.thumbnailUrl?.trim?.() ?? '';
  const fullUrl = primaryImage?.url?.trim?.() ?? '';
  const { url: resolvedThumbnailUrl } = useResolvedMediaUrl({
    kind: 'image',
    url: thumbnailUrl || null,
    storagePath: primaryImage?.thumbnailPath ?? null,
    enabled: Boolean(thumbnailUrl || primaryImage?.thumbnailPath),
  });
  const { url: resolvedFullUrl } = useResolvedMediaUrl({
    kind: 'image',
    url: fullUrl || null,
    storagePath: primaryImage?.storagePath ?? null,
    enabled: Boolean(fullUrl || primaryImage?.storagePath),
  });
  const preferredThumbnailUrl = resolvedThumbnailUrl || thumbnailUrl;
  const preferredFullUrl = resolvedFullUrl || fullUrl;
  const [imageUrl, setImageUrl] = useState(preferredThumbnailUrl || preferredFullUrl);
  const [didTryFull, setDidTryFull] = useState(false);
  const config = getAssetTypeConfig(asset.type);
  const Icon = TYPE_ICONS[asset.type] || Box;
  const triggerLabel = asset.trigger.startsWith('@')
    ? asset.trigger
    : `@${asset.trigger}`;

  useEffect(() => {
    setImageUrl(preferredThumbnailUrl || preferredFullUrl);
    setDidTryFull(false);
  }, [preferredThumbnailUrl, preferredFullUrl, primaryImage?.id]);

  const handleImageError = () => {
    if (!didTryFull && preferredFullUrl && imageUrl !== preferredFullUrl) {
      setDidTryFull(true);
      setImageUrl(preferredFullUrl);
      return;
    }
    setImageUrl('');
  };

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
          imageUrl ? 'bg-surface-3' : config.bgClass
        )}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className="h-full w-full object-cover"
            onError={handleImageError}
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
