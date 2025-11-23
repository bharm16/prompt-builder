/**
 * JSON parsing utilities for span labeling
 *
 * Handles common LLM response formats like markdown code fences
 * and provides safe parsing with error handling.
 */

/**
 * Remove markdown code fence from JSON response
 *
 * LLMs often wrap JSON in ```json ... ``` blocks even when told not to.
 * This function strips those wrappers for safe parsing.
 *
 * @param {string} value - Raw string that may contain markdown fences
 * @returns {string} Cleaned string without markdown fences
 */
export function cleanJsonEnvelope(value) {
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
 * @param {string} raw - Raw JSON string to parse
 * @returns {Object} {ok: boolean, value?: any, error?: string}
 */
export function parseJson(raw) {
  try {
    return { ok: true, value: JSON.parse(cleanJsonEnvelope(raw)) };
  } catch (error) {
    return { ok: false, error: `Invalid JSON: ${error.message}` };
  }
}

/**
 * Build user payload for LLM request
 *
 * Constructs a JSON payload with task, policy, text, and optional validation feedback.
 * Used for both initial labeling and repair attempts.
 * 
 * SECURITY (PDF Section 1.6): Wraps user text in XML tags to prevent prompt injection
 *
 * @param {Object} params
 * @param {string} params.task - Task description
 * @param {Object} params.policy - Validation policy
 * @param {string} params.text - Source text to label
 * @param {string} params.templateVersion - Template version
 * @param {Object} [params.validation] - Optional validation feedback for repair
 * @returns {string} JSON stringified payload
 */
export function buildUserPayload({ task, policy, text, templateVersion, validation }) {
  const payload = {
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
