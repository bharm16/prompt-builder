import { describe, it, expect, vi, beforeEach } from 'vitest';

import { PromptContext } from '@/utils/PromptContext/PromptContext';
import { buildKeywordMaps, buildSemanticGroups, generateVariations } from '@/utils/PromptContext/keywordExtraction';
import { findCategoryForPhrase, mapGroupToCategory } from '@/utils/PromptContext/categoryMatching';
import { getCategoryColor } from '@/utils/PromptContext/categoryStyles';
import { categoryColors, DEFAULT_CATEGORY_COLOR } from '@/features/prompt-optimizer/config/categoryColors';

const logSpies = {
  warn: vi.fn(),
};

vi.mock('@/services/LoggingService', () => ({
  logger: {
    child: () => logSpies,
  },
}));

describe('PromptContext utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('keywordExtraction', () => {
    describe('error handling', () => {
      it('returns empty keyword lists when element values are missing', () => {
        const maps = buildKeywordMaps({ subject: null, action: 'Pan across' });

        expect(maps.subject).toEqual([]);
        expect(maps.action).toContain('pan across');
      });

      it('returns no variations when value is null or undefined', () => {
        expect(generateVariations(null)).toEqual([]);
        expect(generateVariations(undefined)).toEqual([]);
      });
    });

    describe('edge cases', () => {
      it('deduplicates extracted keywords', () => {
        const maps = buildKeywordMaps({ mood: 'Dark dark forest' });
        const moodKeywords = maps.mood ?? [];
        const unique = new Set(moodKeywords);

        expect(moodKeywords).toContain('dark dark forest');
        expect(moodKeywords).toContain('dark forest');
        expect(unique.size).toBe(moodKeywords.length);
      });

      it('expands semantic groups based on action, time, and style', () => {
        const groups = buildSemanticGroups({
          action: 'Pan and zoom',
          time: 'Golden hour',
          style: 'Noir 35mm',
        });

        expect(groups.cameraMovements).toEqual(
          expect.arrayContaining(['pan', 'panning', 'zoom', 'zooming'])
        );
        expect(groups.lightingQuality).toEqual(
          expect.arrayContaining(['golden hour', 'sunset', 'warm light'])
        );
        expect(groups.aesthetics).toEqual(
          expect.arrayContaining(['35mm', 'noir', 'chiaroscuro'])
        );
      });
    });

    describe('core behavior', () => {
      it('generates plural and verb variations', () => {
        const variations = generateVariations('make');

        expect(variations).toContain('make');
        expect(variations).toContain('makes');
        expect(variations).toContain('making');
      });
    });
  });

  describe('categoryMatching', () => {
    describe('error handling', () => {
      it('returns null when no keyword or semantic match exists', () => {
        const result = findCategoryForPhrase(
          'mystery phrase',
          { subject: ['cat'] },
          {},
          { subject: 'cat' }
        );

        expect(result).toBeNull();
      });
    });

    describe('edge cases', () => {
      it('ignores semantic groups that do not map to categories', () => {
        const result = findCategoryForPhrase(
          'mystic aura',
          {},
          { unknownGroup: ['mystic'] },
          {}
        );

        expect(result).toBeNull();
      });

      it('maps known semantic groups to categories', () => {
        expect(mapGroupToCategory('audioElements')).toBe('technical');
        expect(mapGroupToCategory('unknownGroup')).toBeNull();
      });
    });

    describe('core behavior', () => {
      it('returns a user-input match when keywords match', () => {
        const result = findCategoryForPhrase(
          'red scarf',
          { wardrobe: ['red scarf'] },
          {},
          { wardrobe: 'red scarf' }
        );

        expect(result).toEqual({
          category: 'wardrobe',
          confidence: 1,
          source: 'user-input',
          originalValue: 'red scarf',
        });
      });

      it('returns a semantic match when expanded terms match', () => {
        const result = findCategoryForPhrase(
          'panning shot',
          {},
          { cameraMovements: ['pan'] },
          { cameraMove: 'pan' }
        );

        expect(result).toEqual({
          category: 'cameraMove',
          confidence: 0.8,
          source: 'semantic-match',
          originalValue: 'pan',
        });
      });
    });
  });

  describe('categoryStyles', () => {
    describe('error handling', () => {
      it('falls back to the default color for invalid categories', () => {
        expect(getCategoryColor('not-a-category')).toEqual(DEFAULT_CATEGORY_COLOR);
      });
    });

    describe('edge cases', () => {
      it('returns legacy category colors for backward compatibility', () => {
        expect(getCategoryColor('mood')).toEqual(categoryColors.style);
      });

      it('falls back when the parent category is unknown', () => {
        expect(getCategoryColor('unknown.attribute')).toEqual(DEFAULT_CATEGORY_COLOR);
      });
    });

    describe('core behavior', () => {
      it('uses the parent taxonomy category color for attributes', () => {
        expect(getCategoryColor('subject.wardrobe')).toEqual(categoryColors.subject);
      });
    });
  });

  describe('PromptContext', () => {
    describe('error handling', () => {
      it('returns null when deserializing empty data', () => {
        expect(PromptContext.fromJSON(null)).toBeNull();
      });
    });

    describe('edge cases', () => {
      it('treats whitespace-only elements as empty context', () => {
        const context = new PromptContext({ subject: '   ' });

        expect(context.hasContext()).toBe(false);
      });
    });

    describe('core behavior', () => {
      it('finds categories using built semantic groups', () => {
        const context = new PromptContext({ action: 'Pan across the bay' });

        const result = context.findCategoryForPhrase('panning shot');

        expect(result?.category).toBe('cameraMove');
        expect(result?.source).toBe('semantic-match');
        expect(result?.confidence).toBe(0.8);
      });

      it('serializes context data with defaults', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2024-05-10T12:00:00Z'));

        const context = new PromptContext({ subject: 'Cat' });
        const json = context.toJSON();

        expect(json.version).toBe('1.0.0');
        expect(json.elements.subject).toBe('Cat');
        expect(json.metadata.format).toBe('detailed');
        expect(json.createdAt).toBe(new Date('2024-05-10T12:00:00Z').getTime());

        vi.useRealTimers();
      });
    });
  });
});
