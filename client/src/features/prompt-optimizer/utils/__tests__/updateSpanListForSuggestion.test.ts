import { describe, it, expect } from 'vitest';
import { updateSpanListForSuggestion } from '../updateSpanListForSuggestion';

type TestSpan = {
  id?: string;
  start: number;
  end: number;
  text?: string;
  quote?: string;
  displayQuote?: string;
  displayStart?: number;
  displayEnd?: number;
  category?: string;
  startGrapheme?: number;
  endGrapheme?: number;
  [key: string]: unknown;
};

const makeSpan = (
  start: number,
  end: number,
  id?: string,
  category?: string,
  text?: string
): TestSpan => ({
  id,
  start,
  end,
  text: text ?? `span-${start}-${end}`,
  quote: text ?? `span-${start}-${end}`,
  displayStart: start,
  displayEnd: end,
  category,
});

describe('updateSpanListForSuggestion', () => {
  describe('edge cases — early returns', () => {
    it('returns empty array unchanged', () => {
      const result = updateSpanListForSuggestion({
        spans: [],
        matchStart: 0,
        matchEnd: 5,
        replacementText: 'new',
      });
      expect(result).toEqual([]);
    });

    it('returns spans unchanged when matchStart is null', () => {
      const spans = [makeSpan(0, 5, 'a')];
      const result = updateSpanListForSuggestion({
        spans: spans as never,
        matchStart: null,
        matchEnd: 5,
        replacementText: 'new',
      });
      expect(result).toBe(spans);
    });

    it('returns spans unchanged when matchEnd is null', () => {
      const spans = [makeSpan(0, 5, 'a')];
      const result = updateSpanListForSuggestion({
        spans: spans as never,
        matchStart: 0,
        matchEnd: null,
        replacementText: 'new',
      });
      expect(result).toBe(spans);
    });

    it('returns spans unchanged when matchEnd < matchStart', () => {
      const spans = [makeSpan(0, 5, 'a')];
      const result = updateSpanListForSuggestion({
        spans: spans as never,
        matchStart: 10,
        matchEnd: 5,
        replacementText: 'new',
      });
      expect(result).toBe(spans);
    });

    it('returns spans unchanged when matchStart is undefined', () => {
      const spans = [makeSpan(0, 5, 'a')];
      const result = updateSpanListForSuggestion({
        spans: spans as never,
        matchStart: undefined,
        matchEnd: 5,
        replacementText: 'new',
      });
      expect(result).toBe(spans);
    });

    it('returns spans unchanged when no target found', () => {
      // Span is at 100-200, match is at 0-5 — no overlap
      const spans = [makeSpan(100, 200, 'a')];
      const result = updateSpanListForSuggestion({
        spans: spans as never,
        matchStart: 0,
        matchEnd: 5,
        replacementText: 'new',
      });
      expect(result).toBe(spans);
    });
  });

  describe('target span identification', () => {
    it('finds target by spanId', () => {
      const spans = [makeSpan(0, 5, 'target-id'), makeSpan(10, 15, 'other')];
      const result = updateSpanListForSuggestion({
        spans: spans as never,
        matchStart: 0,
        matchEnd: 5,
        replacementText: 'replaced',
        targetSpanId: 'target-id',
      });
      expect(result).toHaveLength(2);
      expect((result[0] as TestSpan).text).toBe('replaced');
    });

    it('finds target by start+end when no id match', () => {
      const spans = [makeSpan(0, 5), makeSpan(10, 15)];
      const result = updateSpanListForSuggestion({
        spans: spans as never,
        matchStart: 0,
        matchEnd: 5,
        replacementText: 'replaced',
        targetStart: 0,
        targetEnd: 5,
      });
      expect(result).toHaveLength(2);
      expect((result[0] as TestSpan).text).toBe('replaced');
    });
  });

  describe('core behavior — replacement', () => {
    it('updates target span text and position on replacement', () => {
      const spans = [makeSpan(0, 5, 'a')];
      const result = updateSpanListForSuggestion({
        spans: spans as never,
        matchStart: 0,
        matchEnd: 5,
        replacementText: 'longer text',
        targetSpanId: 'a',
      });
      expect(result).toHaveLength(1);
      const updated = result[0] as TestSpan;
      expect(updated.start).toBe(0);
      expect(updated.end).toBe(11); // 'longer text'.length
      expect(updated.text).toBe('longer text');
    });

    it('shifts spans after the match region by delta', () => {
      // Original: [0-5 target] [10-15 after]
      // Replace [0-5] with 'replaced!' (9 chars) → delta = 9 - 5 = 4
      // After span shifts: [10+4, 15+4] = [14, 19]
      const spans = [makeSpan(0, 5, 'a'), makeSpan(10, 15, 'b')];
      const result = updateSpanListForSuggestion({
        spans: spans as never,
        matchStart: 0,
        matchEnd: 5,
        replacementText: 'replaced!',
        targetSpanId: 'a',
      });
      expect(result).toHaveLength(2);
      expect((result[1] as TestSpan).start).toBe(14);
      expect((result[1] as TestSpan).end).toBe(19);
    });

    it('removes overlapping non-target spans', () => {
      // Target at [5-10], overlapping at [7-12]
      const spans = [makeSpan(5, 10, 'target'), makeSpan(7, 12, 'overlapping')];
      const result = updateSpanListForSuggestion({
        spans: spans as never,
        matchStart: 5,
        matchEnd: 10,
        replacementText: 'new',
        targetSpanId: 'target',
      });
      // Overlapping span removed, only target remains
      expect(result).toHaveLength(1);
      expect((result[0] as TestSpan).id).toBe('target');
    });

    it('keeps spans before matchStart unchanged', () => {
      const spans = [makeSpan(0, 3, 'before'), makeSpan(10, 15, 'target')];
      const result = updateSpanListForSuggestion({
        spans: spans as never,
        matchStart: 10,
        matchEnd: 15,
        replacementText: 'new',
        targetSpanId: 'target',
      });
      expect(result).toHaveLength(2);
      expect((result[0] as TestSpan).start).toBe(0);
      expect((result[0] as TestSpan).end).toBe(3);
    });
  });

  describe('removeTarget mode', () => {
    it('removes target span when removeTarget is true', () => {
      const spans = [makeSpan(0, 5, 'a'), makeSpan(10, 15, 'b')];
      const result = updateSpanListForSuggestion({
        spans: spans as never,
        matchStart: 0,
        matchEnd: 5,
        replacementText: '',
        targetSpanId: 'a',
        removeTarget: true,
      });
      // Target removed, only 'b' remains (shifted by delta = 0 - 5 = -5)
      expect(result).toHaveLength(1);
      expect((result[0] as TestSpan).id).toBe('b');
      expect((result[0] as TestSpan).start).toBe(5); // 10 + (-5)
      expect((result[0] as TestSpan).end).toBe(10); // 15 + (-5)
    });
  });
});
