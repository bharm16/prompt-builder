import React from 'react';
import { User, Palette, MapPin, Box } from 'lucide-react';
import type { AssetType } from '@shared/types/asset';
import { ASSET_TYPE_LIST } from '../config/assetConfig';

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  character: User,
  style: Palette,
  location: MapPin,
  object: Box,
};

interface AssetTypeSelectorProps {
  value: AssetType;
  onChange: (type: AssetType) => void;
}

export function AssetTypeSelector({ value, onChange }: AssetTypeSelectorProps): React.ReactElement {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {ASSET_TYPE_LIST.map((typeConfig) => {
        const Icon = TYPE_ICONS[typeConfig.id] || Box;
        const isActive = value === typeConfig.id;
        return (
          <button
            key={typeConfig.id}
            type="button"
            onClick={() => onChange(typeConfig.id as AssetType)}
            className={`flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors ${
              isActive
                ? `${typeConfig.bgClass} ${typeConfig.borderClass} ${typeConfig.colorClass}`
                : 'border-border text-muted hover:border-border-strong'
            }`}
          >
            <Icon className="h-4 w-4" />
            <span>{typeConfig.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default AssetTypeSelector;
