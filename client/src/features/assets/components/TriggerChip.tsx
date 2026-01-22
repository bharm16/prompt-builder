import React from 'react';
import { User, Palette, MapPin, Box } from 'lucide-react';
import { getAssetTypeConfig } from '../config/assetConfig';

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  character: User,
  style: Palette,
  location: MapPin,
  object: Box,
};

interface TriggerChipProps {
  asset: { type: string; trigger: string };
  onClick?: () => void;
  onRemove?: () => void;
  showRemove?: boolean;
  size?: 'small' | 'default';
}

export function TriggerChip({
  asset,
  onClick,
  onRemove,
  showRemove = false,
  size = 'default',
}: TriggerChipProps): React.ReactElement {
  const config = getAssetTypeConfig(asset.type);
  const Icon = TYPE_ICONS[asset.type] || Box;

  const sizeClasses = {
    small: 'text-xs px-1.5 py-0.5 gap-1',
    default: 'text-sm px-2 py-1 gap-1.5',
  };

  const iconSizes = {
    small: 'h-3 w-3',
    default: 'h-3.5 w-3.5',
  };

  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center rounded-md border ${config.bgClass} ${config.colorClass} ${config.borderClass} ${
        sizeClasses[size]
      } cursor-pointer font-medium transition-colors hover:brightness-105`}
    >
      <Icon className={iconSizes[size]} />
      <span>{asset.trigger}</span>
      {showRemove && onRemove && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          className="ml-1 text-xs hover:text-foreground"
        >
          x
        </button>
      )}
    </span>
  );
}

export function TriggerChipInline({ trigger, type }: { trigger: string; type: string }) {
  const config = getAssetTypeConfig(type);
  return (
    <span className={`${config.bgClass} ${config.colorClass} rounded px-1`}>{trigger}</span>
  );
}

export default TriggerChip;
