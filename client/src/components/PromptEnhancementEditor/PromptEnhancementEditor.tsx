import React from 'react';
import { useEnhancementEditor } from './hooks/useEnhancementEditor';
import type { PromptEnhancementEditorProps } from './types';

/**
 * PromptEnhancementEditor - Text selection and enhancement component
 *
 * Allows users to select text and receive AI-powered enhancement suggestions.
 * Orchestrates state management, API calls, and rendering through extracted modules.
 */
export default function PromptEnhancementEditor({
  promptContent,
  onPromptUpdate,
  originalUserPrompt,
  onShowSuggestionsChange,
}: PromptEnhancementEditorProps): React.ReactElement {
  const { contentRef, handleMouseUp } = useEnhancementEditor({
    promptContent,
    onPromptUpdate,
    originalUserPrompt,
    onShowSuggestionsChange,
  });

  return (
    <div
      ref={contentRef}
      onMouseUp={handleMouseUp}
      className="cursor-text select-text font-sans text-base leading-relaxed text-neutral-900"
      style={{
        userSelect: 'text',
        WebkitUserSelect: 'text',
        MozUserSelect: 'text',
        msUserSelect: 'text',
        lineHeight: '1.75',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
        paddingLeft: '20px',
        textIndent: '-20px',
        letterSpacing: '-0.01em',
      }}
    >
      {promptContent}
    </div>
  );
}
