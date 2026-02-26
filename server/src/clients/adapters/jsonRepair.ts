/**
 * JSON repair utilities
 *
 * Single responsibility: apply heuristic fixes to malformed JSON strings.
 */

export interface JsonRepairResult {
  repaired: string;
  changes: string[];
  /** Number of `}` auto-appended to balance unclosed braces */
  autoClosedBraces: number;
  /** Number of `]` auto-appended to balance unclosed brackets */
  autoClosedBrackets: number;
}

export function attemptJsonRepair(text: string): JsonRepairResult {
  const changes: string[] = [];
  let repaired = text;

  // Fix trailing commas before closing brackets
  const trailingCommaPattern = /,(\s*[}\]])/g;
  if (trailingCommaPattern.test(repaired)) {
    repaired = repaired.replace(trailingCommaPattern, '$1');
    changes.push('Removed trailing commas');
  }

  // Fix missing commas between array elements
  const missingCommaPattern = /}(\s*){/g;
  if (missingCommaPattern.test(repaired)) {
    repaired = repaired.replace(missingCommaPattern, '},$1{');
    changes.push('Added missing commas between objects');
  }

  // Fix single quotes to double quotes
  const singleQuotePattern = /'([^']*)'(?=\s*:)/g;
  if (singleQuotePattern.test(repaired)) {
    repaired = repaired.replace(singleQuotePattern, '"$1"');
    changes.push('Converted single quotes to double quotes');
  }

  // Fix unquoted keys
  const unquotedKeyPattern = /([{,]\s*)(\w+)(\s*:)/g;
  const originalRepaired = repaired;
  repaired = repaired.replace(unquotedKeyPattern, '$1"$2"$3');
  if (repaired !== originalRepaired) {
    changes.push('Added quotes to unquoted keys');
  }

  // Attempt to close unclosed JSON — track auto-close counts
  const openBraces = (repaired.match(/{/g) || []).length;
  const closeBraces = (repaired.match(/}/g) || []).length;
  const autoClosedBraces = Math.max(0, openBraces - closeBraces);
  if (autoClosedBraces > 0) {
    repaired += '}'.repeat(autoClosedBraces);
    changes.push(`Added ${autoClosedBraces} closing braces`);
  }

  const openBrackets = (repaired.match(/\[/g) || []).length;
  const closeBrackets = (repaired.match(/\]/g) || []).length;
  const autoClosedBrackets = Math.max(0, openBrackets - closeBrackets);
  if (autoClosedBrackets > 0) {
    repaired += ']'.repeat(autoClosedBrackets);
    changes.push(`Added ${autoClosedBrackets} closing brackets`);
  }

  return { repaired, changes, autoClosedBraces, autoClosedBrackets };
}

/**
 * Assess whether a repaired JSON string is likely truncated.
 *
 * Heuristics:
 * - Auto-closed braces/brackets strongly suggest the LLM ran out of tokens
 * - If the parsed result is an array shorter than `expectedMinItems`, it may be incomplete
 * - Trailing patterns like `,"` or `:"` indicate mid-value truncation
 */
export function assessRepairCompleteness(
  result: JsonRepairResult,
  expectedMinItems?: number
): { isLikelyTruncated: boolean; reason?: string } {
  // Auto-closed delimiters are the strongest signal of truncation
  if (result.autoClosedBraces > 0 || result.autoClosedBrackets > 0) {
    return {
      isLikelyTruncated: true,
      reason: `Auto-closed ${result.autoClosedBraces} braces and ${result.autoClosedBrackets} brackets`,
    };
  }

  // Check if the text before repair ended mid-value
  // (the repaired string already has closers appended, so check the original-length substring)
  const originalLength = result.repaired.length; // no closers were added if we got here
  const trimmed = result.repaired.slice(0, originalLength).trimEnd();
  if (trimmed.endsWith(',"') || trimmed.endsWith(':"') || trimmed.endsWith(': "')) {
    return {
      isLikelyTruncated: true,
      reason: 'Text ends with incomplete key-value pattern',
    };
  }

  // Optional array length check
  if (expectedMinItems !== undefined && expectedMinItems > 0) {
    try {
      const parsed: unknown = JSON.parse(result.repaired);
      if (Array.isArray(parsed) && parsed.length < expectedMinItems) {
        return {
          isLikelyTruncated: true,
          reason: `Array has ${parsed.length} items, expected at least ${expectedMinItems}`,
        };
      }
    } catch {
      // Parse failure — not our concern here
    }
  }

  return { isLikelyTruncated: false };
}
