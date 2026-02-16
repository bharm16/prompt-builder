import React from 'react';
import {
  ArrowClockwise,
  ArrowCounterClockwise,
  Check,
  Copy,
  DotsThree,
  GridFour,
  Icon,
  Lock,
  LockOpen,
  VideoCamera,
  X,
} from '@promptstudio/system/components/ui';
import { Button, type ButtonProps } from '@promptstudio/system/components/ui/button';
import { Dialog, DialogContent } from '@promptstudio/system/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@promptstudio/system/components/ui/select';
import { Sheet, SheetContent } from '@promptstudio/system/components/ui/sheet';
import { Textarea } from '@promptstudio/system/components/ui/textarea';
import { CollapsibleDrawer, type DrawerDisplayMode } from '@components/CollapsibleDrawer';
import { LoadingDots } from '@components/LoadingDots';
import { MAX_REQUEST_LENGTH } from '@components/SuggestionsPanel/config/panelConfig';
import { FEATURES } from '@/config/features.config';
import { cn } from '@/utils/cn';
import { TriggerAutocomplete } from '@features/assets/components/TriggerAutocomplete';
import type { AssetSuggestion } from '@features/assets/hooks/useTriggerAutocomplete';
import type { PromptVersionEntry } from '@hooks/types';
import type { PromptContext } from '@utils/PromptContext/PromptContext';
import type { InlineSuggestion, SuggestionItem } from '../types';
import type { ExportFormat } from '../../types';
import type { Generation, GenerationsPanelProps } from '../../GenerationsPanel/types';
import type { Span } from '../../SpanBentoGrid/components/types';
import type { CoherenceIssue } from '../../components/coherence/useCoherenceAnnotations';
import type { CoherenceRecommendation } from '../../types/coherence';
import type { I2VContext } from '../../types/i2v';
import { CategoryLegend } from '../../components/CategoryLegend';
import { ConstraintModeSelector } from '../../components/ConstraintModeSelector';
import { LockedSpanIndicator } from '../../components/LockedSpanIndicator';
import { PromptEditor } from '../../components/PromptEditor';
import { VersionsPanel } from '../../components/VersionsPanel';
import { GenerationsPanel } from '../../GenerationsPanel';
import { SpanBentoGrid } from '../../SpanBentoGrid/SpanBentoGrid';
import { HighlightingErrorBoundary } from '../../../span-highlighting/components/HighlightingErrorBoundary';
import { CoherencePanel } from '../../components/coherence/CoherencePanel';
import { CanvasWorkspace } from '../../CanvasWorkspace/CanvasWorkspace';

const CanvasButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant, ...props }, ref) => (
    <Button ref={ref} variant={variant ?? 'canvas'} {...props} />
  )
);

CanvasButton.displayName = 'CanvasButton';

const iconSizes = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
} as const;

interface VersionsDrawerState {
  isOpen: boolean;
  toggle: () => void;
  open: () => void;
  close: () => void;
  displayMode: DrawerDisplayMode;
}

interface VersionsPanelPropsBase {
  versions: PromptVersionEntry[];
  selectedVersionId: string;
  onSelectVersion: (versionId: string) => void;
  onCreateVersion: () => void;
}

