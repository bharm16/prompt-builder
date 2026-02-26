import React, { useEffect, useRef, useState } from 'react';
import { X } from '@promptstudio/system/components/ui';
import { Textarea } from '@promptstudio/system/components/ui/textarea';
import type { SidebarUploadedImage } from '@components/ToolSidebar/types';
import { MAX_REQUEST_LENGTH } from '@/components/SuggestionsPanel/config/panelConfig';
import { TriggerAutocomplete } from '@/features/assets/components/TriggerAutocomplete';
import type { AssetSuggestion } from '@/features/assets/hooks/useTriggerAutocomplete';
import { PromptEditor } from '@/features/prompt-optimizer/components/PromptEditor';
import { LockedSpanIndicator } from '@/features/prompt-optimizer/components/LockedSpanIndicator';
import type {
  InlineSuggestion,
  SuggestionItem,
} from '@/features/prompt-optimizer/PromptCanvas/types';
import { addPromptFocusIntentListener } from '@/features/prompt-optimizer/CanvasWorkspace/events';
import { cn } from '@/utils/cn';
import { CanvasSettingsRow } from './CanvasSettingsRow';

interface CanvasPromptBarProps {
  editorRef: React.RefObject<HTMLDivElement>;
  prompt: string;
  onTextSelection: (event: React.MouseEvent<HTMLDivElement>) => void;
  onHighlightClick: (event: React.MouseEvent<HTMLDivElement>) => void;
  onHighlightMouseDown: (event: React.MouseEvent<HTMLDivElement>) => void;
  onHighlightMouseEnter: (event: React.MouseEvent<HTMLDivElement>) => void;
  onHighlightMouseLeave: (event: React.MouseEvent<HTMLDivElement>) => void;
  onCopyEvent: (event: React.ClipboardEvent<HTMLDivElement>) => void;
  onInput: (event: React.FormEvent<HTMLDivElement>) => void;
  onEditorKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  onEditorBlur: (event: React.FocusEvent<HTMLDivElement>) => void;
  autocompleteOpen: boolean;
  autocompleteSuggestions: AssetSuggestion[];
  autocompleteSelectedIndex: number;
  autocompletePosition: { top: number; left: number };
  autocompleteLoading: boolean;
  onAutocompleteSelect: (asset: AssetSuggestion) => void;
  onAutocompleteClose: () => void;
  onAutocompleteIndexChange: (index: number) => void;
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
  isInlineLoading: boolean;
  isInlineError: boolean;
  inlineErrorMessage: string;
  isInlineEmpty: boolean;
  customRequest: string;
  onCustomRequestChange: (value: string) => void;
  customRequestError: string;
  onCustomRequestErrorChange: (value: string) => void;
  onCustomRequestSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  isCustomRequestDisabled: boolean;
  isCustomLoading: boolean;
  showI2VLockIndicator: boolean;
  resolvedI2VReason: string | null;
  i2vMotionAlternatives: SuggestionItem[];
  onLockedAlternativeClick: (suggestion: SuggestionItem) => void;
  /* Settings row props */
  renderModelId: string;
  recommendedModelId?: string;
  recommendationPromptId?: string;
  recommendationMode?: 't2v' | 'i2v';
  recommendationAgeMs?: number | null;
  onOpenMotion: () => void;
  onStartFrameUpload?: (file: File) => void | Promise<void>;
  onUploadSidebarImage?: ((file: File) => Promise<SidebarUploadedImage | null>) | undefined;
  onEnhance?: () => void;
}

