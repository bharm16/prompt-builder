import { describe, it, expect } from 'vitest';
import { parseStoryboardDeltas } from '../planParser';

describe('parseStoryboardDeltas', () => {
  describe('error handling', () => {
    it('fails when the response has too few deltas', () => {
      const response = '{"deltas": ["a", "b"]}';
      const result = parseStoryboardDeltas(response, 3);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('Storyboard planner returned insufficient deltas, expected 3');
      }
    });

    it('fails when no parsable deltas exist in the response', () => {
      const result = parseStoryboardDeltas('nonsense response', 2);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('Storyboard planner returned insufficient deltas, expected 2');
      }
    });
  });

  describe('edge cases', () => {
    it('parses bullet lists into deltas', () => {
      const response = '- first change\n2. second change\n* third change';
      const result = parseStoryboardDeltas(response, 3);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.deltas).toEqual(['first change', 'second change', 'third change']);
        expect(result.source).toBe('lines');
        expect(result.truncated).toBe(false);
      }
    });

    it('extracts arrays from JSON wrapped in markdown and truncates', () => {
      const response = 'Here is your output:\n```json\n["a", "b", "c"]\n```';
      const result = parseStoryboardDeltas(response, 2);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.deltas).toEqual(['a', 'b']);
        expect(result.truncated).toBe(true);
        expect(result.actualCount).toBe(3);
        expect(result.source).toBe('array');
      }
    });
  });

  describe('core behavior', () => {
    it('parses plan objects with exact delta counts', () => {
      const response = '{"deltas": ["shift to wide shot", "move to close-up"]}';
      const result = parseStoryboardDeltas(response, 2);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.deltas).toEqual(['shift to wide shot', 'move to close-up']);
        expect(result.truncated).toBe(false);
        expect(result.actualCount).toBe(2);
        expect(result.source).toBe('plan');
      }
    });
  });
});
