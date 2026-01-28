import React from 'react';
import { Box, MapPin, Palette, User } from '@promptstudio/system/components/ui';
import type { Asset } from '@shared/types/asset';
import { cn } from '@/utils/cn';
import { getAssetTypeConfig } from '@/features/assets/config/assetConfig';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@promptstudio/system/components/ui/tooltip';
import { AssetPopover } from './AssetPopover';

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  character: User,
  style: Palette,
  location: MapPin,
  object: Box,
};

interface AssetChipProps {
  asset: Asset;
  onEdit?: (() => void) | undefined;
}

export function AssetChip({ asset, onEdit }: AssetChipProps): React.ReactElement {
  const Icon = TYPE_ICONS[asset.type] || Box;
  const config = getAssetTypeConfig(asset.type);
  const triggerLabel = asset.trigger.startsWith('@')
    ? asset.trigger
    : `@${asset.trigger}`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold transition',
            'bg-surface-2 text-foreground hover:bg-surface-3',
            config.colorClass
          )}
        >
          <Icon className="h-3 w-3" />
          <span>{triggerLabel}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="bg-surface-1 p-0">
        <AssetPopover asset={asset} onEdit={onEdit} />
      </TooltipContent>
    </Tooltip>
  );
}

export default AssetChip;
