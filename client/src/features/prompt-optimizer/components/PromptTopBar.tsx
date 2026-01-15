import React from 'react';
import { PanelLeft, Plus, Settings2, Command, Share2, Download } from 'lucide-react';
import { usePromptState } from '../context/PromptStateContext';
import { useShareLink } from '../hooks/useShareLink';
import { usePromptExport } from '../PromptCanvas/hooks/usePromptExport';
import { useToast } from '@components/Toast';
import { useDebugLogger } from '@hooks/useDebugLogger';
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
    showResults,
    promptOptimizer,
    currentPromptUuid,
    outputSaveState,
    outputLastSavedAt,
  } = usePromptState();

  // Hide when brainstorm modal is open
  if (showBrainstorm) {
    return null;
  }

  const debug = useDebugLogger('PromptTopBar');
  const toast = useToast();
  const { shared, share } = useShareLink();
  const exportMenuRef = React.useRef<HTMLDivElement>(null);
  const [showExportMenu, setShowExportMenu] = React.useState(false);
  const [isTitleDirty, setIsTitleDirty] = React.useState(false);

  const titleSource = (promptOptimizer.inputPrompt || promptOptimizer.displayedPrompt || '').trim();
  const derivedTitle =
    titleSource.length > 0
      ? titleSource.split('\n')[0]!.slice(0, 64)
      : currentPromptUuid
        ? `Prompt ${currentPromptUuid.slice(0, 8)}`
        : 'Untitled prompt';

  const [titleValue, setTitleValue] = React.useState<string>(derivedTitle);

  React.useEffect(() => {
    if (!isTitleDirty) {
      setTitleValue(derivedTitle);
    }
  }, [derivedTitle, isTitleDirty]);

  React.useEffect(() => {
    setIsTitleDirty(false);
    setTitleValue(derivedTitle);
  }, [currentPromptUuid, derivedTitle]);

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

  const handleExport = usePromptExport({
    inputPrompt: promptOptimizer.inputPrompt,
    displayedPrompt: promptOptimizer.displayedPrompt ?? null,
    qualityScore: promptOptimizer.qualityScore ?? null,
    selectedMode: 'video',
    setShowExportMenu,
    toast,
    debug,
  });

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };
    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
    return undefined;
  }, [showExportMenu]);

  const isOptimizing = Boolean(promptOptimizer.isProcessing || promptOptimizer.isRefining);
  const activeStep = !showResults ? 'compose' : isOptimizing ? 'optimize' : 'preview';

  const steps = [
    { id: 'compose', label: 'Compose' },
    { id: 'optimize', label: 'Optimize' },
    { id: 'preview', label: 'Preview' },
    { id: 'render', label: 'Render' },
  ] as const;

  return (
    <header className="po-topbar" role="banner">
      <div className="po-topbar__inner topbar">
        <div className="po-topbar__left">
          <button
            type="button"
            className="po-topbar__iconbtn icon-btn"
            aria-label={showHistory ? 'Hide history' : 'Show history'}
            aria-pressed={showHistory}
            onClick={() => setShowHistory(!showHistory)}
          >
            <PanelLeft size={16} />
          </button>

          <div className="po-topbar__brand brand">
            <div className="po-topbar__product brand__name">VIDRA</div>
            <div className="po-topbar__subtitle brand__sub">Prompt Studio</div>
          </div>

          <div className="po-topbar__title-field command-field">
            <span className="po-topbar__title-accent" aria-hidden="true" />
            <input
              type="text"
              value={titleValue}
              onChange={(event) => {
                const next = event.target.value;
                setTitleValue(next);
                setIsTitleDirty(next.trim().length > 0 && next !== derivedTitle);
              }}
              onBlur={() => {
                if (!titleValue.trim()) {
                  setIsTitleDirty(false);
                  setTitleValue(derivedTitle);
                }
              }}
              className="po-topbar__title-input"
              aria-label="Prompt title"
            />
          </div>
        </div>

        <div className="po-topbar__center" aria-label="Workflow steps">
          <div className="po-topbar__stepper segmented">
            {steps.map((step) => {
              const isActive = step.id === activeStep;
              return (
                <div
                  key={step.id}
                  className="po-topbar__step"
                  data-active={isActive ? 'true' : 'false'}
                  aria-current={isActive ? 'step' : undefined}
                >
                  <span className="po-topbar__step-pill segmented__tab" aria-selected={isActive}>
                    {step.label}
                  </span>
                  <span className="po-topbar__step-underline" aria-hidden="true" />
                </div>
              );
            })}
          </div>
        </div>

        <div className="po-topbar__right">
          {saveLabel ? (
            <div className="po-topbar__status env-pill" data-state={outputSaveState}>
              <span className="env-pill__dot" aria-hidden="true" />
              {saveLabel}
            </div>
          ) : (
            <div className="po-topbar__status po-topbar__status--idle" aria-hidden="true" />
          )}

          <button
            type="button"
            className="po-topbar__command btn-ghost"
            aria-label={showShortcuts ? 'Close command palette' : 'Open command palette'}
            aria-pressed={showShortcuts}
            onClick={() => setShowShortcuts(!showShortcuts)}
          >
            <Command size={14} />
            <span className="kbd">⌘K</span>
          </button>

          <button
            type="button"
            className="po-topbar__btn po-topbar__btn--primary btn-primary"
            onClick={handleCreateNew}
            aria-label="Create new prompt"
          >
            <Plus size={16} />
            New
          </button>

          <button
            type="button"
            className="po-topbar__iconbtn icon-btn"
            aria-label={shared ? 'Share link copied' : 'Share prompt'}
            onClick={() => {
              if (currentPromptUuid) {
                share(currentPromptUuid);
              } else {
                toast.error('Save the prompt first to generate a share link');
              }
            }}
          >
            <Share2 size={16} />
          </button>

          <div className="po-topbar__menu" ref={exportMenuRef}>
            <button
              type="button"
              className="po-topbar__iconbtn icon-btn"
              aria-label="Export prompt"
              aria-expanded={showExportMenu}
              onClick={() => setShowExportMenu(!showExportMenu)}
            >
              <Download size={16} />
            </button>
            {showExportMenu && (
              <div
                className="po-topbar__menu-popover po-popover po-surface po-surface--grad po-animate-pop-in"
                role="menu"
              >
                <button type="button" onClick={() => handleExport('text')} role="menuitem">
                  Export .txt
                </button>
                <button type="button" onClick={() => handleExport('markdown')} role="menuitem">
                  Export .md
                </button>
                <button type="button" onClick={() => handleExport('json')} role="menuitem">
                  Export .json
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            className="po-topbar__iconbtn icon-btn"
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
