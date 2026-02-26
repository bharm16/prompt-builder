import type { SuggestionItem } from '@features/prompt-optimizer/PromptCanvas/types';

export type EnhancementSuggestionEntry =
  | SuggestionItem
  | string
  | { suggestions?: Array<SuggestionItem | string>; category?: string };

export function normalizeSuggestionList(
  input: Array<EnhancementSuggestionEntry | null | undefined>
): SuggestionItem[] {
  const normalized: SuggestionItem[] = [];

  input.forEach((entry) => {
    if (!entry) {
      return;
    }

    if (typeof entry === 'string') {
      normalized.push({ text: entry });
      return;
    }

    if (typeof entry !== 'object') {
      return;
    }

    const candidate = entry as {
      suggestions?: Array<SuggestionItem | string>;
      category?: string;
    } & SuggestionItem;

    if (Array.isArray(candidate.suggestions)) {
      const groupCategory =
        typeof candidate.category === 'string' ? candidate.category : undefined;

      candidate.suggestions.forEach((nested) => {
        if (!nested) {
          return;
        }

        if (typeof nested === 'string') {
          normalized.push({
            text: nested,
            ...(groupCategory ? { category: groupCategory } : {}),
          });
          return;
        }

        if (typeof nested === 'object') {
          const nestedItem = nested as SuggestionItem;
          const hasCategory = typeof nestedItem.category === 'string';
          normalized.push({
            ...nestedItem,
            ...(groupCategory && !hasCategory ? { category: groupCategory } : {}),
          });
        }
      });
      return;
    }

    normalized.push(candidate);
  });

  return normalized;
}
