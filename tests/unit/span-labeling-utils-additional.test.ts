import { describe, expect, it } from 'vitest';

import { TextChunker, countWords } from '@server/llm/span-labeling/utils/chunkingUtils';
import { buildUserPayload, cleanJsonEnvelope, parseJson } from '@server/llm/span-labeling/utils/jsonUtils';

describe('TextChunker (additional)', () => {
  describe('error handling', () => {
    it('returns empty chunks for non-string input', () => {
      const chunker = new TextChunker();

      const result = chunker.chunkText(null);

      expect(result).toEqual([]);
    });

    it('returns false for needsChunking when input is invalid', () => {
      const chunker = new TextChunker();

      expect(chunker.needsChunking(undefined)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('preserves bullet and heading lines as separate sentences', () => {
      const chunker = new TextChunker(50);
      const text = '- Bullet item\n## Heading\nA normal sentence.';

      const sentences = chunker.splitIntoSentences(text);

      expect(sentences.map((s) => s.text)).toEqual([
        '- Bullet item',
        '## Heading',
        'A normal sentence.',
      ]);
    });

    it('includes overlap sentences when overlapWords is set', () => {
      const chunker = new TextChunker(3, 2);
      const text = 'One two. Three four. Five six.';

      const chunks = chunker.chunkText(text);

      expect(chunks).toHaveLength(3);
      expect(chunks[1]?.text.startsWith('One two.')).toBe(true);
      expect(chunks[2]?.text.startsWith('Three four.')).toBe(true);
    });
  });

  describe('core behavior', () => {
    it('merges chunked spans with offset correction and de-duplication', () => {
      const chunker = new TextChunker();
      const spans = chunker.mergeChunkedSpans([
        { chunkOffset: 0, spans: [{ text: 'alpha', start: 0, end: 5, role: 'style' }] },
        { chunkOffset: 5, spans: [{ text: 'alpha', start: 0, end: 5, role: 'style' }] },
      ]);

      expect(spans).toHaveLength(2);
      expect(spans[0]?.start).toBe(0);
      expect(spans[1]?.start).toBe(5);
    });
  });
});

describe('chunkingUtils.countWords (additional)', () => {
  describe('error handling', () => {
    it('returns zero for non-string inputs', () => {
      expect(countWords(null)).toBe(0);
      expect(countWords(undefined)).toBe(0);
    });

    it('returns zero for empty strings', () => {
      expect(countWords('')).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('counts words with extra whitespace correctly', () => {
      expect(countWords('  hello   world ')).toBe(2);
    });

    it('counts hyphenated words as separate tokens', () => {
      expect(countWords('high-quality footage')).toBe(2);
    });
  });

  describe('core behavior', () => {
    it('counts words in a sentence', () => {
      expect(countWords('A quick brown fox')).toBe(4);
    });
  });
});

describe('jsonUtils (additional)', () => {
  describe('error handling', () => {
    it('returns empty string when cleanJsonEnvelope receives non-string', () => {
      expect(cleanJsonEnvelope(null)).toBe('');
    });

    it('returns an error when JSON is invalid', () => {
      const result = parseJson('not-json');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('Invalid JSON');
      }
    });
  });

  describe('edge cases', () => {
    it('parses JSON wrapped in code fences', () => {
      const result = parseJson('```json\n{"ok":true}\n```');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({ ok: true });
      }
    });

    it('extracts JSON from a response preamble', () => {
      const result = parseJson('Here is {"value":42}');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({ value: 42 });
      }
    });
  });

  describe('core behavior', () => {
    it('wraps user text in XML tags when building payloads', () => {
      const payload = buildUserPayload({
        task: 'Task',
        policy: { allowOverlap: false },
        text: 'Hello',
        templateVersion: 'v1',
        validation: { errors: ['x'] },
      });

      const parsed = JSON.parse(payload) as { text: string; validation?: { errors?: string[] } };

      expect(parsed.text).toContain('<user_input>');
      expect(parsed.text).toContain('Hello');
      expect(parsed.validation?.errors).toEqual(['x']);
    });
  });
});
