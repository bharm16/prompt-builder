export function unwrapSuggestionsArray<T>(
  parsedJSON: T,
  isArray: boolean,
): { value: T; unwrapped: boolean } {
  if (
    isArray &&
    !Array.isArray(parsedJSON) &&
    typeof parsedJSON === "object" &&
    parsedJSON !== null
  ) {
    const wrapped = parsedJSON as Record<string, unknown>;
    if (Array.isArray(wrapped.suggestions)) {
      return { value: wrapped.suggestions as T, unwrapped: true };
    }
  }

  return { value: parsedJSON, unwrapped: false };
}

/**
 * Same as unwrapSuggestionsArray but also returns the parent object's
 * non-`suggestions` fields ("siblings"). Used by callers that need to
 * read metadata fields the LLM emits alongside the suggestions array
 * (e.g., `scene_summary` for Sub-project B's prompt-engineering work).
 *
 * Siblings is always {} when the parent isn't an unwrappable object,
 * so callers don't have to null-check.
 */
export function unwrapSuggestionsArrayWithSiblings<T>(
  parsedJSON: unknown,
  isArray: boolean,
): { value: T; siblings: Record<string, unknown>; unwrapped: boolean } {
  if (
    isArray &&
    !Array.isArray(parsedJSON) &&
    typeof parsedJSON === "object" &&
    parsedJSON !== null
  ) {
    const wrapped = parsedJSON as Record<string, unknown>;
    if (Array.isArray(wrapped.suggestions)) {
      const siblings: Record<string, unknown> = {};
      for (const key of Object.keys(wrapped)) {
        if (key !== "suggestions") siblings[key] = wrapped[key];
      }
      return { value: wrapped.suggestions as T, siblings, unwrapped: true };
    }
  }

  return { value: parsedJSON as T, siblings: {}, unwrapped: false };
}
