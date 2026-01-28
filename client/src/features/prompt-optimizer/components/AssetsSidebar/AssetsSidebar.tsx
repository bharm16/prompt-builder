import React from 'react';
import { Layers, Plus } from '@promptstudio/system/components/ui';
import type { Asset, AssetType } from '@shared/types/asset';
import { AssetTypeSection } from './AssetTypeSection';

interface AssetsSidebarProps {
  assets: Asset[];
  byType: Record<AssetType, Asset[]>;
  isLoading: boolean;
  error: string | null;
  expandedSections: Set<AssetType>;
  onToggleSection: (type: AssetType) => void;
  onInsertTrigger: (trigger: string) => void;
  onEditAsset: (assetId: string) => void;
  onCreateAsset: (type: AssetType) => void;
}

export function AssetsSidebar({
  assets,
  byType,
  isLoading,
  error,
  expandedSections,
  onToggleSection,
  onInsertTrigger,
  onEditAsset,
  onCreateAsset,
}: AssetsSidebarProps): React.ReactElement {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted" />
          <span className="text-sm font-semibold text-foreground">My Assets</span>
        </div>
        <button
          type="button"
          onClick={() => onCreateAsset('character')}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-semibold text-foreground transition hover:bg-surface-2"
        >
          <Plus className="h-3 w-3" />
          New
        </button>
      </div>

      {error && (
        <div className="border-y border-border bg-red-50 px-4 py-2">
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {isLoading && assets.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          </div>
        ) : (
          <div className="flex flex-col">
            {(Object.keys(byType) as AssetType[]).map((type) => (
              <AssetTypeSection
                key={type}
                type={type}
                assets={byType[type]}
                isExpanded={expandedSections.has(type)}
                onToggle={() => onToggleSection(type)}
                onInsertTrigger={onInsertTrigger}
                onCreateAsset={() => onCreateAsset(type)}
                onEditAsset={onEditAsset}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default AssetsSidebar;
