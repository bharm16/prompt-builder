import { describe, it, expect, vi } from 'vitest';
import { PromptContext } from '../../../utils/PromptContext';

vi.mock('../phraseExtractor', () => {
  return {
    extractVideoPromptPhrases: vi.fn((text, context) => {
      if (context && typeof context.hasContext === 'function' && context.hasContext()) {
        return [
          {
            text: 'lone astronaut',
            category: 'subject',
            color: { bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.5)' },
          },
        ];
      }
      return [];
    }),
  };
});

const { formatTextToHTML } = await import('../PromptCanvas.jsx');

describe('formatTextToHTML', () => {
  it('renders headers and numbered lists with structured markup', () => {
    const text = `### Scene Overview\n1. Establish the world\n2. Introduce the hero`;

    const { html } = formatTextToHTML(text);

    expect(html).toContain('<h2 style="font-size: 1.25rem; font-weight: 600; color: rgb(23, 23, 23); margin-bottom: 1rem; margin-top: 2rem; line-height: 1.2; letter-spacing: -0.025em;">Scene Overview</h2>');
    expect(html).toContain('<span style="color: rgb(115, 115, 115); font-weight: 500; margin-top: 0.125rem; flex-shrink: 0; font-size: 0.875rem;">1.</span>');
    expect(html).toContain('<span style="color: rgb(115, 115, 115); font-weight: 500; margin-top: 0.125rem; flex-shrink: 0; font-size: 0.875rem;">2.</span>');
  });

  it('strips emojis and preserves labels without highlighting', () => {
    const text = `### ✨ KEY MOMENTS\nMood: 🔥 Intense focus on detail`;

    const { html } = formatTextToHTML(text);

    expect(html).not.toContain('✨');
    expect(html).not.toContain('🔥');
    expect(html).toContain('Mood:');
    expect(html).toContain('Intense focus on detail');
    expect(html).not.toContain('value-word');
  });

  it('applies context-aware highlights when promptContext matches content', () => {
    const text = 'The lone astronaut calibrates the suit.';

    const withoutContext = formatTextToHTML(text, true);
    expect(withoutContext.html).not.toContain('value-word');

    const context = new PromptContext({ subject: 'lone astronaut' });
    const withContext = formatTextToHTML(text, true, context);

    expect(withContext.html).toContain('value-word value-word-subject');
    expect(withContext.html).toContain('data-category="subject"');
    expect(withContext.html).toContain('lone astronaut');
  });
});
