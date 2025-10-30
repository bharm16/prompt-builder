import { forwardRef } from 'react';

/**
 * Prompt Editor Component
 * ContentEditable editor for the optimized prompt
 */
export const PromptEditor = forwardRef(({
  onTextSelection,
  onHighlightClick,
  onHighlightMouseDown,
  onCopyEvent,
  onInput,
}, ref) => {
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
      className="min-h-[calc(100vh-8rem)] outline-none focus:outline-none cursor-text"
      style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"',
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
