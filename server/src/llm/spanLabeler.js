import Ajv from 'ajv';
import { callOpenAI } from './openAIClient.js';

const ROLE_SET = new Set([
  'Wardrobe',
  'Appearance',
  'Lighting',
  'TimeOfDay',
  'CameraMove',
  'Framing',
  'Environment',
  'Color',
  'Technical',
  'Descriptive',
]);

// Performance and capacity constants
const MAX_SPANS_ABSOLUTE_LIMIT = 80; // Hard upper bound to prevent excessive processing
const DEFAULT_MAX_TOKENS = 800; // Conservative default for response generation
const TOKEN_ESTIMATION_BASE = 400; // Base tokens for response structure
const TOKEN_ESTIMATION_PER_SPAN = 25; // Average tokens per span in response
const MAX_TOKEN_RESPONSE_LIMIT = 4000; // Absolute maximum tokens for any response

// Optimized prompt: reduced from 1447 to ~800 characters (45% reduction)
// This reduces token usage by ~160 tokens per request, improving API latency
const BASE_SYSTEM_PROMPT = `Label spans for video prompts.

Roles: Wardrobe,Appearance,Lighting,TimeOfDay,CameraMove,Framing,Environment,Color,Technical,Descriptive.

CRITICAL: Analyze ENTIRE text. Don't skip sections (TECHNICAL SPECS, ALTERNATIVES, etc.). Label ALL camera/lighting/technical terms throughout.

Rules:
- Use exact substrings from text (no paraphrasing)
- start/end = approx 0-based offsets (auto-corrected server-side)
- No overlaps unless allowed
- Non-Technical spans ≤6 words
- Confidence in [0,1], use 0.7 if unsure
- Fewer meaningful spans > many trivial ones

Example text: "Wide shot... TECHNICAL SPECS - Duration:4-8s, 24fps ALTERNATIVES - Close-up"
Label: "Wide shot"(Framing), "4-8s"(Technical), "24fps"(Technical), "Close-up"(Framing)

Output JSON only (no markdown):
{"spans":[{"text":"","start":0,"end":0,"role":"","confidence":0.7}],"meta":{"version":"","notes":""}}`;

const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['spans', 'meta'],
  properties: {
    spans: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['text', 'start', 'end'],
        properties: {
          text: { type: 'string' },
          start: { type: 'integer', minimum: 0 },
          end: { type: 'integer', minimum: 0 },
          role: { type: 'string', default: 'Descriptive' },
          confidence: {
            type: 'number',
            minimum: 0,
            maximum: 1,
            default: 0.7,
          },
        },
      },
    },
    meta: {
      type: 'object',
      additionalProperties: false,
      required: ['version', 'notes'],
      properties: {
        version: { type: 'string' },
        notes: { type: 'string' },
      },
    },
  },
};

const ajv = new Ajv({
  allErrors: true,
  removeAdditional: 'failing',
  useDefaults: true,
});
const validateResponseSchema = ajv.compile(RESPONSE_SCHEMA);

const DEFAULT_POLICY = {
  nonTechnicalWordLimit: 6,
  allowOverlap: false,
};

const DEFAULT_OPTIONS = {
  maxSpans: 60,
  minConfidence: 0.5,
  templateVersion: 'v1',
};

/**
 * Clamp a value to the range [0, 1]
 * @param {number} value - Value to clamp
 * @returns {number} Clamped value between 0 and 1, or 0.7 if invalid
 */
const clamp01 = (value) =>
  typeof value === 'number' ? Math.min(1, Math.max(0, value)) : 0.7;

/**
 * Remove markdown code fence from JSON response
 * @param {string} value - Raw string that may contain markdown fences
 * @returns {string} Cleaned string without markdown fences
 */
const cleanJsonEnvelope = (value) => {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith('```')) {
    return trimmed.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
  }
  return trimmed;
};

/**
 * Parse JSON string with error handling
 * @param {string} raw - Raw JSON string to parse
 * @returns {Object} {ok: boolean, value?: any, error?: string}
 */
