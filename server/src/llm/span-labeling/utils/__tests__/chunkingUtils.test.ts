import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { TextChunker, countWords } from '../chunkingUtils';

describe('TextChunker', () => {
  describe('error handling', () => {
    it('returns empty chunks for non-string input', () => {
      const chunker = new TextChunker();
      expect(chunker.chunkText(null)).toEqual([]);
      expect(chunker.needsChunking(undefined)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('splits headings and bullets as separate sentences with offsets', () => {
      const text = '# Heading\n- Bullet item\nRegular sentence.';
      const chunker = new TextChunker();
      const sentences = chunker.splitIntoSentences(text);

      expect(sentences[0]?.text).toBe('# Heading');
      expect(sentences[0]?.startOffset).toBe(0);
      expect(sentences[1]?.text).toBe('- Bullet item');
      expect(sentences[1]?.startOffset).toBe(text.indexOf('- Bullet item'));
    });
  });

  describe('core behavior', () => {
    it('creates overlapping chunks when max size is exceeded', () => {
      const text = 'One two. Three four. Five six.';
      const chunker = new TextChunker(3, 2);

      const chunks = chunker.chunkText(text);

      expect(chunks).toHaveLength(3);
      expect(chunks[0]?.text).toContain('One two.');
      expect(chunks[1]?.text).toContain('One two.');
      expect(chunks[1]?.text).toContain('Three four.');
      expect(chunks[2]?.text).toContain('Three four.');
    });

    it('merges chunk spans with offsets and removes duplicates', () => {
      const chunker = new TextChunker();
      const results = [
        { chunkOffset: 0, spans: [{ text: 'cat', start: 0, end: 3, role: 'subject' }] },
        { chunkOffset: 0, spans: [{ text: 'cat', start: 0, end: 3, role: 'subject' }] },
        { chunkOffset: 10, spans: [{ text: 'runs', start: 4, end: 8, role: 'action' }] },
      ];

      const merged = chunker.mergeChunkedSpans(results);

      expect(merged).toHaveLength(2);
      expect(merged[0]?.start).toBe(0);
      expect(merged[1]?.start).toBe(14);
    });
  });
});

describe('countWords', () => {
  describe('core behavior', () => {
    it('counts whitespace-delimited words', () => {
      const text = 'one two three four';
      expect(countWords(text)).toBe(4);
    });

    it('matches word array length for space-joined tokens', () => {
      const wordArb = fc
        .array(fc.constantFrom('a', 'b', 'c', 'd', 'e'), { minLength: 1, maxLength: 5 })
        .map((chars) => chars.join(''));

      fc.assert(
        fc.property(fc.array(wordArb, { minLength: 1, maxLength: 10 }), (words) => {
          const text = words.join(' ');
          expect(countWords(text)).toBe(words.length);
        })
      );
    });
  });
});
