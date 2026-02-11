import type { SuggestionItem } from '@features/prompt-optimizer/PromptCanvas/types';

export function mergeSuggestions(
  existing: SuggestionItem[],
  incoming: SuggestionItem[]
): SuggestionItem[] {
  const seen = new Set<string>();
  const out: SuggestionItem[] = [];

  const add = (suggestion: SuggestionItem): void => {
    const key = (suggestion?.text || '').trim().toLowerCase();
    if (!key) return;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(suggestion);
  };

  existing.forEach(add);
  incoming.forEach(add);

  return out;
}