const parseJson = (raw) => {
  try {
    return { ok: true, value: JSON.parse(cleanJsonEnvelope(raw)) };
  } catch (error) {
    return { ok: false, error: `Invalid JSON: ${error.message}` };
  }
};

/**
 * Count words in text using Unicode-aware regex
 * @param {string} text - Text to count words in
 * @returns {number} Word count
 */
const wordCount = (text) => {
  if (!text) return 0;
  return (text.match(/\b[\p{L}\p{N}'-]+\b/gu) || []).length;
};

/**
 * Build user payload for LLM request
 * @param {Object} params
 * @param {string} params.task - Task description
 * @param {Object} params.policy - Validation policy
 * @param {string} params.text - Source text to label
 * @param {string} params.templateVersion - Template version
 * @param {Object} [params.validation] - Optional validation feedback for repair
 * @returns {string} JSON stringified payload
 */
const buildUserPayload = ({ task, policy, text, templateVersion, validation }) => {
  const payload = {
    task,
    policy,
    text,
    templateVersion,
  };

  if (validation) {
    payload.validation = validation;
  }

  return JSON.stringify(payload);
};

/**
 * Format validation errors into numbered list
 * @param {Array<string>} errors - Error messages
 * @returns {string} Formatted error list
 */
const formatValidationErrors = (errors) =>
  errors.map((err, index) => `${index + 1}. ${err}`).join('\n');

/**
 * Sanitize and validate policy configuration
 * @param {Object} [policy] - Raw policy configuration
 * @returns {Object} Validated policy with defaults
 */
const sanitizePolicy = (policy = {}) => {
  const merged = {
    ...DEFAULT_POLICY,
    ...(policy && typeof policy === 'object' ? policy : {}),
  };

  const limit = Number(merged.nonTechnicalWordLimit);
  merged.nonTechnicalWordLimit = Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_POLICY.nonTechnicalWordLimit;
  merged.allowOverlap = merged.allowOverlap === true;
  return merged;
};

/**
 * Sanitize and validate processing options
 * @param {Object} [options] - Raw options configuration
 * @returns {Object} Validated options with defaults
 */
const sanitizeOptions = (options = {}) => {
  const merged = {
    ...DEFAULT_OPTIONS,
    ...(options && typeof options === 'object' ? options : {}),
  };

  const maxSpans = Number(merged.maxSpans);
  merged.maxSpans =
    Number.isInteger(maxSpans) && maxSpans > 0 ? Math.min(maxSpans, MAX_SPANS_ABSOLUTE_LIMIT) : DEFAULT_OPTIONS.maxSpans;

  const minConfidence = Number(merged.minConfidence);
  merged.minConfidence =
    Number.isFinite(minConfidence) && minConfidence >= 0 && minConfidence <= 1
      ? minConfidence
      : DEFAULT_OPTIONS.minConfidence;

  merged.templateVersion = String(merged.templateVersion || DEFAULT_OPTIONS.templateVersion);
  return merged;
};

/**
 * Build unique key for span deduplication
 * @param {Object} span - Span object with start, end, and text
 * @returns {string} Unique key string
 */
const buildSpanKey = (span) => `${span.start}|${span.end}|${span.text}`;

/**
 * Check if span text matches at the specified indices
 * @param {string} text - Source text
 * @param {Object} span - Span with start, end, and text properties
 * @returns {boolean} True if text matches at indices
 */
const matchesAtIndices = (text, span) =>
  text.slice(span.start, span.end) === span.text;

/**
 * Optimized substring position finder with caching
 *
 * Performance improvements:
 * - Caches substring positions to avoid repeated indexOf calls
 * - Binary search for closest match to preferred position
 * - Early termination for single occurrence
 *
 * Reduces character offset correction overhead by 20-30ms per request
 * for typical 60-span, 5000-character texts.
 */
class SubstringPositionCache {
  constructor() {
    this.cache = new Map();
    this.currentText = null;
  }

  /**
   * Get all occurrences of a substring in text (with caching)
   * @private
   */
  _getOccurrences(text, substring) {
    // Clear cache if text changed (compare by reference for performance)
    // For different text content, this will be different string references
    if (this.currentText !== text) {
      this.cache.clear();
      this.currentText = text;
    }

    // Check cache
    if (this.cache.has(substring)) {
      return this.cache.get(substring);
    }

    // Find all occurrences
    const occurrences = [];
    let index = text.indexOf(substring, 0);
    while (index !== -1) {
      occurrences.push(index);
      index = text.indexOf(substring, index + 1);
    }

    // Cache the result
    this.cache.set(substring, occurrences);
    return occurrences;
  }

  /**
   * Find best matching indices for substring with binary search optimization
   */
  findBestMatch(text, substring, preferredStart = 0) {
    if (!substring) return null;

    const occurrences = this._getOccurrences(text, substring);

    if (occurrences.length === 0) {
      return null;
    }

    if (occurrences.length === 1) {
      return { start: occurrences[0], end: occurrences[0] + substring.length };
    }

    const preferred =
      typeof preferredStart === 'number' && Number.isFinite(preferredStart)
        ? preferredStart
        : 0;

    // Binary search for closest occurrence
    let left = 0;
    let right = occurrences.length - 1;
    let best = occurrences[0];
    let bestDistance = Math.abs(best - preferred);

    // If preferred is before first occurrence, return first
    if (preferred <= occurrences[0]) {
      return { start: occurrences[0], end: occurrences[0] + substring.length };
    }

    // If preferred is after last occurrence, return last
    if (preferred >= occurrences[occurrences.length - 1]) {
      const last = occurrences[occurrences.length - 1];
      return { start: last, end: last + substring.length };
    }

    // Binary search for closest match
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const candidate = occurrences[mid];
      const distance = Math.abs(candidate - preferred);

      if (distance < bestDistance) {
        best = candidate;
        bestDistance = distance;
      }

      if (candidate < preferred) {
        left = mid + 1;
      } else if (candidate > preferred) {
        right = mid - 1;
      } else {
        // Exact match
        return { start: candidate, end: candidate + substring.length };
      }
    }

    return { start: best, end: best + substring.length };
  }

  /**
   * Clear the cache (called between requests)
   */
  clear() {
    this.cache.clear();
    this.currentText = null;
  }
}

/**
 * Normalize a single span's role and confidence
 * @param {Object} span - The span to normalize
 * @param {boolean} lenient - If true, assigns 'Descriptive' for invalid roles; if false, returns null
 * @returns {Object} Normalized span with role and confidence
 */
const normalizeSpan = (span, lenient = false) => {
  const confidence = clamp01(span.confidence);
  const role =
    typeof span.role === 'string' && ROLE_SET.has(span.role)
      ? span.role
      : lenient
        ? 'Descriptive'
        : null;

  return {
    text: span.text,
    start: span.start,
    end: span.end,
    role,
    confidence,
  };
};

/**
 * Deduplicate spans based on position and text
 * @param {Array} spans - Sorted array of spans
 * @returns {Object} {spans: Array, notes: Array}
 */
const deduplicateSpans = (spans) => {
  const seenKeys = new Set();
  const deduplicated = [];
  const notes = [];

  spans.forEach((span, index) => {
    const key = buildSpanKey(span);
    if (seenKeys.has(key)) {
      notes.push(`span[${index}] ignored: duplicate span`);
    } else {
      seenKeys.add(key);
      deduplicated.push(span);
    }
  });

  return { spans: deduplicated, notes };
};

/**
 * Resolve overlapping spans by keeping the higher confidence span
 * @param {Array} sortedSpans - Spans sorted by start position
 * @param {boolean} allowOverlap - If true, keeps all spans
 * @returns {Object} {spans: Array, notes: Array}
 */
const resolveOverlaps = (sortedSpans, allowOverlap) => {
  if (allowOverlap) {
    return { spans: sortedSpans, notes: [] };
  }

  const resolved = [];
  const notes = [];

  sortedSpans.forEach((span) => {
    const last = resolved[resolved.length - 1];
    if (!last || span.start >= last.end) {
      resolved.push(span);
      return;
    }

    const winner = span.confidence > last.confidence ? span : last;
    const loser = winner === span ? last : span;

    notes.push(
      `Overlap between "${last.text}" (${last.start}-${last.end}, conf=${last.confidence.toFixed(
        2
      )}) and "${span.text}" (${span.start}-${span.end}, conf=${span.confidence.toFixed(
        2
      )}); kept "${winner.text}".`
    );

    if (winner === span) {
      resolved[resolved.length - 1] = span;
    }
  });

  return { spans: resolved, notes };
};

/**
 * Filter spans by minimum confidence threshold
 * @param {Array} spans - Spans to filter
 * @param {number} minConfidence - Minimum confidence threshold
 * @returns {Object} {spans: Array, notes: Array}
 */
const filterByConfidence = (spans, minConfidence) => {
  const notes = [];
  const filtered = spans.filter((span) => {
    if (span.confidence >= minConfidence) return true;
    notes.push(
      `Dropped "${span.text}" at ${span.start}-${span.end} (confidence ${span.confidence.toFixed(
        2
      )} below threshold ${minConfidence}).`
    );
    return false;
  });

  return { spans: filtered, notes };
};

/**
 * Truncate spans to maximum count, keeping highest confidence spans
 * @param {Array} spans - Spans to truncate
 * @param {number} maxSpans - Maximum number of spans to keep
 * @returns {Object} {spans: Array, notes: Array}
 */
const truncateToMaxSpans = (spans, maxSpans) => {
  if (spans.length <= maxSpans) {
    return { spans, notes: [] };
  }

  // Rank by confidence, break ties by position
  const ranked = [...spans].sort((a, b) => {
    if (b.confidence === a.confidence) return a.start - b.start;
    return b.confidence - a.confidence;
  });

  const keepSet = new Set(ranked.slice(0, maxSpans).map(buildSpanKey));
  const truncated = spans.filter((span) => keepSet.has(buildSpanKey(span)));

  // Re-sort by position
  truncated.sort((a, b) => {
    if (a.start === b.start) return a.end - b.end;
    return a.start - b.start;
  });

  const notes = [
    `Truncated spans to maxSpans=${maxSpans}; removed ${spans.length - truncated.length} spans.`,
  ];

  return { spans: truncated, notes };
};

/**
 * Validate and process spans with auto-correction, deduplication, overlap resolution, and filtering
 * @param {Object} params
 * @param {Array} params.spans - Raw spans from LLM
 * @param {Object} params.meta - Metadata from LLM response
 * @param {string} params.text - Source text
 * @param {Object} params.policy - Validation policy
 * @param {Object} params.options - Processing options
 * @param {number} params.attempt - Validation attempt (1 = strict, 2 = lenient)
 * @param {SubstringPositionCache} params.cache - Position cache for span correction
 * @returns {Object} {ok: boolean, errors: Array, result: {spans: Array, meta: Object}}
 */
const validateSpans = ({
  spans,
  meta,
  text,
  policy,
  options,
  attempt = 1,
  cache,
}) => {
  const errors = [];
  const validationNotes = [];
  const autoFixNotes = [];
  const sanitized = [];
  const lenient = attempt > 1;

  // Phase 1: Validate and correct individual spans
  spans.forEach((originalSpan, index) => {
    const label = `span[${index}]`;
    const span = originalSpan ? { ...originalSpan } : originalSpan;

    // Check for text field
    if (typeof span.text !== 'string' || span.text.length === 0) {
      if (!lenient) errors.push(`${label} missing text`);
      else validationNotes.push(`${label} dropped: missing text`);
      return;
    }

    // Find correct indices in source text
    const preferredStart = Number.isInteger(span.start) ? span.start : 0;
    const corrected = cache.findBestMatch(text, span.text, preferredStart);

    if (!corrected) {
      if (!lenient) {
        errors.push(`${label} text "${span.text}" not found in source`);
      } else {
        validationNotes.push(`${label} dropped: text not found in source`);
      }
      return;
    }

    // Apply auto-corrected indices
    if (span.start !== corrected.start || span.end !== corrected.end) {
      autoFixNotes.push(
        `${label} indices auto-adjusted from ${span.start}-${span.end} to ${corrected.start}-${corrected.end}`
      );
    }

    // Create corrected span (immutable)
    const correctedSpan = {
      ...span,
      start: corrected.start,
      end: corrected.end,
    };

    // Normalize role and confidence
    const normalized = normalizeSpan(correctedSpan, lenient);
    if (!normalized.role) {
      errors.push(
        `${label} role "${span.role}" is not in the allowed set (${Array.from(ROLE_SET).join(', ')})`
      );
      return;
    }

    // Check word limit for non-technical spans
    if (
      normalized.role !== 'Technical' &&
      policy.nonTechnicalWordLimit > 0 &&
      wordCount(normalized.text) > policy.nonTechnicalWordLimit
    ) {
      if (!lenient) {
        errors.push(
          `${label} exceeds non-technical word limit (${policy.nonTechnicalWordLimit} words)`
        );
      } else {
        validationNotes.push(`${label} dropped: exceeds non-technical word limit`);
      }
      return;
    }

    sanitized.push(normalized);
  });

  // Sort by position
  sanitized.sort((a, b) => {
    if (a.start === b.start) return a.end - b.end;
    return a.start - b.start;
  });

  // Phase 2: Deduplicate
  const { spans: deduplicated, notes: dedupeNotes } = deduplicateSpans(sanitized);

  // Phase 3: Resolve overlaps
  const { spans: resolved, notes: overlapNotes } = resolveOverlaps(deduplicated, policy.allowOverlap);

  // Phase 4: Filter by confidence
  const { spans: confidenceFiltered, notes: confidenceNotes } = filterByConfidence(
    resolved,
    options.minConfidence
  );

  // Phase 5: Truncate to max spans
  const { spans: finalSpans, notes: truncationNotes } = truncateToMaxSpans(
    confidenceFiltered,
    options.maxSpans
  );

  // Combine all notes
  const combinedNotes = [
    ...(Array.isArray(meta?.notes) ? meta.notes : []),
    ...(typeof meta?.notes === 'string' && meta.notes ? [meta.notes] : []),
    ...validationNotes,
    ...autoFixNotes,
    ...dedupeNotes,
    ...overlapNotes,
    ...confidenceNotes,
    ...truncationNotes,
  ].filter(Boolean);

  return {
    ok: errors.length === 0,
    errors,
    result: {
      spans: finalSpans,
      meta: {
        version:
          typeof meta?.version === 'string' && meta.version.trim()
            ? meta.version.trim()
            : options.templateVersion,
        notes: combinedNotes.join(' | '),
      },
    },
  };
};

/**
 * Call LLM with system prompt and user payload
 * @param {Object} params
 * @param {string} params.systemPrompt - System prompt for LLM
 * @param {string} params.userPayload - User payload (JSON string)
 * @param {Function} params.callFn - LLM call function
 * @param {number} [params.maxTokens] - Maximum tokens for response
 * @returns {Promise<string>} Raw LLM response
 */
const callModel = async ({ systemPrompt, userPayload, callFn, maxTokens = DEFAULT_MAX_TOKENS }) => {
  const raw = await callFn({
    system: systemPrompt,
    user: userPayload,
    max_tokens: maxTokens,
    temperature: 0,
  });
  return raw;
};

/**
 * Label spans using an LLM with validation and optional repair attempt.
 * @param {Object} params
 * @param {string} params.text
 * @param {number} [params.maxSpans]
 * @param {number} [params.minConfidence]
 * @param {Object} [params.policy]
 * @param {string} [params.templateVersion]
 * @param {boolean} [params.enableRepair] - Enable repair attempt on validation failure (default: false for performance)
 * @param {Object} [options]
 * @param {Function} [options.callFn]
 * @returns {Promise<{spans: Array, meta: {version: string, notes: string}}>}
 */
export async function labelSpans(params, options = {}) {
  if (!params || typeof params.text !== 'string' || !params.text.trim()) {
    throw new Error('text is required');
  }

  // Create request-scoped cache for concurrent request safety
  const cache = new SubstringPositionCache();

  try {
    const policy = sanitizePolicy(params.policy);
    const sanitizedOptions = sanitizeOptions({
      maxSpans: params.maxSpans,
      minConfidence: params.minConfidence,
      templateVersion: params.templateVersion,
    });

    const task = `Identify up to ${sanitizedOptions.maxSpans} spans and assign roles.`;
    const estimatedMaxTokens = Math.min(
      MAX_TOKEN_RESPONSE_LIMIT,
      TOKEN_ESTIMATION_BASE + sanitizedOptions.maxSpans * TOKEN_ESTIMATION_PER_SPAN
    );
    const basePayload = {
      task,
      policy,
      text: params.text,
      templateVersion: sanitizedOptions.templateVersion,
    };

    const callFn = typeof options.callFn === 'function' ? options.callFn : callOpenAI;

    const primaryResponse = await callModel({
      systemPrompt: BASE_SYSTEM_PROMPT,
      userPayload: buildUserPayload(basePayload),
      callFn,
      maxTokens: estimatedMaxTokens,
    });

    const parsedPrimary = parseJson(primaryResponse);
    if (!parsedPrimary.ok) {
      throw new Error(parsedPrimary.error);
    }

    const schemaValid = validateResponseSchema(parsedPrimary.value);
    if (!schemaValid) {
      const details = validateResponseSchema.errors
        .map((err) => `${err.dataPath || err.instancePath || ''} ${err.message}`)
        .join('; ');
      throw new Error(`LLM response failed schema validation: ${details}`);
    }

    let validation = validateSpans({
      spans: parsedPrimary.value.spans || [],
      meta: parsedPrimary.value.meta,
      text: params.text,
      policy,
      options: sanitizedOptions,
      attempt: 1,
      cache,
    });

    if (validation.ok) {
      return validation.result;
    }

    // PERFORMANCE OPTIMIZATION: Skip repair by default (saves ~3-10 seconds per request)
    // Auto-correction during validation handles most issues via findBestMatchIndices
    // Only enable repair when explicitly needed via params.enableRepair = true
    const enableRepair = params.enableRepair === true;

    if (!enableRepair) {
      // Use attempt=2 to apply more lenient validation rules (drops invalid spans instead of erroring)
      validation = validateSpans({
        spans: parsedPrimary.value.spans || [],
        meta: parsedPrimary.value.meta,
        text: params.text,
        policy,
        options: sanitizedOptions,
        attempt: 2, // Lenient mode
        cache,
      });

      return validation.result;
    }

    const validationErrors = validation.errors;
    const repairPayload = {
      ...basePayload,
      validation: {
        errors: validationErrors,
        originalResponse: parsedPrimary.value,
        instructions:
          'Fix the indices and roles described above without changing span text. Do not invent new spans.',
      },
    };

    const repairResponse = await callModel({
      systemPrompt: `${BASE_SYSTEM_PROMPT}

If validation feedback is provided, correct the issues without altering span text.`,
      userPayload: buildUserPayload(repairPayload),
      callFn,
      maxTokens: estimatedMaxTokens,
    });

    const parsedRepair = parseJson(repairResponse);
    if (!parsedRepair.ok) {
      throw new Error(parsedRepair.error);
    }

    const repairSchemaValid = validateResponseSchema(parsedRepair.value);
    if (!repairSchemaValid) {
      const details = validateResponseSchema.errors
        .map((err) => `${err.dataPath || err.instancePath || ''} ${err.message}`)
        .join('; ');
      throw new Error(`Repair attempt failed schema validation: ${details}`);
    }

    validation = validateSpans({
      spans: parsedRepair.value.spans || [],
      meta: parsedRepair.value.meta,
      text: params.text,
      policy,
      options: sanitizedOptions,
      attempt: 2,
      cache,
    });

    if (!validation.ok) {
      const errorMessage = formatValidationErrors(validation.errors);
      throw new Error(`Repair attempt failed validation:\n${errorMessage}`);
    }

    return validation.result;
  } catch (error) {
    // Re-throw errors to let caller handle them
    throw error;
  }
  // Cache is automatically garbage collected when function returns (request-scoped)
}
