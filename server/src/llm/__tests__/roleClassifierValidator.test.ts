import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TAXONOMY } from '#shared/taxonomy';
import type { InputSpan } from '../types';
import { normalizeRole, validate } from '../roleClassifierValidator';

const warnSpy = vi.hoisted(() => vi.fn());

vi.mock('@infrastructure/Logger', () => ({
  logger: {
    child: () => ({ warn: warnSpy }),
  },
}));

describe('roleClassifierValidator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('defaults invalid role types to subject', () => {
      const result = normalizeRole(null);

      expect(result).toBe(TAXONOMY.SUBJECT.id);
      expect(warnSpy).toHaveBeenCalledWith(
        'Invalid role type, defaulting to subject',
        expect.objectContaining({ role: null })
      );
    });

    it('defaults unknown roles to subject', () => {
      const result = normalizeRole('unknown.role');

      expect(result).toBe(TAXONOMY.SUBJECT.id);
      expect(warnSpy).toHaveBeenCalledWith(
        'Unknown role, defaulting to subject',
        expect.objectContaining({ role: 'unknown.role' })
      );
    });

    it('filters out invalid labeled spans', () => {
      const source: InputSpan[] = [
        { text: 'cat', start: 0, end: 3 },
      ];

      const labeled = validate(source, [
        null,
        { text: 'cat', start: -1, end: 3, role: TAXONOMY.SUBJECT.id },
        { text: 'cat', start: 0, end: 0, role: TAXONOMY.SUBJECT.id },
        { text: 'dog', start: 0, end: 3, role: TAXONOMY.SUBJECT.id },
        { text: 'cat', start: 0, end: 3, role: TAXONOMY.SUBJECT.id, confidence: 0.9 },
      ]);

      expect(labeled).toHaveLength(1);
      const firstLabeled = labeled[0];
      expect(firstLabeled).toBeDefined();
      expect(firstLabeled?.text).toBe('cat');
      expect(firstLabeled?.confidence).toBe(0.9);
    });
  });

  describe('edge cases', () => {
    it('clamps confidence values and defaults when missing', () => {
      const source: InputSpan[] = [
        { text: 'cat', start: 0, end: 3 },
        { text: 'runs', start: 4, end: 8 },
        { text: 'fast', start: 9, end: 13 },
      ];

      const labeled = validate(source, [
        { text: 'cat', start: 0, end: 3, role: TAXONOMY.SUBJECT.id, confidence: 1.5 },
        { text: 'runs', start: 4, end: 8, role: TAXONOMY.ACTION.id, confidence: -0.2 },
        { text: 'fast', start: 9, end: 13, role: TAXONOMY.ACTION.id },
      ]);

      const byText = Object.fromEntries(labeled.map((item) => [item.text, item]));
      const cat = byText.cat as (typeof labeled)[number] | undefined;
      const runs = byText.runs as (typeof labeled)[number] | undefined;
      const fast = byText.fast as (typeof labeled)[number] | undefined;
      expect(cat).toBeDefined();
      expect(runs).toBeDefined();
      expect(fast).toBeDefined();
      expect(cat?.confidence).toBe(1);
      expect(runs?.confidence).toBe(0);
      expect(fast?.confidence).toBe(0.7);
    });

    it('skips long spans unless they are technical', () => {
      const source: InputSpan[] = [
        { text: 'a b c d e f g', start: 0, end: 13 },
      ];

      const labeled = validate(source, [
        { text: 'a b c d e f g', start: 0, end: 13, role: TAXONOMY.SUBJECT.id },
        { text: 'a b c d e f g', start: 0, end: 13, role: TAXONOMY.TECHNICAL.id },
      ]);

      expect(labeled).toHaveLength(1);
      expect(labeled[0]).toBeDefined();
      expect(labeled[0]?.role).toBe(TAXONOMY.TECHNICAL.id);
    });
  });

  describe('core behavior', () => {
    it('resolves overlaps by preferring technical spans or higher confidence', () => {
      const source: InputSpan[] = [
        { text: 'alpha beta', start: 0, end: 10 },
        { text: 'alpha', start: 0, end: 5 },
      ];

      const labeled = validate(source, [
        { text: 'alpha beta', start: 0, end: 10, role: TAXONOMY.SUBJECT.id, confidence: 0.9 },
        { text: 'alpha', start: 0, end: 5, role: TAXONOMY.TECHNICAL.id, confidence: 0.1 },
      ]);

      expect(labeled).toHaveLength(1);
      expect(labeled[0]).toBeDefined();
      expect(labeled[0]?.text).toBe('alpha');
      expect(labeled[0]?.role).toBe(TAXONOMY.TECHNICAL.id);
    });
  });
});
