import { describe, expect, it, vi } from 'vitest';
import * as fc from 'fast-check';

import { VALID_CATEGORIES } from '#shared/taxonomy';
import { validateSpans } from '@llm/span-labeling/validation/SpanValidator.js';
import { SubstringPositionCache } from '@llm/span-labeling/cache/SubstringPositionCache.js';
import type { ProcessingOptions, ValidationPolicy } from '@llm/span-labeling/types';

vi.mock('@infrastructure/Logger', () => ({
  logger: {
    child: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

const policy: ValidationPolicy = {
  nonTechnicalWordLimit: 15,
  allowOverlap: false,
};

const options: ProcessingOptions = {
  maxSpans: 60,
  minConfidence: 0,
  templateVersion: 'v2.2',
};

const makeInputText = (raw: string): string => {
  const normalized = raw.replace(/\s+/g, ' ').trim();
  return normalized.length > 0
    ? normalized
    : 'A camera pans as the subject walks through a forest path at dawn.';
};

const calculateCoverageLength = (spans: Array<{ start?: number; end?: number }>): number => {
  const intervals = spans
    .filter(
      (span): span is { start: number; end: number } =>
        typeof span.start === 'number' && typeof span.end === 'number' && span.end > span.start
    )
    .sort((a, b) => (a.start === b.start ? a.end - b.end : a.start - b.start));

  let covered = 0;
  let currentStart = -1;
  let currentEnd = -1;

  for (const span of intervals) {
    if (currentStart === -1) {
      currentStart = span.start;
      currentEnd = span.end;
      continue;
    }
    if (span.start > currentEnd) {
      covered += currentEnd - currentStart;
      currentStart = span.start;
      currentEnd = span.end;
      continue;
    }
    currentEnd = Math.max(currentEnd, span.end);
  }

  if (currentStart !== -1) {
    covered += currentEnd - currentStart;
  }

  return covered;
};

describe('span labeling invariants (property-based)', () => {
  it('enforces taxonomy validity and bounded covered length', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 30, maxLength: 220 }),
        fc.array(
          fc.record({
            start: fc.integer({ min: -30, max: 260 }),
            width: fc.integer({ min: 1, max: 45 }),
            role: fc.oneof(
              fc.constant('subject.identity'),
              fc.constant('camera.movement'),
              fc.constant('technical.frameRate'),
              fc.constant('not.valid.role'),
              fc.string({ minLength: 0, maxLength: 18 })
            ),
            confidence: fc.option(fc.double({ min: -1, max: 2, noNaN: true, noDefaultInfinity: true })),
          }),
          { minLength: 0, maxLength: 24 }
        ),
        (rawText, rawCandidates) => {
          const text = makeInputText(rawText);
          const spans = rawCandidates.map((candidate) => {
            const maxStart = Math.max(0, text.length - 1);
            const normalizedStart = Math.max(0, Math.min(maxStart, candidate.start));
            const normalizedEnd = Math.max(
              normalizedStart + 1,
              Math.min(text.length, normalizedStart + candidate.width)
            );
            const slice = text.slice(normalizedStart, normalizedEnd);

            return {
              text: slice,
              role: candidate.role,
              start: candidate.start,
              end: candidate.start + candidate.width,
              confidence: candidate.confidence ?? undefined,
            };
          });

          const result = validateSpans({
            spans,
            text,
            policy,
            options,
            attempt: 2,
            cache: new SubstringPositionCache(),
            isAdversarial: false,
          });

          const output = result.result.spans;

          for (const span of output) {
            const start = span.start;
            const end = span.end;
            expect(VALID_CATEGORIES.has(span.role)).toBe(true);
            expect(typeof start).toBe('number');
            expect(typeof end).toBe('number');
            if (typeof start !== 'number' || typeof end !== 'number') continue;
            expect(start).toBeGreaterThanOrEqual(0);
            expect(end).toBeLessThanOrEqual(text.length);
            expect(end).toBeGreaterThan(start);
          }

          expect(calculateCoverageLength(output)).toBeLessThanOrEqual(text.length);
        }
      ),
      {
        seed: 20260211,
        numRuns: 80,
      }
    );
  });

  it('enforces non-overlap when all candidates share the same taxonomy parent', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 30, maxLength: 220 }),
        fc.array(
          fc.record({
            start: fc.integer({ min: -30, max: 260 }),
            width: fc.integer({ min: 1, max: 45 }),
            role: fc.constantFrom('camera.movement', 'camera.focus'),
            confidence: fc.option(fc.double({ min: -1, max: 2, noNaN: true, noDefaultInfinity: true })),
          }),
          { minLength: 0, maxLength: 24 }
        ),
        (rawText, rawCandidates) => {
          const text = makeInputText(rawText);
          const spans = rawCandidates.map((candidate) => {
            const maxStart = Math.max(0, text.length - 1);
            const normalizedStart = Math.max(0, Math.min(maxStart, candidate.start));
            const normalizedEnd = Math.max(
              normalizedStart + 1,
              Math.min(text.length, normalizedStart + candidate.width)
            );

            return {
              text: text.slice(normalizedStart, normalizedEnd),
              role: candidate.role,
              start: candidate.start,
              end: candidate.start + candidate.width,
              confidence: candidate.confidence ?? undefined,
            };
          });

          const result = validateSpans({
            spans,
            text,
            policy,
            options,
            attempt: 2,
            cache: new SubstringPositionCache(),
            isAdversarial: false,
          });

          const output = [...result.result.spans].sort((a, b) =>
            (a.start ?? 0) === (b.start ?? 0)
              ? (a.end ?? 0) - (b.end ?? 0)
              : (a.start ?? 0) - (b.start ?? 0)
          );

          for (let i = 1; i < output.length; i += 1) {
            const prev = output[i - 1];
            const next = output[i];
            if (
              typeof prev?.start === 'number' &&
              typeof prev.end === 'number' &&
              typeof next?.start === 'number' &&
              typeof next.end === 'number'
            ) {
              expect(prev.end <= next.start).toBe(true);
            }
          }
        }
      ),
      {
        seed: 20260211,
        numRuns: 80,
      }
    );
  });
});
