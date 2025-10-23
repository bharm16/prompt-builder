import { describe, expect, it } from 'vitest';

import { formatTextToHTML } from '../PromptCanvas.jsx';

describe('formatTextToHTML (PromptCanvas integration)', () => {
  it('does not inject highlight spans even when ML flag is true', () => {
    const { html } = formatTextToHTML('Highlight free text', true);
    expect(html).not.toContain('value-word');
    expect(html).toContain('Highlight free text');
  });
});
