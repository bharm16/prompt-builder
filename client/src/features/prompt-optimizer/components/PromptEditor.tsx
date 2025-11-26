import { forwardRef } from 'react';
import type { PromptEditorProps } from '../types';

/**
 * Prompt Editor Component
 * ContentEditable editor for the optimized prompt
 */
export const PromptEditor = forwardRef<HTMLDivElement, PromptEditorProps>(({
  onTextSelection,
  onHighlightClick,
  onHighlightMouseDown,
  onCopyEvent,
  onInput,
}, ref): React.ReactElement => {
  return (
    <div
      ref={ref}
      onMouseUp={onTextSelection}
      onClick={onHighlightClick}
      onMouseDown={onHighlightMouseDown}
      onCopy={onCopyEvent}
      onInput={onInput}
      contentEditable
      suppressContentEditableWarning
      className="outline-none focus:outline-none cursor-text font-sans text-copy-16 text-geist-foreground"
      style={{
        caretColor: 'rgb(23, 23, 23)',
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
      }}
      role="textbox"
      aria-label="Optimized prompt"
    />
  );
});

PromptEditor.displayName = 'PromptEditor';

