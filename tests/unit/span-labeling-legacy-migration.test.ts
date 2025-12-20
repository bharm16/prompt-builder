import { describe, expect, it } from 'vitest';
import { createHash } from 'crypto';

import { SubstringPositionCache } from '@llm/span-labeling/cache/SubstringPositionCache.js';
import { mergeAdjacentSpans } from '@llm/span-labeling/processing/AdjacentSpanMerger.js';
import { filterByConfidence } from '@llm/span-labeling/processing/ConfidenceFilter.js';
import { resolveOverlaps } from '@llm/span-labeling/processing/OverlapResolver.js';
import { deduplicateSpans } from '@llm/span-labeling/processing/SpanDeduplicator.js';
import { normalizeSpan } from '@llm/span-labeling/processing/SpanNormalizer.js';
import { truncateToMaxSpans } from '@llm/span-labeling/processing/SpanTruncator.js';
import { TextChunker, countWords as chunkWordCount } from '@llm/span-labeling/utils/chunkingUtils.js';
import { cleanJsonEnvelope, parseJson, buildUserPayload } from '@llm/span-labeling/utils/jsonUtils.js';
import { sanitizePolicy, sanitizeOptions, buildTaskDescription } from '@llm/span-labeling/utils/policyUtils.js';
import {
  clamp01,
  wordCount,
  matchesAtIndices,
  buildSpanKey,
  formatValidationErrors,
} from '@llm/span-labeling/utils/textUtils.js';
import {
  validateSchema,
  formatSchemaErrors,
  validateSchemaOrThrow,
} from '@llm/span-labeling/validation/SchemaValidator.js';
import { validateSpans } from '@llm/span-labeling/validation/SpanValidator.js';
import { RelaxedF1Evaluator } from '@llm/span-labeling/evaluation/RelaxedF1Evaluator.js';
import {
  DEFAULT_CONFIDENCE,
  DEFAULT_OPTIONS,
  DEFAULT_POLICY,
  PERFORMANCE,
} from '@llm/span-labeling/config/SpanLabelingConfig.js';
import { TAXONOMY } from '@shared/taxonomy.js';

describe('SubstringPositionCache', () => {
  it('returns exact match and updates telemetry', () => {
    const cache = new SubstringPositionCache();
    const text = 'Hello world hello';

    const result = cache.findBestMatch(text, 'world');

    expect(result).toEqual({ start: 6, end: 11 });
    const telemetry = cache.getTelemetry();
    expect(telemetry.totalRequests).toBe(1);
    expect(telemetry.exactMatches).toBe(1);
  });

  it('selects the closest occurrence to preferredStart', () => {
    const cache = new SubstringPositionCache();
    const text = 'a b a b a';

    const result = cache.findBestMatch(text, 'a', 7);

    expect(result).toEqual({ start: 8, end: 9 });
  });

  it('falls back to case-insensitive matching', () => {
    const cache = new SubstringPositionCache();
    const text = 'Hello World';

    const result = cache.findBestMatch(text, 'world');

    expect(result).toEqual({ start: 6, end: 11 });
    expect(cache.getTelemetry().caseInsensitiveMatches).toBe(1);
  });

  it('uses fuzzy matching when exact and case-insensitive fail', () => {
    const cache = new SubstringPositionCache();
    const text = 'color palette';

    const result = cache.findBestMatch(text, 'color pallete');

    expect(result).toEqual({ start: 0, end: text.length });
    expect(cache.getTelemetry().fuzzyMatches).toBe(1);
  });
});

describe('AdjacentSpanMerger', () => {
  it('merges adjacent spans with compatible parent roles', () => {
    const text = 'Action Shot';
    const spans = [
      {
        text: 'Action',
        start: 0,
        end: 6,
        role: 'shot.type',
        confidence: 0.9,
      },
      {
        text: 'Shot',
        start: 7,
        end: 11,
        role: 'shot',
        confidence: 0.8,
      },
    ];

    const result = mergeAdjacentSpans(spans, text);

    expect(result.spans).toHaveLength(1);
    const mergedSpan = result.spans[0];
    const mergeNote = result.notes[0];
    expect(mergedSpan).toBeDefined();
    expect(mergeNote).toBeDefined();
    if (!mergedSpan || !mergeNote) {
      throw new Error('Expected merged span and note');
    }
    expect(mergedSpan.text).toBe('Action Shot');
    expect(mergedSpan.role).toBe('shot.type');
    expect(mergedSpan.confidence).toBeCloseTo(0.85);
    expect(mergeNote).toContain('Merged 2 adjacent shot spans');
  });
});

