import { describe, it, expect } from 'vitest';
import PromptContext from '../PromptContext/PromptContext';

describe('PromptContext', () => {
  it('builds keyword maps and reports context presence', () => {
    const ctx = new PromptContext({ subject: 'cowboy', action: 'rides' });
    expect(ctx.hasContext()).toBe(true);
    expect(ctx.keywordMaps.subject).toBeDefined();
  });

  it('finds categories for phrases using current mappings', () => {
    const ctx = new PromptContext({
      subject: 'camera move',
      action: 'run',
      mood: 'nostalgic',
    });

    const match = ctx.findCategoryForPhrase('run fast');
    expect(match?.category).toBeTruthy();
  });

  it('returns a valid color for taxonomy categories', () => {
    const color = PromptContext.getCategoryColor('subject.wardrobe');
    expect(color.bg).toBeTruthy();
    expect(color.border).toBeTruthy();
  });

  it('serializes and deserializes', () => {
    const ctx = new PromptContext({ subject: 'cat' }, { format: 'short' });
    const json = ctx.toJSON();
    const restored = PromptContext.fromJSON(json);
    expect(restored?.elements.subject).toBe('cat');
    expect(restored?.metadata.format).toBe('short');
  });
});
