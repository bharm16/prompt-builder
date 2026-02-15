import React, { useEffect, useMemo, useState } from 'react';
import { TriggerAutocomplete } from '@/features/assets/components/TriggerAutocomplete';
import type { AssetSuggestion } from '@/features/assets/hooks/useTriggerAutocomplete';
import { PromptEditor } from '@/features/prompt-optimizer/components/PromptEditor';
import { addPromptFocusIntentListener } from '@/features/prompt-optimizer/CanvasWorkspace/events';
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
  /* Settings row props */
  renderModelId: string;
  recommendedModelId?: string;
  recommendationPromptId?: string;
  recommendationMode?: 't2v' | 'i2v';
  recommendationAgeMs?: number | null;
  onOpenMotion: () => void;
  onStartFrameUpload?: (file: File) => void | Promise<void>;
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
  renderModelId,
  recommendedModelId,
  recommendationPromptId,
  recommendationMode,
  recommendationAgeMs,
  onOpenMotion,
  onStartFrameUpload,
  onEnhance,
}: CanvasPromptBarProps): React.ReactElement {
  const [isFocused, setIsFocused] = useState(false);

  const charCount = useMemo(() => prompt.length, [prompt]);

  useEffect(() => {
    return addPromptFocusIntentListener(() => {
      editorRef.current?.focus();
    });
  }, [editorRef]);

  return (
    <div className="flex-shrink-0 px-4 pb-4 pt-1">
      {/* Single prompt container card — text + settings inside */}
      <div
        className={`rounded-[14px] border bg-[#141519] px-4 py-3.5 transition-colors ${
          isFocused ? 'border-[#6C5CE744]' : 'border-[#22252C]'
        }`}
        onClick={() => {
          editorRef.current?.focus();
          setIsFocused(true);
        }}
      >
        {/* Prompt editor */}
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
            onBlur={(e) => {
              setIsFocused(false);
              onEditorBlur(e);
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

        {/* Settings row — inside the prompt card, below a subtle separator */}
        <CanvasSettingsRow
          prompt={prompt}
          charCount={charCount}
          renderModelId={renderModelId}
          {...(recommendedModelId ? { recommendedModelId } : {})}
          {...(recommendationPromptId ? { recommendationPromptId } : {})}
          {...(recommendationMode ? { recommendationMode } : {})}
          {...(typeof recommendationAgeMs === 'number'
            ? { recommendationAgeMs }
            : {})}
          onOpenMotion={onOpenMotion}
          {...(onStartFrameUpload ? { onStartFrameUpload } : {})}
          {...(onEnhance ? { onEnhance } : {})}
        />
      </div>
    </div>
  );
}
