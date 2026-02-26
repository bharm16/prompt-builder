import { describe, it, expect } from 'vitest';
import { normalizeText, countWords, extractMainVideoPrompt } from '../text';

describe('normalizeText', () => {
  describe('error handling and edge cases', () => {
    it('trims leading and trailing whitespace', () => {
      expect(normalizeText('  hello  ')).toBe('hello');
    });

    it('collapses multiple spaces to single space', () => {
      expect(normalizeText('hello    world')).toBe('hello world');
    });

    it('handles tabs and newlines as whitespace', () => {
      expect(normalizeText('hello\t\nworld')).toBe('hello world');
    });

    it('lowercases all characters', () => {
      expect(normalizeText('Hello WORLD FoO')).toBe('hello world foo');
    });

    it('handles empty string', () => {
      expect(normalizeText('')).toBe('');
    });

    it('normalizes NFKC unicode forms', () => {
      // ﬁ (U+FB01) should normalize to 'fi'
      expect(normalizeText('ﬁnd')).toBe('find');
    });
  });

  describe('core behavior', () => {
    it('applies lowercase, whitespace collapse, and trim together', () => {
      expect(normalizeText('  Hello   WORLD  ')).toBe('hello world');
    });
  });
});

describe('countWords', () => {
  describe('edge cases', () => {
    it('returns 0 for empty string', () => {
      expect(countWords('')).toBe(0);
    });

    it('returns 0 for whitespace-only string', () => {
      expect(countWords('   \t\n  ')).toBe(0);
    });

    it('returns 1 for single word', () => {
      expect(countWords('hello')).toBe(1);
    });
  });

  describe('core behavior', () => {
    it('counts words separated by spaces', () => {
      expect(countWords('one two three')).toBe(3);
    });

    it('counts words ignoring extra whitespace', () => {
      expect(countWords('  one   two   three  ')).toBe(3);
    });

    it('counts words case-insensitively after normalization', () => {
      expect(countWords('Hello WORLD foo')).toBe(3);
    });
  });
});

describe('extractMainVideoPrompt', () => {
  describe('error handling and edge cases', () => {
    it('returns empty string for empty input', () => {
      expect(extractMainVideoPrompt('')).toBe('');
    });

    it('returns empty string for whitespace-only input', () => {
      expect(extractMainVideoPrompt('   ')).toBe('');
    });

    it('returns original text when no special structure found', () => {
      expect(extractMainVideoPrompt('A beautiful sunset scene')).toBe('A beautiful sunset scene');
    });

    it('handles non-string input gracefully', () => {
      expect(extractMainVideoPrompt(null as unknown as string)).toBe('');
      expect(extractMainVideoPrompt(undefined as unknown as string)).toBe('');
    });

    it('returns original when JSON parsing fails', () => {
      const malformedJson = '{not valid json}';
      expect(extractMainVideoPrompt(malformedJson)).toBe(malformedJson);
    });

    it('returns original when JSON has no prompt field', () => {
      const jsonNoPrompt = '{"description": "some text"}';
      expect(extractMainVideoPrompt(jsonNoPrompt)).toBe(jsonNoPrompt);
    });
  });

  describe('JSON extraction', () => {
    it('extracts prompt field from JSON object', () => {
      const input = '{"prompt": "A cinematic shot of a forest"}';
      expect(extractMainVideoPrompt(input)).toBe('A cinematic shot of a forest');
    });

    it('trims extracted prompt from JSON', () => {
      const input = '{"prompt": "  A cinematic shot  "}';
      expect(extractMainVideoPrompt(input)).toBe('A cinematic shot');
    });

    it('ignores JSON with empty prompt field', () => {
      const input = '{"prompt": "   "}';
      // Empty prompt after trim → falls through to text
      expect(extractMainVideoPrompt(input)).toBe(input);
    });
  });

  describe('technical specs header extraction', () => {
    it('strips text after **TECHNICAL SPECS** header', () => {
      const input = 'A beautiful sunset over the ocean\n\n**TECHNICAL SPECS**\nResolution: 4K';
      expect(extractMainVideoPrompt(input)).toBe('A beautiful sunset over the ocean');
    });

    it('handles case-insensitive technical specs header', () => {
      const input = 'Main prompt text\n\n**technical specs**\nDetails here';
      expect(extractMainVideoPrompt(input)).toBe('Main prompt text');
    });
  });
});
