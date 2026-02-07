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
 * 
 * Requirement 16.1-16.4: Tool panel integration with Create and Studio tools
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
    onOptimize,
    showResults,
    isProcessing,
    isRefining,
    genericOptimizedPrompt,
    promptInputRef,
    onCreateFromTrigger,
    onDraft,
    onRender,
    onImageUpload,
    onStoryboard,
    assets,
    assetsByType,
    isLoadingAssets,
    onInsertTrigger,
    onEditAsset,
    onCreateAsset,
  } = props;

  const { activePanel, setActivePanel } = useToolSidebarState('studio');

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
            onBack={() => setActivePanel('studio')}
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

        {activePanel === 'studio' && (
          <GenerationControlsPanel
            prompt={prompt}
            {...(typeof onPromptChange === 'function' ? { onPromptChange } : {})}
            {...(typeof onOptimize === 'function' ? { onOptimize } : {})}
            {...(typeof showResults === 'boolean' ? { showResults } : {})}
            {...(typeof isProcessing === 'boolean' ? { isProcessing } : {})}
            {...(typeof isRefining === 'boolean' ? { isRefining } : {})}
            genericOptimizedPrompt={genericOptimizedPrompt ?? null}
            {...(promptInputRef ? { promptInputRef } : {})}
            {...(typeof onCreateFromTrigger === 'function' ? { onCreateFromTrigger } : {})}
            onDraft={onDraft}
            onRender={onRender}
            {...(typeof onImageUpload === 'function' ? { onImageUpload } : {})}
            onStoryboard={onStoryboard}
            assets={assets}
            onInsertTrigger={onInsertTrigger}
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

        {activePanel === 'apps' && (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <div className="text-sm font-semibold text-[#8B92A5]">Apps</div>
            <div className="mt-2 text-xs text-[#555B6E]">Third-party integrations coming soon.</div>
          </div>
        )}

        {activePanel === 'styles' && <StylesPanel />}
      </ToolPanel>
    </div>
  );
}
