import { describe, it, expect } from 'vitest';
import { GOLDEN_CORPUS } from '../../../../../tests/fixtures/goldenCorpus.js';
import { PromptContext } from '../../../utils/PromptContext.js';

describe('prompt optimizer golden corpus', () => {
  GOLDEN_CORPUS.forEach(({ name, text, context, expected }) => {
    it(`extracts expected spans for ${name}`, () => {
      const promptContext = context ? new PromptContext(context) : null;
      const { spans } = runExtractionPipeline(text, promptContext);
      expected.forEach((exp) => {
        const match = spans.find((span) => {
          if (span.category !== exp.category) return false;
          if (exp.source && span.source !== exp.source) return false;
          return span.text === exp.quote || span.quote === exp.quote;
        });
        expect(match, `Missing span ${exp.quote} (${exp.category}) in ${name}`).toBeDefined();
      });
    });
  });
});
