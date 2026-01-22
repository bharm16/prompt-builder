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

interface TriggerSuggestionProps {
  asset: Asset;
  isSelected: boolean;
  onSelect: () => void;
}

export function TriggerSuggestion({
  asset,
  isSelected,
  onSelect,
}: TriggerSuggestionProps): React.ReactElement {
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
      className={cn(
        'flex w-full items-center gap-3 px-3 py-2 text-left transition',
        isSelected ? 'bg-surface-2' : 'hover:bg-surface-2/70'
      )}
      onClick={onSelect}
    >
      <div
        className={cn(
          'flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-md',
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
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-foreground">
            {triggerLabel}
          </span>
          <span className="text-xs text-muted capitalize">{asset.type}</span>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted">
          {asset.textDefinition || asset.name}
        </p>
      </div>
    </button>
  );
}

export default TriggerSuggestion;
