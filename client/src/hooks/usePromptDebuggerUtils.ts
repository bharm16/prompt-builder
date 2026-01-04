import type { Highlight, PromptDebuggerState } from './types';

export interface HighlightSuggestionPayload {
  highlightedText: string;
  contextBefore: string;
  contextAfter: string;
  fullPrompt: string;
  originalUserPrompt: string;
  brainstormContext?: unknown | null;
  highlightedCategory?: string | null;
  highlightedCategoryConfidence?: number | null;
  highlightedPhrase?: string | null;
}

export function buildHighlightSuggestionPayload(
  state: PromptDebuggerState,
  highlight: Highlight
): HighlightSuggestionPayload {
  const fullPrompt =
    state.displayedPrompt || state.optimizedPrompt || state.inputPrompt || '';
  const highlightIndex = fullPrompt.indexOf(highlight.text);

  const contextBefore = fullPrompt
    .substring(Math.max(0, highlightIndex - 300), highlightIndex)
    .trim();
  const contextAfter = fullPrompt
    .substring(
      highlightIndex + highlight.text.length,
      Math.min(fullPrompt.length, highlightIndex + highlight.text.length + 300)
    )
    .trim();

  const brainstormContext =
    state.promptContext && typeof state.promptContext === 'object' && 'toJSON' in state.promptContext
      ? (state.promptContext.toJSON as () => unknown)()
      : state.promptContext;

  return {
    highlightedText: highlight.text,
    contextBefore,
    contextAfter,
    fullPrompt,
    originalUserPrompt: state.inputPrompt,
    brainstormContext,
    highlightedCategory: highlight.category,
    highlightedCategoryConfidence: highlight.confidence,
    highlightedPhrase: highlight.text,
  };
}
