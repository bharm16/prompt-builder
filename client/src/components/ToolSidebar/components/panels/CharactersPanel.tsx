import type { ReactElement } from 'react';
import { Plus, Users } from '@promptstudio/system/components/ui';
import type { Asset, AssetType } from '@shared/types/asset';
import { AssetThumbnail } from '@features/prompt-optimizer/components/AssetsSidebar/AssetThumbnail';
import {
  useSidebarAssetsDomain,
  useSidebarPromptInteractionDomain,
} from '@/components/ToolSidebar/context';

interface CharactersPanelProps {
  assets?: Asset[];
  characterAssets?: Asset[];
  isLoading?: boolean;
  onInsertTrigger?: (trigger: string) => void;
  onEditAsset?: (assetId: string) => void;
  onCreateAsset?: (type: AssetType) => void;
}

const noopWithString = (_value: string): void => {};
const noopCreate = (_type: AssetType): void => {};

export function CharactersPanel(props: CharactersPanelProps): ReactElement {
  const assetsDomain = useSidebarAssetsDomain();
  const promptInteractionDomain = useSidebarPromptInteractionDomain();

  const assets = props.assets ?? assetsDomain?.assets ?? [];
  const characterAssets = props.characterAssets ?? assetsDomain?.assetsByType.character ?? [];
  const isLoading = props.isLoading ?? assetsDomain?.isLoadingAssets ?? false;
  const onInsertTrigger =
    props.onInsertTrigger ?? promptInteractionDomain?.onInsertTrigger ?? noopWithString;
  const onEditAsset = props.onEditAsset ?? assetsDomain?.onEditAsset ?? noopWithString;
  const onCreateAsset = props.onCreateAsset ?? assetsDomain?.onCreateAsset ?? noopCreate;

  const items = characterAssets.length
    ? characterAssets
    : assets.filter((asset) => asset.type === 'character');

  return (
    <div className="flex flex-col h-full">
      <div className="h-12 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-[#A1AFC5]" />
          <h2 className="text-sm font-semibold text-white">Characters</h2>
        </div>
        <button
          type="button"
          onClick={() => onCreateAsset('character')}
          className="h-7 px-2.5 rounded-md bg-[#2C3037] text-xs font-medium text-[#A1AFC5]"
        >
          <span className="inline-flex items-center gap-1">
            <Plus className="h-3 w-3" />
            New
          </span>
        </button>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#B3AFFD] border-t-transparent" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-3">
          <div className="text-sm text-[#A1AFC5]">No characters yet</div>
          <button
            type="button"
            onClick={() => onCreateAsset('character')}
            className="h-8 px-3 rounded-md border border-[#2C3037] text-sm text-[#A1AFC5]"
          >
            Create character
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
