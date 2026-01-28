import type { EnhancementSuggestionsRequest } from '@/api/enhancementSuggestionsApi';
import type { Highlight, PromptDebuggerState } from './types';

export type HighlightSuggestionPayload = EnhancementSuggestionsRequest & {
  originalUserPrompt: string;
};

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

  const resolvedBrainstormContext =
    state.promptContext && typeof state.promptContext === 'object' && 'toJSON' in state.promptContext
      ? (state.promptContext.toJSON as () => unknown)()
      : state.promptContext;
  const brainstormContext =
    resolvedBrainstormContext === undefined ? null : resolvedBrainstormContext;

  return {
    highlightedText: highlight.text,
    contextBefore,
    contextAfter,
    fullPrompt,
    originalUserPrompt: state.inputPrompt,
    brainstormContext,
    highlightedCategory: highlight.category ?? null,
    highlightedCategoryConfidence: highlight.confidence ?? null,
    highlightedPhrase: highlight.text,
  };
}
