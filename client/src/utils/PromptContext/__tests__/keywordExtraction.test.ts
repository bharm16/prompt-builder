import { describe, expect, it } from 'vitest';
import {
  buildKeywordMaps,
  buildSemanticGroups,
  generateVariations,
} from '../keywordExtraction';

describe('PromptContext keywordExtraction', () => {
  it('buildKeywordMaps extracts full values, keywords, and phrases with dedupe', () => {
    const maps = buildKeywordMaps({
      subject: 'A lone astronaut in orbit',
      action: 'Slow pan and sweep',
      mood: null,
    });

    expect(maps.subject).toEqual(
      expect.arrayContaining([
        'a lone astronaut in orbit',
        'lone',
        'astronaut',
        'orbit',
        'a lone',
      ])
    );
    expect(maps.action).toEqual(
      expect.arrayContaining(['slow pan and sweep', 'slow', 'sweep', 'slow pan'])
    );
    expect(maps.mood).toEqual([]);
  });

  it('buildSemanticGroups expands action, time, and style terms', () => {
    const groups = buildSemanticGroups({
      action: 'slow pan then zoom',
      time: 'golden hour',
      style: '35mm documentary noir',
    });

    expect(groups.cameraMovements).toEqual(
      expect.arrayContaining(['pan', 'panning', 'zoom', 'dollying'])
    );
    expect(groups.lightingQuality).toEqual(
      expect.arrayContaining(['golden hour', 'magic hour', 'warm glow'])
    );
    expect(groups.aesthetics).toEqual(
      expect.arrayContaining(['35mm', 'film grain', 'documentary', 'noir', 'chiaroscuro'])
    );
  });

  it('generateVariations includes lowercase, article-removed, plural, and -ing forms', () => {
    const variations = generateVariations('The Crane Move');

    expect(variations).toEqual(
      expect.arrayContaining([
        'The Crane Move',
        'the crane move',
        'crane move',
        'the crane moves',
        'the crane moving',
      ])
    );
  });

  it('generateVariations returns empty for nullish inputs', () => {
    expect(generateVariations('')).toEqual([]);
    expect(generateVariations(null)).toEqual([]);
    expect(generateVariations(undefined)).toEqual([]);
  });
});
