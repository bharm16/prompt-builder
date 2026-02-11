import { describe, expect, it, vi } from 'vitest';
import { PromptContext } from '../PromptContext';
import { getCategoryColor } from '../categoryStyles';

describe('PromptContext', () => {
  it('hasContext returns true only when at least one element is populated', () => {
    const empty = new PromptContext();
    const populated = new PromptContext({
      subject: 'A lone astronaut',
    });

    expect(empty.hasContext()).toBe(false);
    expect(populated.hasContext()).toBe(true);
  });

  it('findCategoryForPhrase uses keyword and semantic maps', () => {
    const context = new PromptContext({
      action: 'slow pan',
      style: 'film noir',
    });

    const keywordMatch = context.findCategoryForPhrase('The shot does a slow pan to the right');
    const semanticMatch = context.findCategoryForPhrase('Heavy chiaroscuro dominates the frame');

    expect(keywordMatch).toEqual(
      expect.objectContaining({
        category: 'action',
        source: 'user-input',
      })
    );
    expect(semanticMatch).toEqual(
      expect.objectContaining({
        category: 'style',
        source: 'semantic-match',
      })
    );
  });

  it('serializes and deserializes context data via toJSON/fromJSON', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1735689600000);

    const original = new PromptContext(
      {
        subject: 'Hero',
        location: 'City street',
      },
      {
        format: 'concise',
        technicalParams: { fps: 24 },
        validationScore: 0.9,
        history: [{ version: 1 }],
      }
    );

    const serialized = original.toJSON();
    const restored = PromptContext.fromJSON(serialized);

    expect(serialized).toEqual({
      version: '1.0.0',
      createdAt: 1735689600000,
      elements: expect.objectContaining({
        subject: 'Hero',
        location: 'City street',
      }),
      metadata: expect.objectContaining({
        format: 'concise',
        technicalParams: { fps: 24 },
        validationScore: 0.9,
      }),
    });

    expect(restored).not.toBeNull();
    expect(restored?.elements).toEqual(original.elements);
    expect(restored?.metadata).toEqual(original.metadata);
    expect(PromptContext.fromJSON(null)).toBeNull();
  });

  it('exposes shared helpers for category mapping and variations', () => {
    const context = new PromptContext({
      style: '35mm',
    });

    expect(context.mapGroupToCategory('cameraMovements')).toBe('cameraMove');
    expect(context.generateVariations('The Drone')).toEqual(
      expect.arrayContaining(['the drone', 'drone'])
    );
    expect(PromptContext.getCategoryColor('style')).toEqual(getCategoryColor('style'));
  });
});
