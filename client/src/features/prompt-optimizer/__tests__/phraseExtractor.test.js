import { describe, it, expect } from 'vitest';
import { extractVideoPromptPhrases, runExtractionPipeline } from '../phraseExtractor.js';
import { PromptContext } from '../../../utils/PromptContext.js';

describe('runExtractionPipeline', () => {
  it('returns spans with canonical indices and context metadata', () => {
    const text = 'Neon signage glow surrounds the hero as the dolly shot reveals a 35mm frame at 24fps.';
    const { spans, canonical } = runExtractionPipeline(text, null);

    expect(canonical.normalized).toBe(text.normalize('NFC'));
    expect(spans.length).toBeGreaterThan(0);
    spans.forEach((span) => {
      expect(typeof span.start).toBe('number');
      expect(typeof span.end).toBe('number');
      expect(span.start).toBeLessThan(span.end);
      expect(typeof span.startGrapheme).toBe('number');
      expect(span.quote.length).toBe(span.end - span.start);
    });
  });

  it('prioritises context spans when provided', () => {
    const context = new PromptContext({ subject: 'hero pilot' });
    const text = 'The hero pilot checks the console before takeoff.';
    const { spans } = runExtractionPipeline(text, context);
    const contextSpan = spans.find((span) => span.source === 'CONTEXT');
    expect(contextSpan).toBeDefined();
    expect(contextSpan.category).toBe('subject');
    expect(contextSpan.text).toContain('hero pilot');
  });
});

describe('extractVideoPromptPhrases', () => {
  it('mirrors spans returned by runExtractionPipeline', () => {
    const text = 'Golden hour glow and soft key light shape the portrait.';
    const pipeline = runExtractionPipeline(text, null);
    const legacy = extractVideoPromptPhrases(text, null);
    expect(legacy).toEqual(pipeline.spans);
  });
});
