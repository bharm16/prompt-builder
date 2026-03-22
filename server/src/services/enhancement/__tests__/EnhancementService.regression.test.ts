import { describe, expect, it } from 'vitest';
import { SpanContextBuilder } from '../services/SpanContextBuilder';

describe('EnhancementService regression', () => {
  const builder = new SpanContextBuilder();

  it('splits prompt into clause boundaries for ownership-aware anchor selection', () => {
    const fullPrompt =
      'A baby sits in a car seat while trees sway gently in the wind and sunlight flickers.';

    const clauses = builder._findClauseBoundaries(fullPrompt);

    expect(clauses.length).toBeGreaterThanOrEqual(2);
    const firstClause = fullPrompt.slice(clauses[0]!.start, clauses[0]!.end + 1).toLowerCase();
    const secondClause = fullPrompt
      .slice(clauses[1]!.start, clauses[1]!.end + 1)
      .toLowerCase();

    expect(firstClause).toContain('baby');
    expect(secondClause).toContain('trees');
  });

  it('prefers same-clause anchors over higher-confidence anchors from other clauses', () => {
    const fullPrompt =
      'A baby sits in a car seat while trees sway gently in the wind and sunlight flickers.';
    const babyStart = fullPrompt.indexOf('baby');
    const treesStart = fullPrompt.indexOf('trees');
    const swayStart = fullPrompt.indexOf('sway gently');

    const context = builder.buildSpanContext({
      fullPrompt,
      highlightedText: 'sway gently',
      highlightedCategory: 'action.motion',
      phraseRole: 'action.motion',
      nearbySpans: [],
      allLabeledSpans: [
        {
          text: 'baby',
          role: 'subject',
          category: 'subject.identity',
          confidence: 0.99,
          start: babyStart,
          end: babyStart + 'baby'.length,
        },
        {
          text: 'trees',
          role: 'subject',
          category: 'subject.identity',
          confidence: 0.81,
          start: treesStart,
          end: treesStart + 'trees'.length,
        },
        {
          text: 'sway gently',
          role: 'action',
          category: 'action.motion',
          confidence: 0.92,
          start: swayStart,
          end: swayStart + 'sway gently'.length,
        },
      ],
    });

    expect(context.spanAnchors).toContain('subject: "trees"');
    expect(context.spanAnchors).not.toContain('subject: "baby"');
  });
});
