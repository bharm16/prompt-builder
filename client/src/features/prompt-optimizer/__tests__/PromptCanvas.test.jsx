import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../phraseExtractor', () => ({
  extractVideoPromptPhrases: vi.fn(),
}));

import { formatTextToHTML } from '../PromptCanvas.jsx';
import { extractVideoPromptPhrases } from '../phraseExtractor';

describe('formatTextToHTML', () => {
  beforeEach(() => {
    extractVideoPromptPhrases.mockReset();
  });

  it('includes confidence class names and data attribute on highlighted spans', () => {
    extractVideoPromptPhrases.mockReturnValue([
      {
        text: 'highlight phrase',
        category: 'test-category',
        confidence: 0.75,
        color: { bg: 'rgba(0,0,0,0.1)', border: 'rgba(0,0,0,0.2)' },
      },
    ]);

    const { html } = formatTextToHTML('This is a highlight phrase example.', true);

    expect(html).toContain('class="value-word value-word-test-category medium-confidence"');
    expect(html).toContain('data-confidence="0.75"');
  });
});
