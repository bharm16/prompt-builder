export function unwrapSuggestionsArray<T>(
  parsedJSON: T,
  isArray: boolean
): { value: T; unwrapped: boolean } {
  if (isArray && !Array.isArray(parsedJSON) && typeof parsedJSON === 'object' && parsedJSON !== null) {
    const wrapped = parsedJSON as Record<string, unknown>;
    if (Array.isArray(wrapped.suggestions)) {
      return { value: wrapped.suggestions as T, unwrapped: true };
    }
  }

  return { value: parsedJSON, unwrapped: false };
}
