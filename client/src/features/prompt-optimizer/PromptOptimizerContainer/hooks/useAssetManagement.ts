import { useCallback, useState } from 'react';
import type { Asset, AssetType } from '@shared/types/asset';
import { assetApi } from '@/features/assets/api/assetApi';

interface AssetEditorState {
  mode: 'create' | 'edit';
  asset?: Asset | null;
  preselectedType?: AssetType | null;
}

interface QuickCreateState {
  isOpen: boolean;
  prefillTrigger?: string;
}

interface UseAssetManagementOptions {
  assets: Asset[];
  refreshAssets: () => Promise<void>;
}

interface UseAssetManagementResult {
  assetEditorState: AssetEditorState | null;
  quickCreateState: QuickCreateState;
  handlers: {
    onEditAsset: (assetId: string) => void;
    onCreateAsset: (type: AssetType) => void;
    onCreateFromTrigger: (trigger: string) => void;
    onCloseAssetEditor: () => void;
    onCloseQuickCreate: () => void;
    onQuickCreateComplete: (asset: Asset) => Promise<void>;
    onCreate: (data: {
      type: AssetType;
      trigger: string;
      name: string;
      textDefinition?: string;
      negativePrompt?: string;
    }) => Promise<Asset>;
    onUpdate: (assetId: string, data: {
      trigger?: string;
      name?: string;
      textDefinition?: string;
      negativePrompt?: string;
    }) => Promise<Asset>;
    onAddImage: (assetId: string, file: File, metadata: Record<string, string | undefined>) => Promise<void>;
    onDeleteImage: (assetId: string, imageId: string) => Promise<void>;
    onSetPrimaryImage: (assetId: string, imageId: string) => Promise<void>;
  };
}

export function useAssetManagement({
  assets,
  refreshAssets,
}: UseAssetManagementOptions): UseAssetManagementResult {
  const [assetEditorState, setAssetEditorState] = useState<AssetEditorState | null>(null);
  const [quickCreateState, setQuickCreateState] = useState<QuickCreateState>({ isOpen: false });

  const handleEditAsset = useCallback(
    (assetId: string): void => {
      const asset = assets.find((item) => item.id === assetId) ?? null;
      if (!asset) return;
      setAssetEditorState({ mode: 'edit', asset });
    },
    [assets]
  );

  const handleCreateAsset = useCallback((type: AssetType): void => {
    if (type === 'character') {
      setQuickCreateState({ isOpen: true });
      return;
    }
    setAssetEditorState({ mode: 'create', preselectedType: type });
  }, []);

  const handleCreateFromTrigger = useCallback((trigger: string): void => {
    const trimmed = trigger.replace(/^@/, '');
    setQuickCreateState({ isOpen: true, prefillTrigger: trimmed });
  }, []);

  const closeAssetEditor = useCallback(() => {
    setAssetEditorState(null);
  }, []);

  const closeQuickCreate = useCallback(() => {
    setQuickCreateState({ isOpen: false });
  }, []);

  const handleQuickCreateComplete = useCallback(
    async (_asset: Asset): Promise<void> => {
      await refreshAssets();
      setQuickCreateState({ isOpen: false });
    },
    [refreshAssets]
  );

  const handleAssetCreate = useCallback(
    async (data: {
      type: AssetType;
      trigger: string;
      name: string;
      textDefinition?: string;
      negativePrompt?: string;
    }): Promise<Asset> => {
      const asset = await assetApi.create(data);
      await refreshAssets();
      return asset;
    },
    [refreshAssets]
  );

  const handleAssetUpdate = useCallback(
    async (
      assetId: string,
      data: { trigger?: string; name?: string; textDefinition?: string; negativePrompt?: string }
    ): Promise<Asset> => {
      const asset = await assetApi.update(assetId, data);
      await refreshAssets();
      return asset;
    },
    [refreshAssets]
  );

  const handleAddAssetImage = useCallback(
    async (
      assetId: string,
      file: File,
      metadata: Record<string, string | undefined>
    ): Promise<void> => {
      await assetApi.addImage(assetId, file, metadata);
      await refreshAssets();
    },
    [refreshAssets]
  );

  const handleDeleteAssetImage = useCallback(
    async (assetId: string, imageId: string): Promise<void> => {
      await assetApi.deleteImage(assetId, imageId);
      await refreshAssets();
    },
    [refreshAssets]
  );

  const handleSetPrimaryAssetImage = useCallback(
    async (assetId: string, imageId: string): Promise<void> => {
      await assetApi.setPrimaryImage(assetId, imageId);
      await refreshAssets();
    },
    [refreshAssets]
  );

  return {
    assetEditorState,
    quickCreateState,
    handlers: {
      onEditAsset: handleEditAsset,
      onCreateAsset: handleCreateAsset,
      onCreateFromTrigger: handleCreateFromTrigger,
      onCloseAssetEditor: closeAssetEditor,
      onCloseQuickCreate: closeQuickCreate,
      onQuickCreateComplete: handleQuickCreateComplete,
      onCreate: handleAssetCreate,
      onUpdate: handleAssetUpdate,
      onAddImage: handleAddAssetImage,
      onDeleteImage: handleDeleteAssetImage,
      onSetPrimaryImage: handleSetPrimaryAssetImage,
    },
  };
}
