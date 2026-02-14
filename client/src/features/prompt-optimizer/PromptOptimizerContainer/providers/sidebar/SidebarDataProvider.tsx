import React, { useMemo, type ReactNode } from 'react';
import type { Asset, AssetType } from '@shared/types/asset';
import type { DraftModel, GenerationOverrides } from '@/components/ToolSidebar/types';
import { SidebarDataContextProvider } from '@/components/ToolSidebar/context';
import { useGenerationControlsStoreActions } from '@/features/prompt-optimizer/context/GenerationControlsStore';
import { useGenerationControlsContext } from '@/features/prompt-optimizer/context/GenerationControlsContext';
import { usePromptInsertionBus } from '@/features/prompt-optimizer/context/PromptInsertionBusContext';
import {
  usePromptActions,
  usePromptConfig,
  usePromptHighlights,
  usePromptServices,
  usePromptSession,
} from '@/features/prompt-optimizer/context/PromptStateContext';
import { usePromptHistoryActions } from '@/features/prompt-optimizer/PromptOptimizerContainer/hooks';
import {
  resolveActiveModelLabel,
  resolveActiveStatusLabel,
} from '@/features/prompt-optimizer/utils/activeStatusLabel';

interface SidebarDataProviderProps {
  children: ReactNode;
  assets: Asset[];
  assetsByType: Record<AssetType, Asset[]>;
  isLoadingAssets: boolean;
  onEditAsset: (assetId: string) => void;
  onCreateAsset: (type: AssetType) => void;
  onCreateFromTrigger?: (trigger: string) => void;
  onImageUpload?: (file: File) => void | Promise<void>;
  onStartFrameUpload?: (file: File) => void | Promise<void>;
}

export function SidebarDataProvider({
  children,
  assets,
  assetsByType,
  isLoadingAssets,
  onEditAsset,
  onCreateAsset,
  onCreateFromTrigger,
  onImageUpload,
  onStartFrameUpload,
}: SidebarDataProviderProps): React.ReactElement {
  const { promptHistory, promptOptimizer } = usePromptServices();
  const { selectedModel } = usePromptConfig();
  const { initialHighlights } = usePromptHighlights();
  const { currentPromptUuid, currentPromptDocId } = usePromptSession();
  const { handleCreateNew, loadFromHistory } = usePromptActions();
  const { setKeyframes, setStartFrame } = useGenerationControlsStoreActions();
  const { controls } = useGenerationControlsContext();
  const { insertAtCaret } = usePromptInsertionBus();

  const {
    handleLoadFromHistory,
    handleCreateNewWithKeyframes,
    handleDuplicate,
    handleRename,
  } = usePromptHistoryActions({
    promptHistory,
    setKeyframes,
    setStartFrame,
    loadFromHistory,
    handleCreateNew,
  });

  const activeStatusLabel = resolveActiveStatusLabel({
    inputPrompt: promptOptimizer.inputPrompt,
    displayedPrompt: promptOptimizer.displayedPrompt,
    isProcessing: promptOptimizer.isProcessing,
    isRefining: promptOptimizer.isRefining,
    hasHighlights: Boolean(initialHighlights),
  });
  const activeModelLabel = resolveActiveModelLabel(selectedModel);

  const sessions = useMemo(
    () => ({
      history: promptHistory.history,
      filteredHistory: promptHistory.filteredHistory,
      isLoadingHistory: promptHistory.isLoadingHistory,
      searchQuery: promptHistory.searchQuery,
      onSearchChange: promptHistory.setSearchQuery,
      onLoadFromHistory: handleLoadFromHistory,
      onCreateNew: handleCreateNewWithKeyframes,
      onDelete: promptHistory.deleteFromHistory,
      onDuplicate: handleDuplicate,
      onRename: handleRename,
      currentPromptUuid,
      currentPromptDocId,
      activeStatusLabel,
      activeModelLabel,
    }),
    [
      activeModelLabel,
      activeStatusLabel,
      currentPromptDocId,
      currentPromptUuid,
      handleCreateNewWithKeyframes,
      handleDuplicate,
      handleLoadFromHistory,
      handleRename,
      promptHistory.deleteFromHistory,
      promptHistory.filteredHistory,
      promptHistory.history,
      promptHistory.isLoadingHistory,
      promptHistory.searchQuery,
      promptHistory.setSearchQuery,
    ]
  );

  const promptInteraction = useMemo(
    () => ({
      isProcessing: promptOptimizer.isProcessing,
      isRefining: promptOptimizer.isRefining,
      ...(onCreateFromTrigger ? { onCreateFromTrigger } : {}),
      onInsertTrigger: insertAtCaret,
    }),
    [
      insertAtCaret,
      onCreateFromTrigger,
      promptOptimizer.isProcessing,
      promptOptimizer.isRefining,
    ]
  );

  const generation = useMemo(
    () => ({
      onDraft: (model: DraftModel, overrides?: GenerationOverrides): void => {
        controls?.onDraft?.(model, overrides);
      },
      onRender: (model: string, overrides?: GenerationOverrides): void => {
        controls?.onRender?.(model, overrides);
      },
      onStoryboard: (): void => {
        controls?.onStoryboard?.();
      },
      ...(onImageUpload ? { onImageUpload } : {}),
      ...(onStartFrameUpload ? { onStartFrameUpload } : {}),
    }),
    [controls, onImageUpload, onStartFrameUpload]
  );

  const assetsDomain = useMemo(
    () => ({
      assets,
      assetsByType,
      isLoadingAssets,
      onEditAsset,
      onCreateAsset,
    }),
    [assets, assetsByType, isLoadingAssets, onCreateAsset, onEditAsset]
  );

  const value = useMemo(
    () => ({
      sessions,
      promptInteraction,
      generation,
      assets: assetsDomain,
    }),
    [assetsDomain, generation, promptInteraction, sessions]
  );

  return <SidebarDataContextProvider value={value}>{children}</SidebarDataContextProvider>;
}