describe('ConfidenceFilter', () => {
  it('filters spans below the minimum confidence', () => {
    const spans = [
      { text: 'A', start: 0, end: 1, confidence: 0.9 },
      { text: 'B', start: 2, end: 3, confidence: 0.4 },
    ];

    const result = filterByConfidence(spans, 0.5);

    expect(result.spans).toHaveLength(1);
    const remaining = result.spans[0];
    const dropNote = result.notes[0];
    expect(remaining).toBeDefined();
    expect(dropNote).toBeDefined();
    if (!remaining || !dropNote) {
      throw new Error('Expected remaining span and note');
    }
    expect(remaining.text).toBe('A');
    expect(dropNote).toContain('Dropped "B"');
  });
});

describe('OverlapResolver', () => {
  it('keeps the higher-confidence span when overlaps occur', () => {
    const spans = [
      { text: 'AA', start: 0, end: 2, confidence: 0.4 },
      { text: 'BB', start: 1, end: 3, confidence: 0.9 },
      { text: 'CC', start: 3, end: 4, confidence: 0.3 },
    ];

    const result = resolveOverlaps(spans, false);

    expect(result.spans).toHaveLength(2);
    const firstSpan = result.spans[0];
    const overlapNote = result.notes[0];
    expect(firstSpan).toBeDefined();
    expect(overlapNote).toBeDefined();
    if (!firstSpan || !overlapNote) {
      throw new Error('Expected overlap span and note');
    }
    expect(firstSpan.text).toBe('BB');
    expect(overlapNote).toContain('Overlap between "AA"');
  });
});

describe('SpanDeduplicator', () => {
  it('removes duplicate spans by position and text', () => {
    const spans = [
      { text: 'A', start: 0, end: 1 },
      { text: 'A', start: 0, end: 1 },
      { text: 'B', start: 2, end: 3 },
    ];

    const result = deduplicateSpans(spans);

    expect(result.spans).toHaveLength(2);
    const dedupeNote = result.notes[0];
    expect(dedupeNote).toBeDefined();
    if (!dedupeNote) {
      throw new Error('Expected dedupe note');
    }
    expect(dedupeNote).toBe('span[1] ignored: duplicate span');
  });
});

describe('SpanNormalizer', () => {
  it('clamps confidence, validates roles, and generates stable IDs', () => {
    const sourceText = 'Red car';
    const span = {
      text: 'Red',
      start: 0,
      end: 3,
      role: TAXONOMY.SUBJECT.id,
      confidence: 1.2,
    };

    const normalized = normalizeSpan(span, sourceText, false);

    const textHash = createHash('sha256')
      .update(sourceText)
      .digest('hex')
      .substring(0, 8);

    expect(normalized?.confidence).toBe(1);
    expect(normalized?.role).toBe(TAXONOMY.SUBJECT.id);
    expect(normalized?.id).toBe(`${textHash}-0-3-${TAXONOMY.SUBJECT.id}`);
  });

  it('drops invalid roles in strict mode and defaults in lenient mode', () => {
    const sourceText = 'Red car';
    const span = {
      text: 'Red',
      start: 0,
      end: 3,
      role: 'not-a-role',
      confidence: 0.4,
    };

    expect(normalizeSpan(span, sourceText, false)).toBeNull();
    expect(normalizeSpan(span, sourceText, true)?.role).toBe(TAXONOMY.SUBJECT.id);
  });
});

describe('SpanTruncator', () => {
  it('keeps the highest-confidence spans and preserves order', () => {
    const spans = [
      { text: 'A', start: 0, end: 1, confidence: 0.9 },
      { text: 'B', start: 2, end: 3, confidence: 0.8 },
      { text: 'C', start: 4, end: 5, confidence: 0.95 },
    ];

    const result = truncateToMaxSpans(spans, 2);

    expect(result.spans.map((span) => span.text)).toEqual(['A', 'C']);
    const truncateNote = result.notes[0];
    expect(truncateNote).toBeDefined();
    if (!truncateNote) {
      throw new Error('Expected truncation note');
    }
    expect(truncateNote).toContain('Truncated spans to maxSpans=2');
  });
});