export function CanvasPromptBar({
  editorRef,
  prompt,
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
  isInlineLoading,
  isInlineError,
  inlineErrorMessage,
  isInlineEmpty,
  customRequest,
  onCustomRequestChange,
  customRequestError,
  onCustomRequestErrorChange,
  onCustomRequestSubmit,
  isCustomRequestDisabled,
  isCustomLoading,
  showI2VLockIndicator,
  resolvedI2VReason,
  i2vMotionAlternatives,
  onLockedAlternativeClick,
  renderModelId,
  recommendedModelId,
  recommendationPromptId,
  recommendationMode,
  recommendationAgeMs,
  onOpenMotion,
  onStartFrameUpload,
  onUploadSidebarImage,
  onEnhance,
}: CanvasPromptBarProps): React.ReactElement {
  const [isFocused, setIsFocused] = useState(false);
  const [isSuggestionTrayCollapsed, setIsSuggestionTrayCollapsed] = useState(false);
  const previousSelectedSpanIdRef = useRef<string | null>(null);

  useEffect(() => {
    return addPromptFocusIntentListener(() => {
      editorRef.current?.focus();
    });
  }, [editorRef]);

  useEffect(() => {
    const previousSelectedSpanId = previousSelectedSpanIdRef.current;
    if (selectedSpanId && selectedSpanId !== previousSelectedSpanId) {
      setIsSuggestionTrayCollapsed(false);
    }
    previousSelectedSpanIdRef.current = selectedSpanId;
  }, [selectedSpanId]);

  const shouldRenderSuggestionTray = Boolean(selectedSpanId);

  return (
    <div className="mx-auto w-[55%] flex-shrink-0 pb-4 pt-1">
      <div
        className={`rounded-[14px] border bg-[#141519] px-4 py-3.5 transition-colors ${
          isFocused ? 'border-[#6C5CE744]' : 'border-[#22252C]'
        }`}
        onClick={() => {
          editorRef.current?.focus();
          setIsFocused(true);
        }}
      >
        <div className="relative">
          <PromptEditor
            ref={editorRef}
            className="min-h-[56px] max-h-[180px] overflow-y-auto text-sm leading-[1.75] text-[#8B92A5] outline-none"
            onTextSelection={onTextSelection}
            onHighlightClick={onHighlightClick}
            onHighlightMouseDown={onHighlightMouseDown}
            onHighlightMouseEnter={onHighlightMouseEnter}
            onHighlightMouseLeave={onHighlightMouseLeave}
            onCopyEvent={onCopyEvent}
            onInput={onInput}
            onKeyDown={onEditorKeyDown}
            onBlur={(event) => {
              setIsFocused(false);
              onEditorBlur(event);
            }}
            onFocus={() => setIsFocused(true)}
          />
          {autocompleteOpen ? (
            <TriggerAutocomplete
              isOpen={autocompleteOpen}
              suggestions={autocompleteSuggestions}
              selectedIndex={autocompleteSelectedIndex}
              position={autocompletePosition}
              isLoading={autocompleteLoading}
              onSelect={onAutocompleteSelect}
              onClose={onAutocompleteClose}
              setSelectedIndex={onAutocompleteIndexChange}
            />
          ) : null}
        </div>

        {shouldRenderSuggestionTray ? (
          <div className="mt-2.5 border-t border-[#22252C] pt-2.5" data-testid="canvas-suggestion-tray">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-[10px] font-semibold tracking-[0.05em] text-[#8B92A5]">
                  {selectionLabel ? `Replace \"${selectionLabel}\"` : 'Replace selection'}
                </span>
                <span className="rounded-full bg-[#1A1C22] px-2 py-0.5 text-[9px] font-semibold text-[#555B6E]">
                  {suggestionCount}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="rounded-md px-2 py-1 text-[10px] font-medium text-[#555B6E] transition-colors hover:bg-[#1A1C22] hover:text-[#8B92A5]"
                  onClick={(event) => {
                    event.stopPropagation();
                    setIsSuggestionTrayCollapsed((prev) => !prev);
                  }}
                >
                  {isSuggestionTrayCollapsed ? 'Expand' : 'Collapse'}
                </button>
                <button
                  type="button"
                  className="flex h-6 w-6 items-center justify-center rounded-md text-[#3A3E4C] transition-colors hover:bg-[#1A1C22] hover:text-[#8B92A5]"
                  onClick={(event) => {
                    event.stopPropagation();
                    onCloseInlinePopover();
                  }}
                  aria-label="Close suggestions"
                >
                  <X size={10} weight="bold" aria-hidden="true" />
                </button>
              </div>
            </div>

            {!isSuggestionTrayCollapsed ? (
              <>
                <div className="border-b border-[#1A1C22] pb-2" data-suggest-custom>
                  <form className="flex items-center gap-2" onSubmit={onCustomRequestSubmit}>
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
                      className="min-h-9 flex-1 resize-none rounded-lg border border-[#22252C] bg-[#141519] px-3 py-2 text-xs text-[#E2E6EF] placeholder:text-[#555B6E] focus-visible:ring-2 focus-visible:ring-[#6C5CE744] focus-visible:ring-offset-0"
                      maxLength={MAX_REQUEST_LENGTH}
                      rows={1}
                      aria-label="Custom suggestion request"
                    />
                    <button
                      type="submit"
                      className={cn(
                        'h-9 rounded-lg border border-[#6C5CE744] bg-[#6C5CE7] px-3 text-xs font-semibold text-[#0D0E12] transition-opacity hover:opacity-90',
                        isCustomRequestDisabled && 'opacity-50'
                      )}
                      disabled={isCustomRequestDisabled}
                      aria-busy={isCustomLoading}
                    >
                      {isCustomLoading ? 'Applying...' : 'Apply'}
                    </button>
                  </form>
                  {customRequestError ? (
                    <div
                      className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400"
                      role="alert"
                    >
                      {customRequestError}
                    </div>
                  ) : null}
                </div>

                {isInlineError ? (
                  <div
                    className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400"
                    role="alert"
                  >
                    {inlineErrorMessage}
                  </div>
                ) : null}

                {showI2VLockIndicator ? (
                  <LockedSpanIndicator
                    reason={resolvedI2VReason}
                    motionAlternatives={i2vMotionAlternatives}
                    onSelectAlternative={onLockedAlternativeClick}
                    className="mt-2 border-[#22252C] bg-[#16181E]"
                  />
                ) : null}

                {isInlineLoading ? (
                  <div className="mt-2 flex gap-2">
                    <div className="h-8 w-24 animate-pulse rounded-lg bg-[#1A1C22]" />
                    <div className="h-8 w-32 animate-pulse rounded-lg bg-[#1A1C22]" />
                    <div className="h-8 w-20 animate-pulse rounded-lg bg-[#1A1C22]" />
                  </div>
                ) : null}

                {!isInlineLoading && !isInlineError && suggestionCount > 0 ? (
                  <div
                    ref={suggestionsListRef}
                    className="mt-2 flex gap-2 overflow-x-auto pb-1"
                  >
                    {inlineSuggestions.map((suggestion, index) => (
                      <button
                        key={suggestion.key}
                        type="button"
                        data-index={index}
                        className={cn(
                          'flex-shrink-0 rounded-lg border px-3 py-1.5 text-xs transition-colors',
                          activeSuggestionIndex === index
                            ? 'border-[#6C5CE7]/50 bg-[#6C5CE7]/10 text-[#E2E6EF]'
                            : 'border-[#22252C] bg-[#141519] text-[#8B92A5] hover:border-[#3A3E4C] hover:text-[#E2E6EF]'
                        )}
                        onMouseDown={(event) => event.preventDefault()}
                        onMouseEnter={() => {
                          interactionSourceRef.current = 'mouse';
                          onActiveSuggestionChange(index);
                        }}
                        onClick={() => {
                          onSuggestionClick(suggestion.item);
                          onCloseInlinePopover();
                        }}
                      >
                        {suggestion.text}
                        {index === 0 ? (
                          <span className="ml-1.5 text-[9px] font-semibold text-[#6C5CE7]">
                            Best
                          </span>
                        ) : suggestion.meta ? (
                          <span className="ml-1.5 text-[9px] text-[#555B6E]">
                            {suggestion.meta}
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                ) : null}

                {isInlineEmpty ? (
                  <div className="mt-2 text-xs text-[#555B6E]">No suggestions yet.</div>
                ) : null}

                <div className="mt-2 flex items-center gap-2 border-t border-[#1A1C22] pt-2">
                  <button
                    type="button"
                    className="h-8 rounded-lg border border-[#22252C] bg-transparent px-3 text-xs font-semibold text-[#8B92A5] transition-colors hover:border-[#3A3E4C] hover:text-[#E2E6EF]"
                    onClick={(event) => {
                      event.stopPropagation();
                      onCloseInlinePopover();
                    }}
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    className={cn(
                      'h-8 rounded-lg border border-[#6C5CE744] bg-[#6C5CE7] px-3 text-xs font-semibold text-[#0D0E12] transition-opacity hover:opacity-90',
                      suggestionCount === 0 && 'opacity-50'
                    )}
                    onClick={(event) => {
                      event.stopPropagation();
                      onApplyActiveSuggestion();
                      onCloseInlinePopover();
                    }}
                    disabled={suggestionCount === 0}
                  >
                    Apply
                  </button>
                </div>
              </>
            ) : null}
          </div>
        ) : null}

        <CanvasSettingsRow
          prompt={prompt}
          renderModelId={renderModelId}
          {...(recommendedModelId ? { recommendedModelId } : {})}
          {...(recommendationPromptId ? { recommendationPromptId } : {})}
          {...(recommendationMode ? { recommendationMode } : {})}
          {...(typeof recommendationAgeMs === 'number' ? { recommendationAgeMs } : {})}
          onOpenMotion={onOpenMotion}
          {...(onStartFrameUpload ? { onStartFrameUpload } : {})}
          {...(onUploadSidebarImage ? { onUploadSidebarImage } : {})}
          {...(onEnhance ? { onEnhance } : {})}
        />
      </div>
    </div>
  );
}
