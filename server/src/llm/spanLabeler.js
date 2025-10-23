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

const BASE_SYSTEM_PROMPT = `You label short prompt spans for a video prompt editor.

Roles: Wardrobe, Appearance, Lighting, TimeOfDay, CameraMove, Framing, Environment, Color, Technical, Descriptive.

Rules:
- Propose and label salient spans directly from the provided text.
- Use exact substrings; do not invent or paraphrase.
- Return start/end as approximate 0-based character offsets (they will be auto-corrected to match the exact text).
- Focus on providing the exact text and correct role; indices will be recalculated server-side.
- Do not overlap spans unless explicitly allowed.
- Non-Technical spans must be ≤ 6 words (unless a different limit is provided in policy).
- Use "Descriptive" if unsure.
- Prefer fewer, more meaningful spans over many trivial ones.
- Confidence must be in the range [0, 1] (use 0.7 when unsure).
- Output ONLY valid JSON matching:
  {"spans":[{"text":string,"start":number,"end":number,"role":string,"confidence":number}], "meta":{"version":string,"notes":string}}
- The response must start with "{" and be valid JSON (no markdown fences).`;

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
  maxSpans: 20,
  minConfidence: 0.5,
  templateVersion: 'v1',
};

const clamp01 = (value) =>
  typeof value === 'number' ? Math.min(1, Math.max(0, value)) : 0.7;

const cleanJsonEnvelope = (value) => {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith('```')) {
    return trimmed.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
  }
  return trimmed;
};

const parseJson = (raw) => {
  try {
    return { ok: true, value: JSON.parse(cleanJsonEnvelope(raw)) };
  } catch (error) {
    return { ok: false, error: `Invalid JSON: ${error.message}` };
  }
};

