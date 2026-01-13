import type { LabeledSpan } from './types.js';

/**
 * Safely parse JSON from LLM response
 */
export function safeParseJSON(value: string | null | undefined): { spans?: LabeledSpan[] } | null {
  if (!value) return null;

  const trimmed = value.trim();
  const withoutFences = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '');

  try {
    return JSON.parse(withoutFences) as { spans?: LabeledSpan[] };
  } catch {
    const match = withoutFences.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as { spans?: LabeledSpan[] };
      } catch {
        return null;
      }
    }
    return null;
  }
}
