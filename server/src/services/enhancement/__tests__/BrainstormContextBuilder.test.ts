import { describe, it, expect } from 'vitest';
import { BrainstormContextBuilder } from '../services/BrainstormContextBuilder.js';

describe('BrainstormContextBuilder', () => {
  const builder = new BrainstormContextBuilder();

  it('infers creative intent with primary intent and themes', () => {
    const intent = builder.inferCreativeIntent({
      mood: 'nostalgic',
      setting: 'retro diner',
      atmosphere: 'memory',
    });

    expect(intent?.primaryIntent).toBeTruthy();
    expect(intent?.supportingThemes?.length).toBeGreaterThan(0);
  });

  it('suggests missing elements based on intent', () => {
    const suggestions = builder.suggestMissingElements({
      mood: 'futuristic',
      style: 'neon',
      intent: { primaryIntent: 'futuristic vision', supportingThemes: ['technology'] },
    });

    expect(Array.isArray(suggestions)).toBe(true);
  });

  it('builds a context section string with anchors and guidance', () => {
    const section = builder.buildBrainstormContextSection({
      elements: {
        mood: 'nostalgic',
        setting: 'futuristic neon city',
      },
      conflicts: [],
      opportunities: [],
    });

    expect(typeof section).toBe('string');
    expect(section.length).toBeGreaterThan(0);
    expect(section).toContain('Creative Brainstorm');
  });
});
