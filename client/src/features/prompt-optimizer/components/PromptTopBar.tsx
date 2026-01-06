import React from 'react';
import { PanelLeft, Plus, Settings2, Command } from 'lucide-react';
import { usePromptState } from '../context/PromptStateContext';
import './PromptTopBar.css';

/**
 * PromptTopBar - Top Action Buttons
 *
 * Handles the fixed top-left action buttons (New, History toggle)
 * Extracted from PromptOptimizerContainer for better separation of concerns
 */
export const PromptTopBar = (): React.ReactElement | null => {
  const {
    showHistory,
    setShowHistory,
    showBrainstorm,
    showSettings,
    setShowSettings,
    showShortcuts,
    setShowShortcuts,
    handleCreateNew,
    currentMode,
    selectedModel,
    promptOptimizer,
    currentPromptUuid,
    outputSaveState,
    outputLastSavedAt,
  } = usePromptState();

  // Hide when brainstorm modal is open
  if (showBrainstorm) {
    return null;
  }

  const titleSource = (promptOptimizer.inputPrompt || promptOptimizer.displayedPrompt || '').trim();
  const title =
    titleSource.length > 0
      ? titleSource.split('\n')[0]!.slice(0, 64)
      : currentPromptUuid
        ? `Prompt ${currentPromptUuid.slice(0, 8)}`
        : 'Untitled prompt';

  const timeLabel =
    typeof outputLastSavedAt === 'number'
      ? new Date(outputLastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : null;

  const saveLabel =
    outputSaveState === 'saving'
      ? 'Saving…'
      : outputSaveState === 'error'
        ? 'Save failed'
        : outputSaveState === 'saved'
          ? timeLabel
            ? `Saved · ${timeLabel}`
            : 'Saved'
          : '';

  return (
    <header className="po-topbar" role="banner">
      <div className="po-topbar__inner">
        <div className="po-topbar__left">
          <button
            type="button"
            className="po-topbar__iconbtn"
            aria-label={showHistory ? 'Hide history' : 'Show history'}
            aria-pressed={showHistory}
            onClick={() => setShowHistory(!showHistory)}
          >
            <PanelLeft size={16} />
          </button>

          <div className="po-topbar__title">
            <div className="po-topbar__product">Vidra</div>
            <div className="po-topbar__subtitle" title={title}>
              {title}
            </div>
          </div>
        </div>

        <div className="po-topbar__center" aria-label="Session configuration">
          <span className="po-topbar__chip">{currentMode?.name ?? 'Video'}</span>
          <span className="po-topbar__chip">{selectedModel?.trim() ? selectedModel.trim() : 'Auto model'}</span>
        </div>

        <div className="po-topbar__right">
          {saveLabel ? (
            <div className="po-topbar__status" data-state={outputSaveState}>
              {saveLabel}
            </div>
          ) : (
            <div className="po-topbar__status po-topbar__status--idle" aria-hidden="true" />
          )}

          <button
            type="button"
            className="po-topbar__btn"
            onClick={handleCreateNew}
            aria-label="Create new prompt"
          >
            <Plus size={16} />
            New
          </button>

          <button
            type="button"
            className="po-topbar__iconbtn"
            aria-label={showShortcuts ? 'Close shortcuts' : 'Open shortcuts'}
            aria-pressed={showShortcuts}
            onClick={() => setShowShortcuts(!showShortcuts)}
          >
            <Command size={16} />
          </button>

          <button
            type="button"
            className="po-topbar__iconbtn"
            aria-label={showSettings ? 'Close settings' : 'Open settings'}
            aria-pressed={showSettings}
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings2 size={16} />
          </button>
        </div>
      </div>
    </header>
  );
};

