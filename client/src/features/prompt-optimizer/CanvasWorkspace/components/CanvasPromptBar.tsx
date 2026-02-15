import React, { useEffect } from 'react';
import { TriggerAutocomplete } from '@/features/assets/components/TriggerAutocomplete';
import type { AssetSuggestion } from '@/features/assets/hooks/useTriggerAutocomplete';
import { PromptEditor } from '@/features/prompt-optimizer/components/PromptEditor';
import { addPromptFocusIntentListener } from '@/features/prompt-optimizer/CanvasWorkspace/events';

interface CanvasPromptBarProps {
  editorRef: React.RefObject<HTMLDivElement>;
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
}

export function CanvasPromptBar({
  editorRef,
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
}: CanvasPromptBarProps): React.ReactElement {
  useEffect(() => {
    return addPromptFocusIntentListener(() => {
      editorRef.current?.focus();
    });
  }, [editorRef]);

  return (
    <div className="relative border-t border-[#1A1C22] bg-[#10121A] px-3 py-3">
      <div className="relative overflow-hidden rounded-xl border border-[#22252C] bg-[#0D0F16]">
        <PromptEditor
          ref={editorRef}
          className="min-h-[108px] max-h-[220px] overflow-y-auto px-4 py-3 text-[14px] leading-relaxed text-[#E2E6EF] outline-none"
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
      <p className="mt-1.5 text-[11px] text-[#5F6577]">
        Press Cmd/Ctrl + Enter to optimize. Use @ to insert assets.
      </p>
    </div>
  );
}
