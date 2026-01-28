import React from 'react';
import { Box, ChevronDown, MapPin, Palette, Plus, User } from '@promptstudio/system/components/ui';
import type { Asset, AssetType } from '@shared/types/asset';
import { cn } from '@/utils/cn';
import { getAssetTypeConfig } from '@/features/assets/config/assetConfig';
import { AssetThumbnail } from './AssetThumbnail';

const TYPE_ICONS: Record<AssetType, React.ComponentType<{ className?: string }>> = {
  character: User,
  style: Palette,
  location: MapPin,
  object: Box,
};

interface AssetTypeSectionProps {
  type: AssetType;
  assets: Asset[];
  isExpanded: boolean;
  onToggle: () => void;
  onInsertTrigger: (trigger: string) => void;
  onCreateAsset: () => void;
  onEditAsset: (assetId: string) => void;
}

export function AssetTypeSection({
  type,
  assets,
  isExpanded,
  onToggle,
  onInsertTrigger,
  onCreateAsset,
  onEditAsset,
}: AssetTypeSectionProps): React.ReactElement {
  const config = getAssetTypeConfig(type);
  const Icon = TYPE_ICONS[type] || Box;

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-2 text-left transition hover:bg-surface-2"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded-md',
              config.bgClass
            )}
          >
            <Icon className={cn('h-3.5 w-3.5', config.colorClass)} />
          </div>
          <span className="text-sm font-semibold text-foreground">
            {config.label}
          </span>
          <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[11px] text-muted">
            {assets.length}
          </span>
        </div>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-muted transition-transform',
            isExpanded && 'rotate-180'
          )}
        />
      </button>

      {isExpanded && (
        <div className="p-3 pt-1">
          {assets.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-surface-2 p-4 text-center">
              <p className="text-xs text-muted">No {config.label.toLowerCase()} assets yet</p>
              <button
                type="button"
                onClick={onCreateAsset}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-semibold text-foreground transition hover:bg-surface-3"
              >
                <Plus className="h-3 w-3" />
                Add {config.label}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {assets.map((asset) => (
                <AssetThumbnail
                  key={asset.id}
                  asset={asset}
                  onInsert={() => onInsertTrigger(asset.trigger)}
                  onEdit={() => onEditAsset(asset.id)}
                />
              ))}
              <button
                type="button"
                onClick={onCreateAsset}
                className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border bg-surface-2 text-xs text-muted transition hover:bg-surface-3"
              >
                <Plus className="h-4 w-4" />
                Add
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AssetTypeSection;
