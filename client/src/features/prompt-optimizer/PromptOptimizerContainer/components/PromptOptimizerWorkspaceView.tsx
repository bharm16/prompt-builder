import React, { useCallback } from 'react';
import type { Asset, AssetType } from '@shared/types/asset';
import type { AppShellProps } from '@components/navigation/AppShell/types';
import { AppShell } from '@components/navigation/AppShell';
import { useToast } from '@components/Toast';
import DebugButton from '@components/DebugButton';
import AssetEditor from '@features/assets/components/AssetEditor';
import type { PromptModalsProps } from '../../types';
import type { PromptResultsLayoutProps } from '../../layouts/PromptResultsLayout';
import { PromptModals } from '../../components/PromptModals';
import { QuickCharacterCreate } from '../../components/QuickCharacterCreate';
import { DetectedAssets } from '../../components/DetectedAssets';
import { PromptResultsLayout } from '../../layouts/PromptResultsLayout';
import { SequenceWorkspace } from '../../components/SequenceWorkspace';
import { useWorkspaceSession } from '../../context/WorkspaceSessionContext';

interface QuickCreateState {
  isOpen: boolean;
  prefillTrigger?: string;
}

interface AssetEditorState {
  mode: 'create' | 'edit';
  asset?: Asset | null;
  preselectedType?: AssetType | null;
}

interface AssetEditorHandlers {
  onClose: () => void;
  onCreate: (data: {
    type: AssetType;
    trigger: string;
    name: string;
    textDefinition?: string;
    negativePrompt?: string;
  }) => Promise<Asset>;
  onUpdate: (
    assetId: string,
    data: { trigger?: string; name?: string; textDefinition?: string; negativePrompt?: string }
  ) => Promise<Asset>;
  onAddImage: (assetId: string, file: File, metadata: Record<string, string | undefined>) => Promise<void>;
  onDeleteImage: (assetId: string, imageId: string) => Promise<void>;
  onSetPrimaryImage: (assetId: string, imageId: string) => Promise<void>;
}

interface DebugProps {
  enabled: boolean;
  inputPrompt: string;
  displayedPrompt: string;
  optimizedPrompt: string;
  selectedMode: string;
  promptContext: Record<string, unknown> | null;
}

interface PromptOptimizerWorkspaceViewProps {
  toolSidebarProps: AppShellProps['toolSidebarProps'];
  showHistory: boolean;
  onToggleHistory: (show: boolean) => void;
  shouldShowLoading: boolean;
  promptModalsProps: PromptModalsProps;
  quickCreateState: QuickCreateState;
  onQuickCreateClose: () => void;
  onQuickCreateComplete: (asset: Asset) => void;
  assetEditorState: AssetEditorState | null;
  assetEditorHandlers: AssetEditorHandlers;
  detectedAssetsPrompt: string;
  detectedAssets: Asset[];
  onEditAsset: (assetId: string) => void;
  onCreateFromTrigger?: (trigger: string) => void;
  promptResultsLayoutProps: PromptResultsLayoutProps;
  debugProps: DebugProps;
}

export function PromptOptimizerWorkspaceView({
  toolSidebarProps,
  showHistory,
  onToggleHistory,
  shouldShowLoading,
  promptModalsProps,
  quickCreateState,
  onQuickCreateClose,
  onQuickCreateComplete,
  assetEditorState,
  assetEditorHandlers,
  detectedAssetsPrompt,
  detectedAssets,
  onEditAsset,
  onCreateFromTrigger,
  promptResultsLayoutProps,
  debugProps,
}: PromptOptimizerWorkspaceViewProps): React.ReactElement {
  const toast = useToast();
  const { shots, isSequenceMode, setCurrentShotId, addShot } = useWorkspaceSession();
  const promptText = toolSidebarProps?.prompt ?? '';
  const isOptimizing = Boolean(toolSidebarProps?.isProcessing || toolSidebarProps?.isRefining);

  const handleAiEnhance = useCallback(() => {
    if (typeof toolSidebarProps?.onOptimize !== 'function') return;
    void toolSidebarProps.onOptimize(promptText);
  }, [promptText, toolSidebarProps]);

  const handleAddShot = useCallback(async () => {
    try {
      const shot = await addShot({ prompt: ' ' });
      setCurrentShotId(shot.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add shot');
    }
  }, [addShot, setCurrentShotId, toast]);

  return (
    <AppShell
      showHistory={showHistory}
      onToggleHistory={onToggleHistory}
      {...(toolSidebarProps ? { toolSidebarProps } : {})}
    >
      <div className="flex h-full min-h-0 flex-col overflow-hidden font-sans text-foreground">
        {/* Skip to main content */}
        <a href="#main-content" className="ps-skip-link">
          Skip to main content
        </a>

        {/* Modals */}
        <PromptModals {...promptModalsProps} />
        <QuickCharacterCreate
          isOpen={quickCreateState.isOpen}
          prefillTrigger={quickCreateState.prefillTrigger}
          onClose={onQuickCreateClose}
          onCreate={onQuickCreateComplete}
        />
        {assetEditorState && (
          <AssetEditor
            mode={assetEditorState.mode}
            asset={assetEditorState.asset || undefined}
            preselectedType={assetEditorState.preselectedType || undefined}
            onClose={assetEditorHandlers.onClose}
            onCreate={assetEditorHandlers.onCreate}
            onUpdate={assetEditorHandlers.onUpdate}
            onAddImage={assetEditorHandlers.onAddImage}
            onDeleteImage={assetEditorHandlers.onDeleteImage}
            onSetPrimaryImage={assetEditorHandlers.onSetPrimaryImage}
          />
        )}

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <DetectedAssets
            prompt={detectedAssetsPrompt}
            assets={detectedAssets}
            onEditAsset={onEditAsset}
            {...(onCreateFromTrigger ? { onCreateFromTrigger } : {})}
          />

          {shouldShowLoading ? (
            <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto" id="main-content">
              <div className="flex flex-1 items-center justify-center px-6 py-9 sm:px-8 sm:py-10">
                <div className="flex flex-col items-center gap-4">
                  <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-border-strong" />
                  <p className="text-body-sm text-muted">Loading prompt...</p>
                </div>
              </div>
            </main>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {isSequenceMode && shots.length > 0 ? (
                <SequenceWorkspace
                  promptText={promptText}
                  isOptimizing={isOptimizing}
                  onAiEnhance={handleAiEnhance}
                  onAddShot={handleAddShot}
                  {...(toolSidebarProps?.onPromptChange
                    ? { onPromptChange: toolSidebarProps.onPromptChange }
                    : {})}
                />
              ) : (
                <PromptResultsLayout {...promptResultsLayoutProps} />
              )}
            </div>
          )}
        </div>

        {/* Debug Button - Hidden */}
        {debugProps.enabled && (
          <DebugButton
            inputPrompt={debugProps.inputPrompt}
            displayedPrompt={debugProps.displayedPrompt}
            optimizedPrompt={debugProps.optimizedPrompt}
            selectedMode={debugProps.selectedMode}
            promptContext={debugProps.promptContext}
          />
        )}
      </div>
    </AppShell>
  );
}
