import React from 'react';
import { Textarea } from '@promptstudio/system/components/ui';
import { cn } from '@utils/cn';
import { PromptTriggerAutocomplete, type AutocompleteState } from './PromptTriggerAutocomplete';

interface PromptEditorProps {
  prompt: string;
  onPromptChange?: (prompt: string) => void;
  isInputLocked: boolean;
  isOptimizing: boolean;
  promptInputRef: React.RefObject<HTMLTextAreaElement | null>;
  onPromptInputChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onPromptKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onCreateFromTrigger?: (trigger: string) => void;
  autocomplete: AutocompleteState;
  placeholder?: string;
  rows?: number;
  spellCheck?: boolean;
  containerClassName?: string;
  textareaClassName?: string;
  overlay?: React.ReactNode;
  footer?: React.ReactNode;
}

export function PromptEditor({
  prompt,
  onPromptChange,
  isInputLocked,
  isOptimizing,
  promptInputRef,
  onPromptInputChange,
  onPromptKeyDown,
  onCreateFromTrigger,
  autocomplete,
  placeholder = '',
  rows = 6,
  spellCheck = false,
  containerClassName,
  textareaClassName,
  overlay,
  footer,
}: PromptEditorProps): React.ReactElement {
  return (
    <div className={containerClassName}>
      <Textarea
        ref={promptInputRef}
        value={prompt}
        onChange={onPromptInputChange}
        onKeyDown={onPromptKeyDown}
        onKeyUp={autocomplete.updateAutocompletePosition}
        onClick={autocomplete.updateAutocompletePosition}
        onBlur={autocomplete.closeAutocomplete}
        placeholder={placeholder}
        readOnly={!onPromptChange || isInputLocked}
        rows={rows}
        className={cn(textareaClassName, (!onPromptChange || isInputLocked) && 'opacity-80')}
        aria-label="Text Prompt Input"
        aria-readonly={!onPromptChange || isInputLocked}
        aria-busy={isOptimizing}
        spellCheck={spellCheck}
      />

      <PromptTriggerAutocomplete
        autocomplete={autocomplete}
        onCreateFromTrigger={onCreateFromTrigger}
      />

      {overlay}
      {footer}
    </div>
  );
}
