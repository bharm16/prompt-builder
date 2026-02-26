import React, { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
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
  usePromptNavigation,
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
  onUploadSidebarImage?: (file: File) => Promise<{
    url: string;
    storagePath?: string;
    viewUrlExpiresAt?: string;
  } | null>;
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
  onUploadSidebarImage,
}: SidebarDataProviderProps): React.ReactElement {
  const { promptHistory, promptOptimizer } = usePromptServices();
  const { selectedModel } = usePromptConfig();
  const { sessionId: routeSessionId } = usePromptNavigation();
  const { initialHighlights } = usePromptHighlights();
  const { currentPromptUuid, currentPromptDocId } = usePromptSession();
  const { handleCreateNew, loadFromHistory } = usePromptActions();
  const {
    setKeyframes,
    setStartFrame,
    clearEndFrame,
    clearVideoReferences,
    clearExtendVideo,
  } = useGenerationControlsStoreActions();
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
    clearEndFrame,
    clearVideoReferences,
    clearExtendVideo,
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
  const sessionScopeId =
    routeSessionId?.trim() || currentPromptUuid?.trim() || 'draft';
  const galleryStorageKey = useMemo(
    () => `prompt-optimizer:gallery-open:${sessionScopeId}`,
    [sessionScopeId]
  );
  const [galleryOpen, setGalleryOpen] = useState<boolean>(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem(galleryStorageKey);
      if (stored === null) {
        setGalleryOpen(true);
        return;
      }
      setGalleryOpen(stored !== 'false');
    } catch {
      setGalleryOpen(true);
    }
  }, [galleryStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(galleryStorageKey, String(galleryOpen));
    } catch {
      // Ignore local storage failures.
    }
  }, [galleryOpen, galleryStorageKey]);

  const toggleGallery = useCallback(() => {
    setGalleryOpen((previous) => !previous);
  }, []);

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
      ...(onUploadSidebarImage ? { onUploadSidebarImage } : {}),
    }),
    [controls, onImageUpload, onStartFrameUpload, onUploadSidebarImage]
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

  const workspace = useMemo(
    () => ({
      galleryOpen,
      setGalleryOpen,
      toggleGallery,
    }),
    [galleryOpen, toggleGallery]
  );

  const value = useMemo(
    () => ({
      sessions,
      promptInteraction,
      generation,
      assets: assetsDomain,
      workspace,
    }),
    [assetsDomain, generation, promptInteraction, sessions, workspace]
  );

  return <SidebarDataContextProvider value={value}>{children}</SidebarDataContextProvider>;
}