describe('chunkingUtils', () => {
  it('splits sentences and chunks on word limits', () => {
    const chunker = new TextChunker(3);
    const text = 'Hello world. Second sentence.';

    const sentences = chunker.splitIntoSentences(text);
    expect(sentences).toEqual([
      { text: 'Hello world.', startOffset: 0, endOffset: 12 },
      { text: 'Second sentence.', startOffset: 12, endOffset: 29 },
    ]);

    const chunks = chunker.chunkText(text);
    expect(chunks).toHaveLength(2);
    const firstChunk = chunks[0];
    const secondChunk = chunks[1];
    expect(firstChunk).toBeDefined();
    expect(secondChunk).toBeDefined();
    if (!firstChunk || !secondChunk) {
      throw new Error('Expected two chunks');
    }
    expect(firstChunk.text).toBe('Hello world.');
    expect(secondChunk.text).toBe('Second sentence.');
  });

  it('merges chunked spans and deduplicates by position and role', () => {
    const chunker = new TextChunker(3);

    const merged = chunker.mergeChunkedSpans([
      {
        chunkOffset: 0,
        spans: [{ text: 'Hel', start: 0, end: 3, role: 'subject' }],
      },
      {
        chunkOffset: 0,
        spans: [{ text: 'Hel', start: 0, end: 3, role: 'subject' }],
      },
      {
        chunkOffset: 5,
        spans: [{ text: 'lo', start: 0, end: 2, category: 'subject' }],
      },
    ]);

    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({ start: 0, end: 3 });
    expect(merged[1]).toMatchObject({ start: 5, end: 7 });
  });

  it('counts words and checks chunking thresholds', () => {
    const chunker = new TextChunker(3);

    expect(chunkWordCount('one two three')).toBe(3);
    expect(chunker.needsChunking('one two three four')).toBe(true);
  });
});

describe('jsonUtils', () => {
  it('cleans JSON code fences and parses JSON safely', () => {
    const raw = '```json\n{"a": 1}\n```';

    expect(cleanJsonEnvelope(raw)).toBe('{"a": 1}');
    expect(parseJson(raw)).toEqual({ ok: true, value: { a: 1 } });
    expect(parseJson('{not-json}').ok).toBe(false);
  });

  it('builds a user payload with XML-wrapped input', () => {
    const payload = buildUserPayload({
      task: 'label',
      policy: { allowOverlap: false },
      text: 'hello',
      templateVersion: 'v2',
      validation: { errors: ['x'] },
    });

    const parsed = JSON.parse(payload) as { text: string; validation: { errors: string[] } };

    expect(parsed.text).toBe('<user_input>\nhello\n</user_input>');
    expect(parsed.validation.errors).toEqual(['x']);
  });
});

describe('policyUtils', () => {
  it('sanitizes policies and options with defaults and constraints', () => {
    const policy = sanitizePolicy({ nonTechnicalWordLimit: -1, allowOverlap: 'yes' as unknown as boolean });
    const options = sanitizeOptions({
      maxSpans: PERFORMANCE.MAX_SPANS_ABSOLUTE_LIMIT + 10,
      minConfidence: 2,
      templateVersion: '',
    });

    expect(policy.nonTechnicalWordLimit).toBe(DEFAULT_POLICY.nonTechnicalWordLimit);
    expect(policy.allowOverlap).toBe(false);
    expect(options.maxSpans).toBe(PERFORMANCE.MAX_SPANS_ABSOLUTE_LIMIT);
    expect(options.minConfidence).toBe(DEFAULT_OPTIONS.minConfidence);
    expect(options.templateVersion).toBe(DEFAULT_OPTIONS.templateVersion);
  });

  it('builds a task description from policy settings', () => {
    const description = buildTaskDescription(5, {
      allowOverlap: false,
      nonTechnicalWordLimit: 6,
    });

    expect(description).toContain('Identify up to 5 spans');
    expect(description).toContain('Do not return overlapping spans.');
    expect(description).toContain('Non-technical spans must be 6 words or fewer.');
  });
});

