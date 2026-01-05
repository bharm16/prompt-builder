import { forwardRef, useCallback } from 'react';
import type { PromptEditorProps } from '../types';

/**
 * Prompt Editor Component
 * ContentEditable editor for the optimized prompt
 */
export const PromptEditor = forwardRef<HTMLDivElement, PromptEditorProps>(({
  onTextSelection,
  onHighlightClick,
  onHighlightMouseDown,
  onHighlightMouseEnter,
  onHighlightMouseLeave,
  onCopyEvent,
  onInput,
  onFocus,
  onBlur,
}, ref): React.ReactElement => {
  // Use event delegation for hover detection
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>): void => {
    if (onHighlightMouseEnter) {
      onHighlightMouseEnter(e);
    }
  }, [onHighlightMouseEnter]);

  return (
    <div
      ref={ref}
      onMouseUp={onTextSelection}
      onClick={onHighlightClick}
      onMouseDown={onHighlightMouseDown}
      onMouseMove={handleMouseMove}
      onMouseLeave={onHighlightMouseLeave}
      onCopy={onCopyEvent}
      onInput={onInput}
      onFocus={onFocus}
      onBlur={onBlur}
      contentEditable
      suppressContentEditableWarning
      className="prompt-editor"
      style={{
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
        minHeight: '1px',
        width: '100%',
      }}
      role="textbox"
      aria-label="Optimized prompt"
    />
  );
});

PromptEditor.displayName = 'PromptEditor';