const wordCount = (text) => {
  if (!text) return 0;
  return (text.match(/\b[\p{L}\p{N}'-]+\b/gu) || []).length;
};

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

const formatValidationErrors = (errors) =>
  errors.map((err, index) => `${index + 1}. ${err}`).join('\n');

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

const sanitizeOptions = (options = {}) => {
  const merged = {
    ...DEFAULT_OPTIONS,
    ...(options && typeof options === 'object' ? options : {}),
  };

  const maxSpans = Number(merged.maxSpans);
  merged.maxSpans =
    Number.isInteger(maxSpans) && maxSpans > 0 ? Math.min(maxSpans, 50) : DEFAULT_OPTIONS.maxSpans;

  const minConfidence = Number(merged.minConfidence);
  merged.minConfidence =
    Number.isFinite(minConfidence) && minConfidence >= 0 && minConfidence <= 1
      ? minConfidence
      : DEFAULT_OPTIONS.minConfidence;

  merged.templateVersion = String(merged.templateVersion || DEFAULT_OPTIONS.templateVersion);
  return merged;
};

const buildSpanKey = (span) => `${span.start}|${span.end}|${span.text}`;
const matchesAtIndices = (text, span) =>
  text.slice(span.start, span.end) === span.text;

const findBestMatchIndices = (text, substring, preferredStart = 0) => {
  if (!substring) return null;

  const occurrences = [];
  let index = text.indexOf(substring, 0);
  while (index !== -1) {
    occurrences.push(index);
    index = text.indexOf(substring, index + 1);
  }

  if (!occurrences.length) {
    return null;
  }

  if (occurrences.length === 1) {
    return { start: occurrences[0], end: occurrences[0] + substring.length };
  }

  const preferred =
    typeof preferredStart === 'number' && Number.isFinite(preferredStart)
      ? preferredStart
      : 0;

  let best = occurrences[0];
  let bestDistance = Math.abs(best - preferred);

  for (let i = 1; i < occurrences.length; i += 1) {
    const candidate = occurrences[i];
    const distance = Math.abs(candidate - preferred);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }

  return { start: best, end: best + substring.length };
};

const normalizeSpan = (span, attempt) => {
  const confidence = clamp01(span.confidence);
  const role =
    typeof span.role === 'string' && ROLE_SET.has(span.role)
      ? span.role
      : attempt > 1
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

const validateSpans = ({
  spans,
  meta,
  text,
  policy,
  options,
  attempt = 1,
}) => {
  const errors = [];
  const notes = [];
  const autoFixNotes = [];
  const seenKeys = new Set();
  const sanitized = [];

  spans.forEach((originalSpan, index) => {
    const label = `span[${index}]`;
    const span = originalSpan ? { ...originalSpan } : originalSpan;

    if (typeof span.text !== 'string' || span.text.length === 0) {
      if (attempt === 1) errors.push(`${label} missing text`);
      else notes.push(`${label} dropped: missing text`);
      return;
    }

    // Always locate the text in the source, regardless of LLM-provided indices
    const preferredStart = Number.isInteger(span.start) ? span.start : 0;
    const corrected = findBestMatchIndices(text, span.text, preferredStart);

    if (!corrected) {
      // Text doesn't exist in the source at all
      if (attempt === 1) {
        errors.push(`${label} text "${span.text}" not found in source`);
      } else {
        notes.push(`${label} dropped: text not found in source`);
      }
      return;
    }

    // Use the corrected indices we found
    if (span.start !== corrected.start || span.end !== corrected.end) {
      autoFixNotes.push(
        `${label} indices auto-adjusted from ${span.start}-${span.end} to ${corrected.start}-${corrected.end}`
      );
      span.start = corrected.start;
      span.end = corrected.end;
    }

    const normalized = normalizeSpan(span, attempt);
    if (!normalized.role) {
      errors.push(
        `${label} role "${span.role}" is not in the allowed set (${Array.from(ROLE_SET).join(', ')})`
      );
      return;
    }

    if (
      normalized.role !== 'Technical' &&
      policy.nonTechnicalWordLimit > 0 &&
      wordCount(normalized.text) > policy.nonTechnicalWordLimit
    ) {
      if (attempt === 1) {
        errors.push(
          `${label} exceeds non-technical word limit (${policy.nonTechnicalWordLimit} words)`
        );
      } else {
        notes.push(`${label} dropped: exceeds non-technical word limit`);
      }
      return;
    }

    const key = buildSpanKey(normalized);
    if (seenKeys.has(key)) {
      notes.push(`${label} ignored: duplicate span`);
      return;
    }

    seenKeys.add(key);
    sanitized.push(normalized);
  });

  sanitized.sort((a, b) => {
    if (a.start === b.start) return a.end - b.end;
    return a.start - b.start;
  });

  const resolved = [];
  const overlapNotes = [];

  sanitized.forEach((span) => {
    if (policy.allowOverlap) {
      resolved.push(span);
      return;
    }

    const last = resolved[resolved.length - 1];
    if (!last || span.start >= last.end) {
      resolved.push(span);
      return;
    }

    const winner = span.confidence > last.confidence ? span : last;
    const loser = winner === span ? last : span;

    overlapNotes.push(
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

  const minConfidenceNotes = [];
  const confidenceFiltered = resolved.filter((span) => {
    if (span.confidence >= options.minConfidence) return true;
    minConfidenceNotes.push(
      `Dropped "${span.text}" at ${span.start}-${span.end} (confidence ${span.confidence.toFixed(
        2
      )} below threshold ${options.minConfidence}).`
    );
    return false;
  });

  let finalSpans = confidenceFiltered;
  const truncationNotes = [];
  if (confidenceFiltered.length > options.maxSpans) {
    const ranked = [...confidenceFiltered].sort((a, b) => {
      if (b.confidence === a.confidence) return a.start - b.start;
      return b.confidence - a.confidence;
    });
    const keepSet = new Set(ranked.slice(0, options.maxSpans).map(buildSpanKey));
    finalSpans = confidenceFiltered.filter((span) => keepSet.has(buildSpanKey(span)));
    finalSpans.sort((a, b) => {
      if (a.start === b.start) return a.end - b.end;
      return a.start - b.start;
    });
    truncationNotes.push(
      `Truncated spans to maxSpans=${options.maxSpans}; removed ${confidenceFiltered.length - finalSpans.length} spans.`
    );
  }

  const combinedNotes = [
    ...(Array.isArray(meta?.notes) ? meta.notes : []),
    ...(typeof meta?.notes === 'string' && meta.notes ? [meta.notes] : []),
    ...notes,
    ...autoFixNotes,
    ...overlapNotes,
    ...minConfidenceNotes,
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

const callModel = async ({ systemPrompt, userPayload, callFn }) => {
  const raw = await callFn({
    system: systemPrompt,
    user: userPayload,
    max_tokens: 800,
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
 * @param {Object} [options]
 * @param {Function} [options.callFn]
 * @returns {Promise<{spans: Array, meta: {version: string, notes: string}}>}
 */
export async function labelSpans(params, options = {}) {
  if (!params || typeof params.text !== 'string' || !params.text.trim()) {
    throw new Error('text is required');
  }

  const policy = sanitizePolicy(params.policy);
  const sanitizedOptions = sanitizeOptions({
    maxSpans: params.maxSpans,
    minConfidence: params.minConfidence,
    templateVersion: params.templateVersion,
  });

  const task = `Identify up to ${sanitizedOptions.maxSpans} spans and assign roles.`;
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
  });

  if (validation.ok) {
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
  });

  if (!validation.ok) {
    const errorMessage = formatValidationErrors(validation.errors);
    throw new Error(`Repair attempt failed validation:\n${errorMessage}`);
  }

  return validation.result;
}
