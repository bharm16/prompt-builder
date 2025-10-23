import { describe, it, expect } from 'vitest';

const { formatTextToHTML } = await import('../PromptCanvas.jsx');

describe('formatTextToHTML', () => {
  it('preserves line structure with semantic classes', () => {
    const text = `### Scene Overview
1. Establish the world

- Hero emerges`;
    const { html } = formatTextToHTML(text);

    expect(html).toContain('class="prompt-line prompt-line--heading"');
    expect(html).toContain('Scene Overview</div>');
    expect(html).toContain('class="prompt-line prompt-line--ordered"');
    expect(html).toContain('<span class="prompt-ordered-index">1.</span>');
    expect(html).toContain('Establish the world</span>');
    expect(html).toContain('class="prompt-line prompt-line--gap"');
    expect(html).toContain('<span class="prompt-bullet-text">Hero emerges</span>');
  });

  it('retains emoji and labels for canonical mapping', () => {
    const text = `### ✨ KEY MOMENTS
Mood: 🔥 Intense focus on detail`;
    const { html } = formatTextToHTML(text);

    expect(html).toContain('✨ KEY MOMENTS');
    expect(html).toContain('🔥 Intense focus on detail');
    expect(html).not.toContain('value-word');
  });
});
