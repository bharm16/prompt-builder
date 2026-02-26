/**
 * JSON parsing utilities for span labeling
 *
 * Handles common LLM response formats like markdown code fences
 * and provides safe parsing with error handling.
 */
import { attemptJsonRepair, assessRepairCompleteness } from '@clients/adapters/jsonRepair';
import { cleanJSONResponse } from '@utils/JsonExtractor';

export interface UserPayloadParams {
  task: string;
  policy: Record<string, unknown>;
  text: string;
  templateVersion: string;
  validation?: Record<string, unknown>;
}

type ParseResult =
  | { ok: true; value: unknown; repairMeta?: { isLikelyTruncated: boolean; reason?: string } }
  | { ok: false; error: string };

/**
 * Remove markdown code fence from JSON response
 *
 * LLMs often wrap JSON in ```json ... ``` blocks even when told not to.
 * This function strips those wrappers for safe parsing.
 *
 * @param value - Raw string that may contain markdown fences
 * @returns Cleaned string without markdown fences
 */
export function cleanJsonEnvelope(value: unknown): string {
  if (typeof value !== 'string') return '';

  const trimmed = value.trim();
  if (!trimmed) return trimmed;

  // Check for markdown code fence
  if (trimmed.startsWith('```')) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, '')  // Remove opening fence
      .replace(/```$/i, '')               // Remove closing fence
      .trim();
  }

  return trimmed;
}

/**
 * Parse JSON string with error handling
 *
 * Returns a result object with either success (ok: true, value)
 * or failure (ok: false, error) to avoid exception handling.
 *
 * @param raw - Raw JSON string to parse
 * @returns Result object with ok, value, and error fields
 */
export function parseJson(raw: string): ParseResult {
  const cleaned = cleanJsonEnvelope(raw);

  let result = tryParseJson(cleaned);
  if (result.ok) return result;

  const extracted = extractJsonCandidate(cleaned);
  if (extracted !== cleaned) {
    result = tryParseJson(extracted);
    if (result.ok) return result;
  }

  const newlineEscaped = escapeNewlinesInStrings(extracted);
  if (newlineEscaped !== extracted) {
    result = tryParseJson(newlineEscaped);
    if (result.ok) return result;
  }

  const repairResult = attemptJsonRepair(newlineEscaped);
  result = tryParseJson(repairResult.repaired);
  if (result.ok) {
    const completeness = assessRepairCompleteness(repairResult);
    return { ...result, repairMeta: completeness };
  }

  return result;
}

function tryParseJson(raw: string): ParseResult {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch (error) {
    const err = error as { message?: string };
    return { ok: false, error: `Invalid JSON: ${err.message}` };
  }
}

function detectJsonContainer(text: string): 'array' | 'object' {
  const arrayIndex = text.indexOf('[');
  const objectIndex = text.indexOf('{');

  if (arrayIndex === -1 && objectIndex === -1) {
    return 'object';
  }
  if (arrayIndex === -1) {
    return 'object';
  }
  if (objectIndex === -1) {
    return 'array';
  }

  return arrayIndex < objectIndex ? 'array' : 'object';
}

function extractJsonCandidate(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  const container = detectJsonContainer(trimmed);
  try {
    return cleanJSONResponse(trimmed, container === 'array');
  } catch {
    return trimmed;
  }
}

function escapeNewlinesInStrings(value: string): string {
  if (!value) return value;

  let result = '';
  let inString = false;
  let escaped = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        result += char;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        result += char;
        continue;
      }

      if (char === '"') {
        inString = false;
        result += char;
        continue;
      }

      if (char === '\n') {
        result += '\\n';
        continue;
      }

      if (char === '\r') {
        result += '\\r';
        continue;
      }

      if (char === '\t') {
        result += '\\t';
        continue;
      }

      result += char;
      continue;
    }

    if (char === '"') {
      inString = true;
    }

    result += char;
  }

  if (inString) {
    result += '"';
  }

  return result;
}

/**
 * Build user payload for LLM request
 *
 * Constructs a JSON payload with task, policy, text, and optional validation feedback.
 * Used for both initial labeling and repair attempts.
 * 
 * SECURITY (PDF Section 1.6): Wraps user text in XML tags to prevent prompt injection
 *
 * @param params - Payload inputs for the LLM request
 * @param params.task - Task description
 * @param params.policy - Validation policy
 * @param params.text - Source text to label
 * @param params.templateVersion - Template version
 * @param params.validation - Optional validation feedback for repair
 * @returns JSON stringified payload
 */
export function buildUserPayload({
  task,
  policy,
  text,
  templateVersion,
  validation,
}: UserPayloadParams): string {
  const payload: {
    task: string;
    policy: Record<string, unknown>;
    text: string;
    templateVersion: string;
    validation?: Record<string, unknown>;
  } = {
    task,
    policy,
    // Wrap user input in XML tags for adversarial safety (PDF Design A, Section 1.6)
    text: `<user_input>\n${text}\n</user_input>`,
    templateVersion,
  };

  if (validation) {
    payload.validation = validation;
  }

  return JSON.stringify(payload);
}
