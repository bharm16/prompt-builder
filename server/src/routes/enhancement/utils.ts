export const countSuggestions = (suggestions: unknown): number => {
  if (!Array.isArray(suggestions)) return 0;
  const first = suggestions[0] as { suggestions?: unknown } | undefined;
  if (first && Array.isArray(first.suggestions)) {
    return suggestions.reduce((sum, group) => {
      const groupSuggestions = (group as { suggestions?: unknown }).suggestions;
      return sum + (Array.isArray(groupSuggestions) ? groupSuggestions.length : 0);
    }, 0);
  }
  return suggestions.length;
};
