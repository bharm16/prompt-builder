/**
 * JSON repair utilities
 *
 * Single responsibility: apply heuristic fixes to malformed JSON strings.
 */

export function attemptJsonRepair(text: string): { repaired: string; changes: string[] } {
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

  // Attempt to close unclosed JSON
  const openBraces = (repaired.match(/{/g) || []).length;
  const closeBraces = (repaired.match(/}/g) || []).length;
  if (openBraces > closeBraces) {
    repaired += '}'.repeat(openBraces - closeBraces);
    changes.push(`Added ${openBraces - closeBraces} closing braces`);
  }

  const openBrackets = (repaired.match(/\[/g) || []).length;
  const closeBrackets = (repaired.match(/\]/g) || []).length;
  if (openBrackets > closeBrackets) {
    repaired += ']'.repeat(openBrackets - closeBrackets);
    changes.push(`Added ${openBrackets - closeBrackets} closing brackets`);
  }

  return { repaired, changes };
}