describe('textUtils', () => {
  it('clamps values and counts words', () => {
    expect(clamp01(2)).toBe(1);
    expect(clamp01(-1)).toBe(0);
    expect(clamp01('x' as unknown as number)).toBe(DEFAULT_CONFIDENCE);
    expect(wordCount('one two three')).toBe(3);
  });

  it('matches spans and formats errors', () => {
    const text = 'hello';
    const span = { start: 1, end: 3, text: 'el' };

    expect(matchesAtIndices(text, span)).toBe(true);
    expect(buildSpanKey({ start: 1, end: 3, text: 'el' })).toBe('1|3|el');
    expect(formatValidationErrors(['a', 'b'])).toBe('1. a\n2. b');
  });
});

describe('SchemaValidator', () => {
  it('validates schema compliance and formats errors', () => {
    const valid = {
      analysis_trace: 'ok',
      spans: [{ text: 'hero', role: TAXONOMY.SUBJECT.id }],
      meta: { version: 'v2', notes: 'ok' },
    };

    const invalid = { spans: [], meta: { version: 'v2', notes: 'ok' } };

    expect(validateSchema(valid)).toBe(true);
    expect(validateSchema(invalid)).toBe(false);
    expect(formatSchemaErrors()).toContain('analysis_trace');
    expect(() => validateSchemaOrThrow(invalid)).toThrow('Schema validation failed');
  });
});

describe('SpanValidator', () => {
  it('runs the validation pipeline and merges adjacent spans', () => {
    const cache = new SubstringPositionCache();
    const text = 'Red car';
    const spans = [
      {
        text: 'Red',
        start: 0,
        end: 3,
        role: 'subject.appearance',
        confidence: 0.9,
      },
      {
        text: 'car',
        start: 4,
        end: 7,
        role: 'subject',
        confidence: 0.8,
      },
    ];

    const result = validateSpans({
      spans,
      text,
      policy: DEFAULT_POLICY,
      options: DEFAULT_OPTIONS,
      cache,
    });

    expect(result.ok).toBe(true);
    expect(result.result.spans).toHaveLength(1);
    const mergedSpan = result.result.spans[0];
    expect(mergedSpan).toBeDefined();
    if (!mergedSpan) {
      throw new Error('Expected merged span');
    }
    expect(mergedSpan.text).toBe('Red car');
    expect(result.result.meta.version).toBe(DEFAULT_OPTIONS.templateVersion);
    expect(result.result.meta.notes).toContain('Merged 2 adjacent subject spans');
    expect(result.result.analysisTrace).toBeNull();
  });
});

describe('RelaxedF1Evaluator', () => {
  it('calculates IoU, F1, and fragmentation metrics', () => {
    const evaluator = new RelaxedF1Evaluator();

    const iou = evaluator.calculateIoU(
      { start: 0, end: 4, role: 'subject', text: 'hero' },
      { start: 2, end: 6, role: 'subject', text: 'hero' }
    );

    expect(iou).toBeCloseTo(2 / 6);

    const f1 = evaluator.evaluateSpans(
      [{ start: 0, end: 4, role: 'subject', text: 'hero' }],
      [{ start: 1, end: 5, role: 'subject', text: 'hero' }]
    );

    expect(f1.f1).toBe(1);

    const fragmentation = evaluator.calculateFragmentationRate(
      [
        { start: 0, end: 2, role: 'subject.identity', text: 'hero' },
        { start: 2, end: 4, role: 'subject.appearance', text: 'red' },
      ],
      [{ start: 0, end: 4, role: 'subject', text: 'hero red' }]
    );

    expect(fragmentation.rate).toBe(1);
  });

  it('updates confusion matrices for matched spans', () => {
    const evaluator = new RelaxedF1Evaluator();

    const matrix = evaluator.updateConfusionMatrix(
      {},
      [{ start: 0, end: 4, role: 'subject', text: 'hero' }],
      [{ start: 0, end: 4, role: 'subject', text: 'hero' }]
    );

    expect(matrix.subject).toBeDefined();
    if (!matrix.subject) {
      throw new Error('Expected subject matrix');
    }
    expect(matrix.subject.subject).toBe(1);
  });
});