export interface PromptCanvasViewProps {
  selectedMode: string;
  outlineOverlayActive: boolean;
  outlineOverlayState: 'closed' | 'opening' | 'open' | 'closing';
  outlineOverlayRef: React.RefObject<HTMLDivElement>;
  bentoSpans: Span[];
  editorRef: React.RefObject<HTMLDivElement>;
  onBentoSpanHoverChange: (spanId: string | null) => void;
  showLegend: boolean;
  onCloseLegend: () => void;
  promptContext: PromptContext | null;
  isSuggestionsOpen: boolean;
  hasCanvasContent: boolean;
  editorColumnRef: React.RefObject<HTMLDivElement>;
  editorWrapperRef: React.RefObject<HTMLDivElement>;
  outputLocklineRef: React.RefObject<HTMLDivElement>;
  lockButtonRef: React.RefObject<HTMLButtonElement>;
  onTextSelection: (e: React.MouseEvent<HTMLDivElement>) => void;
  onHighlightClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  onHighlightMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  onHighlightMouseEnter: (e: React.MouseEvent<HTMLDivElement>) => void;
  onHighlightMouseLeave: (e: React.MouseEvent<HTMLDivElement>) => void;
  onCopyEvent: (e: React.ClipboardEvent<HTMLDivElement>) => void;
  onInput: (e: React.FormEvent<HTMLDivElement>) => void;
  onEditorKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onEditorBlur: (event: React.FocusEvent<HTMLDivElement>) => void;
  autocompleteOpen: boolean;
  autocompleteSuggestions: AssetSuggestion[];
  autocompleteSelectedIndex: number;
  autocompletePosition: { top: number; left: number };
  autocompleteLoading: boolean;
  onAutocompleteSelect: (asset: AssetSuggestion) => void;
  onAutocompleteClose: () => void;
  onAutocompleteIndexChange: (index: number) => void;
  enableMLHighlighting: boolean;
  hoveredSpanId: string | null;
  lockButtonPosition: { top: number; left: number } | null;
  isHoveredLocked: boolean;
  onToggleLock: () => void;
  onCancelHideLockButton: () => void;
  onLockButtonMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => void;
  isOutputLoading: boolean;
  selectedSpanId: string | null;
  suggestionCount: number;
  suggestionsListRef: React.RefObject<HTMLDivElement>;
  inlineSuggestions: InlineSuggestion[];
  activeSuggestionIndex: number;
  onActiveSuggestionChange: (index: number) => void;
  interactionSourceRef: React.MutableRefObject<'keyboard' | 'mouse' | 'auto'>;
  onSuggestionClick: (suggestion: SuggestionItem | string) => void;
  onCloseInlinePopover: () => void;
  selectionLabel: string;
  onApplyActiveSuggestion: () => void;
  customRequest: string;
  onCustomRequestChange: (value: string) => void;
  customRequestError: string;
  onCustomRequestErrorChange: (value: string) => void;
  onCustomRequestSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  isCustomRequestDisabled: boolean;
  isCustomLoading: boolean;
  isInlineLoading: boolean;
  isInlineError: boolean;
  inlineErrorMessage: string;
  isInlineEmpty: boolean;
  showI2VLockIndicator: boolean;
  resolvedI2VReason: string | null;
  i2vMotionAlternatives: SuggestionItem[];
  onLockedAlternativeClick: (suggestion: SuggestionItem) => void;
  i2vContext?: I2VContext | null | undefined;
  coherenceIssues?: CoherenceIssue[] | undefined;
  isCoherenceChecking?: boolean | undefined;
  isCoherencePanelExpanded?: boolean | undefined;
  onToggleCoherencePanelExpanded?: (() => void) | undefined;
  onDismissCoherenceIssue?: ((issueId: string) => void) | undefined;
  onDismissAllCoherenceIssues?: (() => void) | undefined;
  onApplyCoherenceFix?: ((
    issueId: string,
    recommendation: CoherenceRecommendation
  ) => void) | undefined;
  onScrollToCoherenceSpan?: ((spanId: string) => void) | undefined;
  versionsDrawer: VersionsDrawerState;
  versionsPanelProps: VersionsPanelPropsBase;
  generationsPanelProps: GenerationsPanelProps;
  onReuseGeneration: (generation: Generation) => void;
  onToggleGenerationFavorite: (generationId: string, isFavorite: boolean) => void;
  generationsSheetOpen: boolean;
  onGenerationsSheetOpenChange: (open: boolean) => void;
  showDiff: boolean;
  onShowDiffChange: (open: boolean) => void;
  inputPrompt: string;
  normalizedDisplayedPrompt: string | null;
  openOutlineOverlay: () => void;
  copied: boolean;
  onCopy: () => void;
  modelFormatValue: string;
  modelFormatLabel: string;
  modelFormatOptions: Array<{ id: string; label: string }>;
  modelFormatDisabled: boolean;
  onModelFormatChange: (nextModel: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  exportMenuRef: React.RefObject<HTMLDivElement>;
  showExportMenu: boolean;
  onToggleExportMenu: (open: boolean) => void;
  onExport: (format: ExportFormat) => void;
  onShare: () => void;
}

export function PromptCanvasView({
  selectedMode,
  outlineOverlayActive,
  outlineOverlayState,
  outlineOverlayRef,
  bentoSpans,
  editorRef,
  onBentoSpanHoverChange,
  showLegend,
  onCloseLegend,
  promptContext,
  isSuggestionsOpen,
  hasCanvasContent,
  editorColumnRef,
  editorWrapperRef,
  outputLocklineRef,
  lockButtonRef,
  onTextSelection,
  onHighlightClick,
  onHighlightMouseDown,
  onHighlightMouseEnter,
  onHighlightMouseLeave,
  onCopyEvent,
  onInput,
  onEditorKeyDown,
  onEditorBlur,
  autocompleteOpen,
  autocompleteSuggestions,
  autocompleteSelectedIndex,
  autocompletePosition,
  autocompleteLoading,
  onAutocompleteSelect,
  onAutocompleteClose,
  onAutocompleteIndexChange,
  enableMLHighlighting,
  hoveredSpanId,
  lockButtonPosition,
  isHoveredLocked,
  onToggleLock,
  onCancelHideLockButton,
  onLockButtonMouseLeave,
  isOutputLoading,
  selectedSpanId,
  suggestionCount,
  suggestionsListRef,
  inlineSuggestions,
  activeSuggestionIndex,
  onActiveSuggestionChange,
  interactionSourceRef,
  onSuggestionClick,
  onCloseInlinePopover,
  selectionLabel,
  onApplyActiveSuggestion,
  customRequest,
  onCustomRequestChange,
  customRequestError,
  onCustomRequestErrorChange,
  onCustomRequestSubmit,
  isCustomRequestDisabled,
  isCustomLoading,
  isInlineLoading,
  isInlineError,
  inlineErrorMessage,
  isInlineEmpty,
  showI2VLockIndicator,
  resolvedI2VReason,
  i2vMotionAlternatives,
  onLockedAlternativeClick,
  i2vContext,
  coherenceIssues,
  isCoherenceChecking,
  isCoherencePanelExpanded,
  onToggleCoherencePanelExpanded,
  onDismissCoherenceIssue,
  onDismissAllCoherenceIssues,
  onApplyCoherenceFix,
  onScrollToCoherenceSpan,
  versionsDrawer,
  versionsPanelProps,
  generationsPanelProps,
  onReuseGeneration,
  onToggleGenerationFavorite,
  generationsSheetOpen,
  onGenerationsSheetOpenChange,
  showDiff,
  onShowDiffChange,
  inputPrompt,
  normalizedDisplayedPrompt,
  openOutlineOverlay,
  copied,
  onCopy,
  modelFormatValue,
  modelFormatLabel,
  modelFormatOptions,
  modelFormatDisabled,
  onModelFormatChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  exportMenuRef,
  showExportMenu,
  onToggleExportMenu,
  onExport,
  onShare,
}: PromptCanvasViewProps): React.ReactElement {
  if (FEATURES.CANVAS_FIRST_LAYOUT) {
    return (
      <CanvasWorkspace
        generationsPanelProps={generationsPanelProps}
        onReuseGeneration={onReuseGeneration}
        onToggleGenerationFavorite={onToggleGenerationFavorite}
        copied={copied}
        canUndo={canUndo}
        canRedo={canRedo}
        onCopy={onCopy}
        onShare={onShare}
        onUndo={onUndo}
        onRedo={onRedo}
        editorRef={editorRef as React.RefObject<HTMLDivElement>}
        onTextSelection={onTextSelection}
        onHighlightClick={onHighlightClick}
        onHighlightMouseDown={onHighlightMouseDown}
        onHighlightMouseEnter={onHighlightMouseEnter}
        onHighlightMouseLeave={onHighlightMouseLeave}
        onCopyEvent={onCopyEvent}
        onInput={onInput}
        onEditorKeyDown={onEditorKeyDown}
        onEditorBlur={onEditorBlur}
        autocompleteOpen={autocompleteOpen}
        autocompleteSuggestions={autocompleteSuggestions}
        autocompleteSelectedIndex={autocompleteSelectedIndex}
        autocompletePosition={autocompletePosition}
        autocompleteLoading={autocompleteLoading}
        onAutocompleteSelect={onAutocompleteSelect}
        onAutocompleteClose={onAutocompleteClose}
        onAutocompleteIndexChange={onAutocompleteIndexChange}
        selectedSpanId={selectedSpanId}
        suggestionCount={suggestionCount}
        suggestionsListRef={suggestionsListRef}
        inlineSuggestions={inlineSuggestions}
        activeSuggestionIndex={activeSuggestionIndex}
        onActiveSuggestionChange={onActiveSuggestionChange}
        interactionSourceRef={interactionSourceRef}
        onSuggestionClick={onSuggestionClick}
        onCloseInlinePopover={onCloseInlinePopover}
        selectionLabel={selectionLabel}
        onApplyActiveSuggestion={onApplyActiveSuggestion}
        isInlineLoading={isInlineLoading}
        isInlineError={isInlineError}
        inlineErrorMessage={inlineErrorMessage}
        isInlineEmpty={isInlineEmpty}
        customRequest={customRequest}
        onCustomRequestChange={onCustomRequestChange}
        customRequestError={customRequestError}
        onCustomRequestErrorChange={onCustomRequestErrorChange}
        onCustomRequestSubmit={onCustomRequestSubmit}
        isCustomRequestDisabled={isCustomRequestDisabled}
        isCustomLoading={isCustomLoading}
        showI2VLockIndicator={showI2VLockIndicator}
        resolvedI2VReason={resolvedI2VReason}
        i2vMotionAlternatives={i2vMotionAlternatives}
        onLockedAlternativeClick={onLockedAlternativeClick}
      />
    );
  }

  return (
    <div
      className={cn('relative flex min-h-0 flex-1 flex-col pb-20 lg:pb-0')}
      data-mode={selectedMode}
      data-outline-open={outlineOverlayActive ? 'true' : 'false'}
    >
      {/* Category Legend */}
      <CategoryLegend
        show={showLegend}
        onClose={onCloseLegend}
        hasContext={promptContext?.hasContext() ?? false}
        isSuggestionsOpen={isSuggestionsOpen}
      />

      {outlineOverlayActive && (
        <div
          ref={outlineOverlayRef}
          className={cn(
            'z-modal border-border bg-surface-1 absolute bottom-6 left-6 top-6 flex w-96 flex-col overflow-hidden rounded-xl border shadow-lg',
            'ps-animate-scale-in'
          )}
          data-state={outlineOverlayState}
          role="dialog"
          aria-label="Prompt structure"
        >
          <div className="border-border border-b p-4">
            <div className="text-body-lg text-foreground font-semibold">
              Prompt Structure
            </div>
            <div className="text-meta text-muted mt-1">
              Semantic breakdown used for generation
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <HighlightingErrorBoundary>
              <SpanBentoGrid
                spans={bentoSpans}
                editorRef={editorRef as React.RefObject<HTMLElement>}
                onSpanHoverChange={onBentoSpanHoverChange}
              />
            </HighlightingErrorBoundary>
          </div>
          <div className="border-border p-ps-3 text-meta text-muted border-t">
            Hover a token to locate it in the prompt
          </div>
        </div>
      )}

      {/* Main Content Container */}
      <div
        className={cn(
          'gap-ps-3 p-ps-3 relative flex min-h-0 flex-1 flex-col bg-[#111318]',
          outlineOverlayActive && 'pointer-events-none opacity-60'
        )}
      >
        {/* Empty State - shown when no prompt yet */}
        {!hasCanvasContent ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
            <div className="max-w-md space-y-4">
              <h2 className="text-heading-24 text-foreground font-semibold">
                Describe your shot
              </h2>
              <p className="text-body text-muted">
                Enter a rough prompt in the bar above and we'll optimize it for
                cinematic video generation.
              </p>
              <div className="pt-4">
                <p className="text-label-sm text-faint">
                  Tip: Press{' '}
                  <kbd className="px-1.5 py-0.5 rounded bg-surface-3 text-muted font-mono text-xs">
                    ⌘
                  </kbd>{' '}
                  +{' '}
                  <kbd className="px-1.5 py-0.5 rounded bg-surface-3 text-muted font-mono text-xs">
                    Enter
                  </kbd>{' '}
                  to optimize
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="gap-ps-4 lg:gap-ps-5 flex min-h-0 flex-1 flex-col lg:flex-row">
            <div className="gap-ps-3 flex min-h-0 min-w-0 flex-1 flex-col self-stretch lg:min-w-80 lg:flex-[9]">
              {/* Main Editor Area - Optimized Prompt */}
              <div
                ref={editorColumnRef}
                className={cn('flex min-h-0 min-w-0 flex-1 flex-col')}
              >
                <div className="flex min-h-[200px] flex-auto flex-col overflow-y-auto lg:min-h-[300px]">
                  <div className="pb-ps-card flex h-full min-h-0 w-full flex-1 flex-col gap-0 overflow-hidden px-0">
                    <div
                      className={cn(
                        'flex min-h-0 flex-1 flex-col transition-opacity',
                        isOutputLoading && 'opacity-80'
                      )}
                    >
                      <div className="flex h-11 items-center border-b border-[#1A1C22] px-3">
                        {/* Left: Model format selector */}
                        <Select
                          value={modelFormatValue}
                          onValueChange={onModelFormatChange}
                          disabled={modelFormatDisabled}
                        >
                          <SelectTrigger
                            size="xs"
                            variant="ghost"
                            className="h-7 min-w-24 max-w-40 justify-start rounded-md px-2 text-[11px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-foreground [&>span]:!flex [&>span]:overflow-visible"
                            aria-label={`Model format: ${modelFormatLabel}`}
                            title={`Model format: ${modelFormatLabel}`}
                          >
                            <span className="flex min-w-0 items-center gap-1.5">
                              <Icon
                                icon={VideoCamera}
                                size="xs"
                                weight="bold"
                                aria-hidden="true"
                              />
                              <span className="truncate text-[11px]">
                                {modelFormatLabel}
                              </span>
                            </span>
                          </SelectTrigger>
                          <SelectContent align="start" className="max-h-72">
                            <SelectItem value="auto">
                              Auto (Generic)
                            </SelectItem>
                            {modelFormatOptions.map((option) => (
                              <SelectItem key={option.id} value={option.id}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {/* I2V mode badge — compact indicator when active */}
                        {i2vContext?.isI2VMode && (
                          <span className="ml-2 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-faint">
                            I2V{' '}
                            {i2vContext.constraintMode}
                          </span>
                        )}

                        <div className="flex-1" />

                        {/* Right group: Outline | divider | edit actions */}
                        {!outlineOverlayActive && (
                          <CanvasButton
                            type="button"
                            size="icon-sm"
                            className="h-7 w-7 shadow-none [&_svg]:size-[14px] focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                            onClick={openOutlineOverlay}
                            aria-label="Prompt structure"
                            title="Prompt structure"
                          >
                            <Icon
                              icon={GridFour}
                              size="sm"
                              weight="bold"
                              aria-hidden="true"
                            />
                          </CanvasButton>
                        )}

                        {/* Divider */}
                        <div
                          className="mx-1 h-3.5 w-px bg-[#22252C]"
                          aria-hidden="true"
                        />

                        <CanvasButton
                          type="button"
                          size="icon-sm"
                          className="h-7 w-7 shadow-none [&_svg]:size-[14px] focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                          onClick={onCopy}
                          aria-label={
                            copied
                              ? 'Copied to clipboard'
                              : 'Copy to clipboard'
                          }
                          title={copied ? 'Copied' : 'Copy'}
                        >
                          {copied ? (
                            <Icon
                              icon={Check}
                              size="sm"
                              weight="bold"
                              aria-hidden="true"
                            />
                          ) : (
                            <Icon
                              icon={Copy}
                              size="sm"
                              weight="bold"
                              aria-hidden="true"
                            />
                          )}
                        </CanvasButton>
                        <CanvasButton
                          type="button"
                          size="icon-sm"
                          className="h-7 w-7 shadow-none [&_svg]:size-[14px] focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                          onClick={onUndo}
                          disabled={!canUndo}
                          aria-label="Undo"
                        >
                          <Icon
                            icon={ArrowCounterClockwise}
                            size="sm"
                            weight="bold"
                            aria-hidden="true"
                          />
                        </CanvasButton>
                        <CanvasButton
                          type="button"
                          size="icon-sm"
                          className="h-7 w-7 shadow-none [&_svg]:size-[14px] focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                          onClick={onRedo}
                          disabled={!canRedo}
                          aria-label="Redo"
                        >
                          <Icon
                            icon={ArrowClockwise}
                            size="sm"
                            weight="bold"
                            aria-hidden="true"
                          />
                        </CanvasButton>
                        <div className="relative" ref={exportMenuRef}>
                          <CanvasButton
                            type="button"
                            size="icon-sm"
                            className="h-7 w-7 shadow-none [&_svg]:size-[14px] focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                            onClick={() =>
                              onToggleExportMenu(!showExportMenu)
                            }
                            aria-expanded={showExportMenu}
                            aria-haspopup="menu"
                            aria-label="More actions"
                            title="More"
                          >
                            <Icon
                              icon={DotsThree}
                              size="sm"
                              weight="bold"
                              aria-hidden="true"
                            />
                          </CanvasButton>
                          {showExportMenu && (
                            <div
                              className="absolute right-0 top-full z-20 mt-1.5 w-52 rounded-lg border border-[#22252C] bg-[#16181E] p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
                              role="menu"
                            >
                              {/* I2V constraint mode — only when active */}
                              {i2vContext?.isI2VMode && (
                                <>
                                  <div className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-faint">
                                    I2V Mode
                                  </div>
                                  {(
                                    [
                                      'strict',
                                      'flexible',
                                      'transform',
                                    ] as const
                                  ).map((mode) => (
                                    <CanvasButton
                                      key={mode}
                                      type="button"
                                      role="menuitem"
                                      className={cn(
                                        'w-full justify-start rounded-md px-2.5 py-1.5 text-[12px] transition-colors',
                                        i2vContext.constraintMode === mode
                                          ? 'font-semibold text-foreground'
                                          : 'font-normal text-muted hover:bg-surface-2 hover:text-foreground'
                                      )}
                                      onClick={() => {
                                        i2vContext.setConstraintMode(
                                          mode
                                        );
                                        onToggleExportMenu(false);
                                      }}
                                    >
                                      {mode.charAt(0).toUpperCase() +
                                        mode.slice(1)}
                                      {i2vContext.constraintMode ===
                                        mode && (
                                        <Icon
                                          icon={Check}
                                          size="sm"
                                          weight="bold"
                                          className="ml-auto"
                                          aria-hidden="true"
                                        />
                                      )}
                                    </CanvasButton>
                                  ))}
                                  <div
                                    className="my-1 h-px bg-[#22252C]"
                                    aria-hidden="true"
                                  />
                                </>
                              )}
                              <CanvasButton
                                type="button"
                                onClick={() => {
                                  onShowDiffChange(true);
                                  onToggleExportMenu(false);
                                }}
                                role="menuitem"
                                className="text-label-sm text-muted hover:bg-surface-2 hover:text-foreground w-full justify-start rounded-md px-2.5 py-1.5 transition-colors"
                              >
                                Compare versions
                              </CanvasButton>
                              <div
                                className="my-1 h-px bg-[#22252C]"
                                aria-hidden="true"
                              />
                              <CanvasButton
                                type="button"
                                onClick={() => {
                                  onExport('text');
                                  onToggleExportMenu(false);
                                }}
                                role="menuitem"
                                className="text-label-sm text-muted hover:bg-surface-2 hover:text-foreground w-full justify-start rounded-md px-2.5 py-1.5 transition-colors"
                              >
                                Export .txt
                              </CanvasButton>
                              <CanvasButton
                                type="button"
                                onClick={() => {
                                  onExport('markdown');
                                  onToggleExportMenu(false);
                                }}
                                role="menuitem"
                                className="text-label-sm text-muted hover:bg-surface-2 hover:text-foreground w-full justify-start rounded-md px-2.5 py-1.5 transition-colors"
                              >
                                Export .md
                              </CanvasButton>
                              <CanvasButton
                                type="button"
                                onClick={() => {
                                  onExport('json');
                                  onToggleExportMenu(false);
                                }}
                                role="menuitem"
                                className="text-label-sm text-muted hover:bg-surface-2 hover:text-foreground w-full justify-start rounded-md px-2.5 py-1.5 transition-colors"
                              >
                                Export .json
                              </CanvasButton>
                              <div
                                className="my-1 h-px bg-[#22252C]"
                                aria-hidden="true"
                              />
                              <CanvasButton
                                type="button"
                                onClick={() => {
                                  onShare();
                                  onToggleExportMenu(false);
                                }}
                                role="menuitem"
                                className="text-label-sm text-muted hover:bg-surface-2 hover:text-foreground w-full justify-start rounded-md px-2.5 py-1.5 transition-colors"
                              >
                                Share
                              </CanvasButton>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="px-ps-3 pb-ps-card pt-ps-4 flex min-h-0 flex-1 flex-col">
                        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
                          <div
                            className="relative flex min-h-0 w-full min-w-0 flex-1 flex-col"
                            aria-busy={isOutputLoading}
                            ref={editorWrapperRef}
                          >
                            <PromptEditor
                              ref={editorRef as React.RefObject<HTMLDivElement>}
                              className="px-ps-3 py-ps-4 text-body-xl text-foreground-warm min-h-0 min-h-44 w-full flex-1 overflow-y-auto whitespace-pre-wrap outline-none"
                              onTextSelection={onTextSelection}
                              onHighlightClick={onHighlightClick}
                              onHighlightMouseDown={onHighlightMouseDown}
                              onHighlightMouseEnter={onHighlightMouseEnter}
                              onHighlightMouseLeave={onHighlightMouseLeave}
                              onCopyEvent={onCopyEvent}
                              onInput={onInput}
                              onKeyDown={onEditorKeyDown}
                              onBlur={onEditorBlur}
                            />
                            {autocompleteOpen && (
                              <TriggerAutocomplete
                                isOpen={autocompleteOpen}
                                suggestions={autocompleteSuggestions}
                                selectedIndex={autocompleteSelectedIndex}
                                position={autocompletePosition}
                                isLoading={autocompleteLoading}
                                onSelect={(asset) => {
                                  onAutocompleteSelect(asset);
                                }}
                                onClose={onAutocompleteClose}
                                setSelectedIndex={onAutocompleteIndexChange}
                              />
                            )}
                            <div
                              ref={outputLocklineRef}
                              className={cn(
                                'bg-border mt-4 h-px w-full origin-left scale-x-0 transition-transform duration-300',
                                isOutputLoading && 'scale-x-100'
                              )}
                              aria-hidden="true"
                            />
                            {enableMLHighlighting &&
                              !outlineOverlayActive &&
                              hoveredSpanId &&
                              lockButtonPosition &&
                              !isOutputLoading && (
                                <CanvasButton
                                  ref={lockButtonRef}
                                  type="button"
                                  onClick={onToggleLock}
                                  onMouseEnter={onCancelHideLockButton}
                                  onMouseLeave={onLockButtonMouseLeave}
                                  onMouseDown={(e) => e.preventDefault()}
                                  className={cn(
                                    'border-border bg-surface-2 text-muted absolute z-10 -mt-1.5 inline-flex h-9 w-9 -translate-x-1/2 -translate-y-full items-center justify-center rounded-full border shadow-md transition-colors',
                                    'hover:border-border-strong hover:bg-surface-3 hover:text-foreground',
                                    isHoveredLocked &&
                                      'border-accent text-foreground'
                                  )}
                                  style={{
                                    top: `${lockButtonPosition.top}px`,
                                    left: `${lockButtonPosition.left}px`,
                                  }}
                                  data-locked={
                                    isHoveredLocked ? 'true' : 'false'
                                  }
                                  aria-label={
                                    isHoveredLocked
                                      ? 'Unlock span'
                                      : 'Lock span'
                                  }
                                  title={
                                    isHoveredLocked
                                      ? 'Unlock span'
                                      : 'Lock span'
                                  }
                                  aria-pressed={isHoveredLocked}
                                >
                                  {isHoveredLocked ? (
                                    <Icon
                                      icon={LockOpen}
                                      size="sm"
                                      weight="bold"
                                      aria-hidden="true"
                                    />
                                  ) : (
                                    <Icon
                                      icon={Lock}
                                      size="sm"
                                      weight="bold"
                                      aria-hidden="true"
                                    />
                                  )}
                                </CanvasButton>
                              )}
                            {isOutputLoading && (
                              <div
                                className="bg-surface-3/80 p-ps-4 absolute inset-0 flex items-start justify-start backdrop-blur-sm"
                                role="status"
                                aria-live="polite"
                                aria-label="Optimizing prompt"
                              >
                                <LoadingDots size={3} className="text-faint" />
                              </div>
                            )}
                          </div>

                        {selectedSpanId ? (
                          <aside
                            className="border-border bg-surface-2 absolute right-0 top-0 bottom-0 z-20 flex w-80 min-w-0 flex-col overflow-hidden rounded-lg border shadow-lg"
                            aria-label="Suggestions"
                          >
                            <div className="border-border flex items-center justify-between gap-3 border-b px-3 py-2">
                              <div className="text-body-sm text-foreground flex items-center gap-2 font-semibold">
                                Suggestions
                                <span className="bg-surface-3 text-label-sm text-muted inline-flex min-w-6 items-center justify-center rounded-full px-2 py-0.5">
                                  {suggestionCount}
                                </span>
                              </div>
                              <div
                                className="text-muted hidden items-center gap-1 sm:flex"
                                aria-hidden="true"
                              >
                                <span className="border-border bg-surface-3 text-label-sm text-muted rounded-md border px-2 py-0.5 font-semibold">
                                  Up
                                </span>
                                <span className="border-border bg-surface-3 text-label-sm text-muted rounded-md border px-2 py-0.5 font-semibold">
                                  Down
                                </span>
                                <span className="border-border bg-surface-3 text-label-sm text-muted rounded-md border px-2 py-0.5 font-semibold">
                                  Enter
                                </span>
                                <span className="border-border bg-surface-3 text-label-sm text-muted rounded-md border px-2 py-0.5 font-semibold">
                                  Esc
                                </span>
                              </div>
                            </div>

                            <div
                              className="border-border border-b px-3 py-2"
                              data-suggest-custom
                            >
                              <form
                                className="flex items-center gap-2"
                                onSubmit={onCustomRequestSubmit}
                              >
                                <Textarea
                                  id="inline-custom-request"
                                  value={customRequest}
                                  onChange={(event) => {
                                    onCustomRequestChange(event.target.value);
                                    if (customRequestError) {
                                      onCustomRequestErrorChange('');
                                    }
                                  }}
                                  placeholder="Add a specific change (e.g. football field)"
                                  className="border-border bg-surface-2 text-body-sm text-foreground placeholder:text-faint focus-visible:ring-accent min-h-9 flex-1 resize-none rounded-lg border px-3 py-2 focus-visible:ring-2 focus-visible:ring-offset-0"
                                  maxLength={MAX_REQUEST_LENGTH}
                                  rows={1}
                                  aria-label="Custom suggestion request"
                                />
                                <CanvasButton
                                  type="submit"
                                  className={cn(
                                    'border-accent bg-accent text-label-sm text-app h-9 rounded-lg border px-3 font-semibold shadow-sm transition hover:opacity-90',
                                    isCustomRequestDisabled && 'opacity-50'
                                  )}
                                  disabled={isCustomRequestDisabled}
                                  aria-busy={isCustomLoading}
                                >
                                  {isCustomLoading ? 'Applying...' : 'Apply'}
                                </CanvasButton>
                              </form>
                              {customRequestError && (
                                <div
                                  className="border-error/30 bg-error/10 text-label-sm text-error mt-2 rounded-lg border px-3 py-2"
                                  role="alert"
                                >
                                  {customRequestError}
                                </div>
                              )}
                            </div>

                            {isInlineError && (
                              <div
                                className="border-error/30 bg-error/10 text-label-sm text-error mx-3 mt-2 rounded-lg border px-3 py-2"
                                role="alert"
                              >
                                {inlineErrorMessage}
                              </div>
                            )}

                            {showI2VLockIndicator && (
                              <div className="px-3 pt-2">
                                <LockedSpanIndicator
                                  reason={resolvedI2VReason}
                                  motionAlternatives={i2vMotionAlternatives}
                                  onSelectAlternative={onLockedAlternativeClick}
                                />
                              </div>
                            )}

                            {isInlineLoading && (
                              <div className="flex flex-1 flex-col gap-2 px-3 py-2">
                                <div className="bg-surface-3 h-9 w-full animate-pulse rounded-lg" />
                                <div className="bg-surface-3 h-9 w-full animate-pulse rounded-lg" />
                                <div className="bg-surface-3 h-9 w-full animate-pulse rounded-lg" />
                              </div>
                            )}

                            {!isInlineLoading &&
                              !isInlineError &&
                              suggestionCount > 0 && (
                                <div
                                  className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 py-2"
                                  ref={suggestionsListRef}
                                >
                                  {inlineSuggestions.map(
                                    (suggestion, index) => (
                                      <div
                                        key={suggestion.key}
                                        data-index={index}
                                        data-selected={
                                          activeSuggestionIndex === index
                                            ? 'true'
                                            : 'false'
                                        }
                                        className={cn(
                                          'border-border bg-surface-2 text-body-sm text-foreground flex cursor-pointer items-start justify-between gap-3 rounded-lg border px-3 py-2 transition-colors',
                                          'hover:border-border-strong hover:bg-surface-3',
                                          activeSuggestionIndex === index &&
                                            'border-accent/50 bg-accent/10'
                                        )}
                                        onMouseDown={(e) => e.preventDefault()}
                                        onMouseEnter={() => {
                                          interactionSourceRef.current =
                                            'mouse';
                                          onActiveSuggestionChange(index);
                                        }}
                                        onClick={() => {
                                          onSuggestionClick(
                                            suggestion.item
                                          );
                                          onCloseInlinePopover();
                                        }}
                                        role="button"
                                        tabIndex={0}
                                      >
                                        <div className="text-body-sm text-foreground min-w-0">
                                          {suggestion.text}
                                        </div>
                                        {index === 0 ? (
                                          <span className="bg-accent/10 text-label-sm text-accent inline-flex flex-shrink-0 items-center rounded-full px-2 py-0.5 font-semibold">
                                            Best match
                                          </span>
                                        ) : suggestion.meta ? (
                                          <div className="text-label-sm text-muted flex-shrink-0">
                                            {suggestion.meta}
                                          </div>
                                        ) : null}
                                      </div>
                                    )
                                  )}
                                </div>
                              )}

                            {isInlineEmpty && (
                              <div className="text-label-sm text-muted flex flex-1 items-center px-3 py-2">
                                No suggestions yet.
                              </div>
                            )}

                            <div className="border-border border-t px-3 py-2">
                              <div className="text-label-sm text-muted">
                                {selectionLabel
                                  ? `Replace "${selectionLabel}"`
                                  : 'Replace selection'}
                              </div>
                              <div className="mt-3 flex items-center gap-2">
                                <CanvasButton
                                  type="button"
                                  className="border-border bg-surface-3 text-label-sm text-muted hover:bg-surface-2 hover:text-foreground h-9 rounded-lg border px-3 font-semibold transition-colors"
                                  onClick={onCloseInlinePopover}
                                >
                                  Clear
                                </CanvasButton>
                                <CanvasButton
                                  type="button"
                                  className={cn(
                                    'border-accent bg-accent text-label-sm text-app h-9 rounded-lg border px-3 font-semibold shadow-sm transition hover:opacity-90',
                                    !suggestionCount && 'opacity-50'
                                  )}
                                  onClick={() => {
                                    onApplyActiveSuggestion();
                                    onCloseInlinePopover();
                                  }}
                                  disabled={!suggestionCount}
                                >
                                  Apply
                                </CanvasButton>
                              </div>
                            </div>
                          </aside>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <CoherencePanel
              issues={coherenceIssues ?? []}
              isChecking={Boolean(isCoherenceChecking)}
              isExpanded={Boolean(isCoherencePanelExpanded)}
              onToggleExpanded={onToggleCoherencePanelExpanded ?? (() => {})}
              onDismissIssue={onDismissCoherenceIssue ?? (() => {})}
              onDismissAll={onDismissAllCoherenceIssues ?? (() => {})}
              onApplyFix={onApplyCoherenceFix ?? (() => {})}
              onScrollToSpan={onScrollToCoherenceSpan}
            />

            <CollapsibleDrawer
              isOpen={versionsDrawer.isOpen}
              onToggle={versionsDrawer.toggle}
              height="132px"
              collapsedHeight="36px"
              position="bottom"
              displayMode={versionsDrawer.displayMode}
              showToggle={false}
            >
              <VersionsPanel
                versions={versionsPanelProps.versions}
                selectedVersionId={versionsPanelProps.selectedVersionId}
                onSelectVersion={versionsPanelProps.onSelectVersion}
                onCreateVersion={versionsPanelProps.onCreateVersion}
                isCompact={!versionsDrawer.isOpen}
                onExpandDrawer={versionsDrawer.open}
                onCollapseDrawer={versionsDrawer.close}
                layout="horizontal"
              />
            </CollapsibleDrawer>
          </div>

          <div
            className="hidden w-px self-stretch bg-[#1A1C22] lg:block"
            aria-hidden="true"
          />

          {/* Right Rail - Generations */}
          <div className="lg:min-w-88 hidden min-h-0 flex-1 flex-col lg:flex lg:flex-[11]">
            <GenerationsPanel {...generationsPanelProps} />
          </div>
        </div>
      )}
      </div>

      {hasCanvasContent && (
        <div className="border-border bg-surface-2 p-ps-3 fixed bottom-0 left-0 right-0 z-40 border-t lg:hidden">
          <div className="flex items-center gap-3">
            <CanvasButton
              type="button"
              variant="gradient"
              className="flex-1 justify-center"
              onClick={() => onGenerationsSheetOpenChange(true)}
            >
              Open Generations
            </CanvasButton>
          </div>
        </div>
      )}

      {hasCanvasContent && (
        <Sheet open={generationsSheetOpen} onOpenChange={onGenerationsSheetOpenChange}>
          <SheetContent
            side="bottom"
            className="p-ps-3 h-[85vh] overflow-auto border-0 bg-transparent shadow-none [&>button]:hidden"
          >
            <GenerationsPanel
              {...generationsPanelProps}
              className="h-full"
            />
          </SheetContent>
        </Sheet>
      )}
      {hasCanvasContent && showDiff && (
        <Dialog open={showDiff} onOpenChange={onShowDiffChange}>
          <DialogContent className="border-border bg-surface-3 w-full max-w-5xl gap-0 rounded-xl border p-0 shadow-lg [&>button]:hidden">
            <div className="border-border flex items-center justify-between border-b p-4">
              <div>
                <div className="text-body-lg text-foreground font-semibold">
                  Diff
                </div>
                <div className="text-meta text-muted mt-1">
                  Input vs optimized output
                </div>
              </div>
              <CanvasButton
                type="button"
                className="border-border text-muted hover:bg-surface-2 hover:text-foreground inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors"
                onClick={() => onShowDiffChange(false)}
                aria-label="Close diff"
              >
                <X weight="bold" size={iconSizes.md} />
              </CanvasButton>
            </div>
            <div className="grid gap-4 p-4 md:grid-cols-2">
              <div className="border-border bg-surface-2 p-ps-3 rounded-lg border">
                <div className="text-label-sm text-muted font-semibold uppercase tracking-widest">
                  Input
                </div>
                <pre className="text-body-sm text-muted mt-3 whitespace-pre-wrap font-mono">
                  {inputPrompt || '—'}
                </pre>
              </div>
              <div className="border-border bg-surface-2 p-ps-3 rounded-lg border">
                <div className="text-label-sm text-muted font-semibold uppercase tracking-widest">
                  Optimized
                </div>
                <pre className="text-body-sm text-muted mt-3 whitespace-pre-wrap font-mono">
                  {normalizedDisplayedPrompt || '—'}
                </pre>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
