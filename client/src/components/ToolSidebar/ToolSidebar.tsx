import type { ReactElement } from 'react';
import { ToolRail } from './components/ToolRail';
import { ToolPanel } from './components/ToolPanel';
import { SessionsPanel } from './components/panels/SessionsPanel';
import { GenerationControlsPanel } from './components/panels/GenerationControlsPanel';
import { CharactersPanel } from './components/panels/CharactersPanel';
import { StylesPanel } from './components/panels/StylesPanel';
import { useToolSidebarState } from './hooks/useToolSidebarState';
import type { ToolSidebarProps } from './types';

/**
 * ToolSidebar - Main orchestrator for the Runway-style sidebar
 *
 * Layout: 60px rail + 400px panel (always visible side-by-side)
 */
export function ToolSidebar(props: ToolSidebarProps): ReactElement {
  const {
    user,
    history,
    filteredHistory,
    isLoadingHistory,
    searchQuery,
    onSearchChange,
    onLoadFromHistory,
    onCreateNew,
    onDelete,
    onDuplicate,
    onRename,
    currentPromptUuid,
    currentPromptDocId,
    activeStatusLabel,
    activeModelLabel,
    prompt,
    onPromptChange,
    aspectRatio,
    duration,
    selectedModel,
    onModelChange,
    onAspectRatioChange,
    onDurationChange,
    onDraft,
    onRender,
    isDraftDisabled,
    isRenderDisabled,
    startImage,
    onImageUpload,
    onClearStartImage,
    activeDraftModel,
    assets,
    assetsByType,
    isLoadingAssets,
    onInsertTrigger,
    onEditAsset,
    onCreateAsset,
  } = props;

  const { activePanel, setActivePanel } = useToolSidebarState('tool');

  const characterAssets = assetsByType.character ?? assets.filter((asset) => asset.type === 'character');

  return (
    <div className="flex h-full">
      <ToolRail
        activePanel={activePanel}
        onPanelChange={setActivePanel}
        user={user}
        onCreateNew={onCreateNew}
      />
      <ToolPanel activePanel={activePanel}>
        {activePanel === 'sessions' && (
          <SessionsPanel
            history={history}
            filteredHistory={filteredHistory}
            isLoading={isLoadingHistory}
            searchQuery={searchQuery}
            onSearchChange={onSearchChange}
            onLoadFromHistory={onLoadFromHistory}
            onCreateNew={onCreateNew}
            onDelete={onDelete}
            {...(typeof onDuplicate === 'function' ? { onDuplicate } : {})}
            {...(typeof onRename === 'function' ? { onRename } : {})}
            {...(currentPromptUuid !== undefined ? { currentPromptUuid } : {})}
            {...(currentPromptDocId !== undefined ? { currentPromptDocId } : {})}
            {...(typeof activeStatusLabel === 'string' ? { activeStatusLabel } : {})}
            {...(typeof activeModelLabel === 'string' ? { activeModelLabel } : {})}
          />
        )}

        {activePanel === 'tool' && (
          <GenerationControlsPanel
            prompt={prompt}
            {...(typeof onPromptChange === 'function' ? { onPromptChange } : {})}
            aspectRatio={aspectRatio}
            duration={duration}
            selectedModel={selectedModel}
            onModelChange={onModelChange}
            onAspectRatioChange={onAspectRatioChange}
            onDurationChange={onDurationChange}
            onDraft={onDraft}
            onRender={onRender}
            isDraftDisabled={isDraftDisabled}
            isRenderDisabled={isRenderDisabled}
            startImage={startImage ?? null}
            {...(typeof onImageUpload === 'function' ? { onImageUpload } : {})}
            {...(typeof onClearStartImage === 'function' ? { onClearStartImage } : {})}
            {...(activeDraftModel !== undefined ? { activeDraftModel } : {})}
            onBack={() => setActivePanel('sessions')}
          />
        )}

        {activePanel === 'characters' && (
          <CharactersPanel
            assets={assets}
            characterAssets={characterAssets}
            isLoading={isLoadingAssets}
            onInsertTrigger={onInsertTrigger}
            onEditAsset={onEditAsset}
            onCreateAsset={onCreateAsset}
          />
        )}

        {activePanel === 'styles' && <StylesPanel />}
      </ToolPanel>
    </div>
  );
}
