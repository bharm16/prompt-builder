import { describe, expect, it } from 'vitest';
import { findCategoryForPhrase, mapGroupToCategory } from '../categoryMatching';

describe('PromptContext categoryMatching', () => {
  const keywordMaps = {
    action: ['slow pan', 'camera sweep'],
    style: ['film noir'],
    lighting: ['golden hour'],
  };

  const semanticGroups = {
    cameraMovements: ['panning', 'dolly', 'tracking'],
    lightingQuality: ['warm glow', 'twilight'],
    aesthetics: ['celluloid', 'chiaroscuro'],
  };

  const elements = {
    action: 'slow pan',
    style: 'film noir',
    lighting: 'golden hour',
  };

  it('returns exact keyword match from user-input source', () => {
    const result = findCategoryForPhrase('A very slow pan to the right', keywordMaps, semanticGroups, elements);

    expect(result).toEqual({
      category: 'action',
      confidence: 1,
      source: 'user-input',
      originalValue: 'slow pan',
    });
  });

  it('returns semantic match when keyword match is absent', () => {
    const result = findCategoryForPhrase('The view starts panning gently', keywordMaps, semanticGroups, elements);

    expect(result).toEqual({
      category: 'cameraMove',
      confidence: 0.8,
      source: 'semantic-match',
      originalValue: null,
    });
  });

  it('returns null when no category matches', () => {
    const result = findCategoryForPhrase('Unrelated phrase with no mapping', keywordMaps, semanticGroups, elements);
    expect(result).toBeNull();
  });

  it('mapGroupToCategory maps known groups and returns null for unknown', () => {
    expect(mapGroupToCategory('cameraMovements')).toBe('cameraMove');
    expect(mapGroupToCategory('lightingQuality')).toBe('lighting');
    expect(mapGroupToCategory('aesthetics')).toBe('style');
    expect(mapGroupToCategory('audioElements')).toBe('technical');
    expect(mapGroupToCategory('unknownGroup')).toBeNull();
  });
});
