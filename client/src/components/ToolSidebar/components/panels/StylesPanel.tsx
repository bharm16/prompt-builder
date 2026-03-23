import type { ReactElement } from 'react';
import { Palette, Plus } from '@promptstudio/system/components/ui';
import type { Asset, AssetType } from '@shared/types/asset';
import { AssetThumbnail } from '@features/prompt-optimizer/components/AssetsSidebar/AssetThumbnail';
import {
  useSidebarAssetsDomain,
  useSidebarPromptInteractionDomain,
} from '@/components/ToolSidebar/context';

interface StylesPanelProps {
  assets?: Asset[];
  styleAssets?: Asset[];
  isLoading?: boolean;
  onInsertTrigger?: (trigger: string) => void;
  onEditAsset?: (assetId: string) => void;
  onCreateAsset?: (type: AssetType) => void;
}

const noopWithString = (_value: string): void => {};
const noopCreate = (_type: AssetType): void => {};

export function StylesPanel(props: StylesPanelProps): ReactElement {
  const assetsDomain = useSidebarAssetsDomain();
  const promptInteractionDomain = useSidebarPromptInteractionDomain();

  const assets = props.assets ?? assetsDomain?.assets ?? [];
  const styleAssets = props.styleAssets ?? assetsDomain?.assetsByType.style ?? [];
  const isLoading = props.isLoading ?? assetsDomain?.isLoadingAssets ?? false;
  const onInsertTrigger =
    props.onInsertTrigger ?? promptInteractionDomain?.onInsertTrigger ?? noopWithString;
  const onEditAsset = props.onEditAsset ?? assetsDomain?.onEditAsset ?? noopWithString;
  const onCreateAsset = props.onCreateAsset ?? assetsDomain?.onCreateAsset ?? noopCreate;

  const items = styleAssets.length
    ? styleAssets
    : assets.filter((asset) => asset.type === 'style');

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-ghost" />
          <h2 className="text-sm font-semibold text-white">Styles</h2>
        </div>
        <button
          type="button"
          onClick={() => onCreateAsset('style')}
          className="h-7 rounded-md bg-surface-2 px-2.5 text-xs font-medium text-ghost"
        >
          <span className="inline-flex items-center gap-1">
            <Plus className="h-3 w-3" />
            New
          </span>
        </button>
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-tool-accent-purple border-t-transparent" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <div className="text-sm text-ghost">No styles yet</div>
          <button
            type="button"
            onClick={() => onCreateAsset('style')}
            className="h-8 rounded-md border border-tool-border-primary px-3 text-sm text-ghost"
          >
            Create style
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <div className="grid grid-cols-2 gap-3">
            {items.map((asset) => (
              <AssetThumbnail
                key={asset.id}
                asset={asset}
                onInsert={() => onInsertTrigger(asset.trigger)}
                onEdit={() => onEditAsset(asset.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
