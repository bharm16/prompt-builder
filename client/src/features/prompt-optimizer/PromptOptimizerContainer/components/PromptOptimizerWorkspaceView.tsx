import React, { useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { PromptHistoryEntry } from '@hooks/types';
import type { Asset, AssetType } from '@shared/types/asset';
import type { AppShellProps } from '@components/navigation/AppShell/types';
import { AppShell } from '@components/navigation/AppShell';
import { useToast } from '@components/Toast';
import DebugButton from '@components/DebugButton';
import AssetEditor from '@features/assets/components/AssetEditor';
import { extractStorageObjectPath, extractVideoContentAssetId } from '@/utils/storageUrl';
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

const normalizeRef = (value: string | null | undefined): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const collectVideoRefs = (entry: PromptHistoryEntry): Set<string> => {
  const refs = new Set<string>();
  const versions = Array.isArray(entry.versions) ? entry.versions : [];

  for (const version of versions) {
    const video = version?.video;
    if (!video) continue;

    const assetId = normalizeRef(video.assetId ?? null);
    if (assetId) refs.add(assetId);

    const storagePath = normalizeRef(video.storagePath ?? null);
    if (storagePath) refs.add(storagePath);

    const videoUrl = normalizeRef(video.videoUrl ?? null);
    if (!videoUrl) continue;

    const assetIdFromUrl = normalizeRef(extractVideoContentAssetId(videoUrl));
    if (assetIdFromUrl) refs.add(assetIdFromUrl);

    const storagePathFromUrl = normalizeRef(extractStorageObjectPath(videoUrl));
    if (storagePathFromUrl) refs.add(storagePathFromUrl);
  }

  return refs;
};

const resolveSequenceOriginSessionId = (
  history: PromptHistoryEntry[],
  currentSessionId: string | null,
  sourceVideoRefs: string[]
): string | null => {
  if (!history.length || !sourceVideoRefs.length) return null;
  const sourceSet = new Set(sourceVideoRefs);

  for (const entry of history) {
    const entryId = normalizeRef(entry.id);
    if (!entryId || entryId === currentSessionId) continue;
    const entryRefs = collectVideoRefs(entry);
    if (entryRefs.size === 0) continue;
    for (const ref of sourceSet) {
      if (entryRefs.has(ref)) {
        return entryId;
      }
    }
  }

  return null;
};

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
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { session, shots, isSequenceMode, setCurrentShotId, addShot } = useWorkspaceSession();
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

  const sourceVideoRefs = useMemo(() => {
    const refs = new Set<string>();
    const firstShotVideoId = normalizeRef(shots[0]?.videoAssetId ?? null);
    if (firstShotVideoId) refs.add(firstShotVideoId);
    const primarySourceVideoId = normalizeRef(
      session?.continuity?.primaryStyleReference?.sourceVideoId ?? null
    );
    if (primarySourceVideoId) refs.add(primarySourceVideoId);
    return [...refs];
  }, [session?.continuity?.primaryStyleReference?.sourceVideoId, shots]);

  const sequenceOriginSessionId = useMemo(() => {
    const history = Array.isArray(toolSidebarProps?.history) ? toolSidebarProps.history : [];
    return resolveSequenceOriginSessionId(history, normalizeRef(session?.id ?? null), sourceVideoRefs);
  }, [session?.id, sourceVideoRefs, toolSidebarProps?.history]);

  const originSessionIdFromQuery = useMemo(() => {
    const value = normalizeRef(new URLSearchParams(location.search).get('originSessionId'));
    if (!value) return null;
    if (value === normalizeRef(session?.id ?? null)) return null;
    return value;
  }, [location.search, session?.id]);

  const originSessionIdFromSidebarState = useMemo(() => {
    const candidate = normalizeRef(toolSidebarProps?.currentPromptDocId ?? null);
    if (!candidate) return null;
    if (candidate === normalizeRef(session?.id ?? null)) return null;
    return candidate;
  }, [session?.id, toolSidebarProps?.currentPromptDocId]);

  const handleExitSequence = useCallback((): void => {
    if (originSessionIdFromQuery) {
      navigate(`/session/${encodeURIComponent(originSessionIdFromQuery)}`);
      return;
    }
    if (originSessionIdFromSidebarState) {
      navigate(`/session/${encodeURIComponent(originSessionIdFromSidebarState)}`);
      return;
    }
    if (sequenceOriginSessionId) {
      navigate(`/session/${encodeURIComponent(sequenceOriginSessionId)}`);
      return;
    }
    navigate('/');
  }, [navigate, originSessionIdFromQuery, originSessionIdFromSidebarState, sequenceOriginSessionId]);

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
                  onExitSequence={handleExitSequence}
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
