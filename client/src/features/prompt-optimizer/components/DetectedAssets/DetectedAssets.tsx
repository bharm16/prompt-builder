import React from 'react';
import { Check } from 'lucide-react';
import type { Asset } from '@shared/types/asset';
import {
  TooltipProvider,
} from '@promptstudio/system/components/ui/tooltip';
import { useDetectedAssets } from './hooks/useDetectedAssets';
import { AssetChip } from './AssetChip';

interface DetectedAssetsProps {
  prompt: string;
  assets: Asset[];
  onEditAsset?: (assetId: string) => void;
  onCreateFromTrigger?: (trigger: string) => void;
}

export function DetectedAssets({
  prompt,
  assets,
  onEditAsset,
  onCreateFromTrigger,
}: DetectedAssetsProps): React.ReactElement | null {
  const { detectedAssets, unresolvedTriggers, hasCharacter } = useDetectedAssets(
    prompt,
    assets
  );

  if (detectedAssets.length === 0 && unresolvedTriggers.length === 0) {
    return null;
  }

  return (
    <div className="border-b border-border bg-surface-1 px-ps-4 py-2">
      <TooltipProvider delayDuration={100}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">Using:</span>

          {detectedAssets.map((asset) => (
            <AssetChip
              key={asset.id}
              asset={asset}
              onEdit={onEditAsset ? () => onEditAsset(asset.id) : undefined}
            />
          ))}

          {unresolvedTriggers.map((trigger) => (
            <button
              key={trigger}
              type="button"
              onClick={() => onCreateFromTrigger?.(trigger)}
              className="rounded border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-600"
            >
              @{trigger} (create?)
            </button>
          ))}

          {hasCharacter && (
            <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
              <Check className="h-3 w-3" />
              Character consistency enabled
            </span>
          )}
        </div>
      </TooltipProvider>
    </div>
  );
}

export default DetectedAssets;
