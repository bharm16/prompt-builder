import React from 'react';
import { PanelLeft, Plus, Settings2, Command, Share2, Download } from 'lucide-react';
import { usePromptState } from '../context/PromptStateContext';
import { useShareLink } from '../hooks/useShareLink';
import { usePromptExport } from '../PromptCanvas/hooks/usePromptExport';
import { useToast } from '@components/Toast';
import { Button } from '@promptstudio/system/components/ui/button';
import { Input } from '@promptstudio/system/components/ui/input';
import { useDebugLogger } from '@hooks/useDebugLogger';
import { cn } from '@/utils/cn';

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
    <header className="sticky top-0 z-40 px-6 pt-6" role="banner">
      <div className="flex h-14 items-center gap-4 rounded-2xl border border-border bg-surface-1/80 px-4 py-3 shadow-sm backdrop-blur">
        <div className="flex min-w-0 flex-1 items-center gap-5">
          <Button
            type="button"
            className="h-10 w-10 rounded-lg border border-border bg-transparent text-muted transition-colors hover:bg-surface-3 hover:text-foreground"
            aria-label={showHistory ? 'Hide history' : 'Show history'}
            aria-pressed={showHistory}
            onClick={() => setShowHistory(!showHistory)}
            variant="ghost"
            size="icon"
          >
            <PanelLeft size={16} />
          </Button>

          <div className="hidden flex-col gap-0.5 px-1.5 lg:flex">
            <div className="text-body font-bold uppercase tracking-widest text-foreground">VIDRA</div>
            <div className="text-label-12 text-faint">Prompt Studio</div>
          </div>

          <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 shadow-inset">
            <span className="h-2 w-2 rounded-full bg-accent ring-2 ring-accent/10" aria-hidden="true" />
            <Input
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
              className="flex-1 border-none bg-transparent p-0 text-body font-medium text-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
              aria-label="Prompt title"
            />
          </div>
        </div>

        <div className="hidden xl:flex" aria-label="Workflow steps">
          <div className="inline-flex h-10 items-center rounded-lg border border-border bg-surface-2 shadow-inset">
            {steps.map((step) => {
              const isActive = step.id === activeStep;
              return (
                <div
                  key={step.id}
                  aria-current={isActive ? 'step' : undefined}
                >
                  <span
                    className={cn(
                      'flex h-10 items-center rounded-lg border border-transparent px-3.5 text-body-sm text-muted transition-all duration-150',
                      isActive && 'border-border-strong bg-surface-3 text-foreground -translate-y-px'
                    )}
                    aria-selected={isActive}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {saveLabel ? (
            <div
              className={cn(
                'inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 text-label-12 text-muted',
                outputSaveState === 'saving' && 'text-foreground',
                outputSaveState === 'error' && 'border-error/40 text-error'
              )}
              data-state={outputSaveState}
            >
              <span
                className={cn(
                  'h-2 w-2 rounded-full',
                  outputSaveState === 'saving' && 'bg-accent ring-2 ring-accent/10',
                  outputSaveState === 'error' && 'bg-error ring-2 ring-error/10',
                  outputSaveState === 'saved' && 'bg-success ring-2 ring-success/10'
                )}
                aria-hidden="true"
              />
              {saveLabel}
            </div>
          ) : (
            <div className="h-10 w-28 opacity-0 pointer-events-none" aria-hidden="true" />
          )}

          <Button
            type="button"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-transparent px-3 text-body-sm font-semibold text-muted transition-colors hover:bg-surface-3 hover:text-foreground"
            aria-label={showShortcuts ? 'Close command palette' : 'Open command palette'}
            aria-pressed={showShortcuts}
            onClick={() => setShowShortcuts(!showShortcuts)}
            variant="ghost"
          >
            <Command size={14} />
            <span className="rounded-md border border-border bg-surface-2 px-1.5 py-0.5 text-label-sm font-mono text-muted">
              ⌘K
            </span>
          </Button>

          <Button
            type="button"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-gradient-to-r from-accent to-accent-2 px-3 text-body-sm font-semibold text-app shadow-md transition-colors hover:from-accent/90 hover:to-accent-2/90"
            onClick={handleCreateNew}
            aria-label="Create new prompt"
            variant="ghost"
          >
            <Plus size={16} />
            New
          </Button>

          <Button
            type="button"
            className="h-10 w-10 rounded-lg border border-border bg-transparent text-muted transition-colors hover:bg-surface-3 hover:text-foreground"
            aria-label={shared ? 'Share link copied' : 'Share prompt'}
            onClick={() => {
              if (currentPromptUuid) {
                share(currentPromptUuid);
              } else {
                toast.error('Save the prompt first to generate a share link');
              }
            }}
            variant="ghost"
            size="icon"
          >
            <Share2 size={16} />
          </Button>

          <div className="relative" ref={exportMenuRef}>
            <Button
              type="button"
              className="h-10 w-10 rounded-lg border border-border bg-transparent text-muted transition-colors hover:bg-surface-3 hover:text-foreground"
              aria-label="Export prompt"
              aria-expanded={showExportMenu}
              onClick={() => setShowExportMenu(!showExportMenu)}
              variant="ghost"
              size="icon"
            >
              <Download size={16} />
            </Button>
            {showExportMenu && (
              <div
                className="absolute right-0 top-full z-10 mt-2.5 min-w-40 rounded-lg border border-border bg-surface-2 p-2 shadow-md"
                role="menu"
              >
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleExport('text')}
                  role="menuitem"
                  className="h-9 w-full justify-start rounded-lg px-2.5 text-body-sm text-muted transition-colors hover:bg-surface-3 hover:text-foreground"
                >
                  Export .txt
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleExport('markdown')}
                  role="menuitem"
                  className="h-9 w-full justify-start rounded-lg px-2.5 text-body-sm text-muted transition-colors hover:bg-surface-3 hover:text-foreground"
                >
                  Export .md
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleExport('json')}
                  role="menuitem"
                  className="h-9 w-full justify-start rounded-lg px-2.5 text-body-sm text-muted transition-colors hover:bg-surface-3 hover:text-foreground"
                >
                  Export .json
                </Button>
              </div>
            )}
          </div>

          <Button
            type="button"
            className="h-10 w-10 rounded-lg border border-border bg-transparent text-muted transition-colors hover:bg-surface-3 hover:text-foreground"
            aria-label={showSettings ? 'Close settings' : 'Open settings'}
            aria-pressed={showSettings}
            onClick={() => setShowSettings(!showSettings)}
            variant="ghost"
            size="icon"
          >
            <Settings2 size={16} />
          </Button>
        </div>
      </div>
    </header>
  );
};
