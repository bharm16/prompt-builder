import { describe, expect, it, vi } from 'vitest';
import {
  SuggestionQualityEvaluator,
  type SuggestionQualityScores,
} from '../SuggestionQualityEvaluator';
import type { Suggestion } from '@services/enhancement/services/types';
import {
  representativeSuggestionBenchmarks,
  toddlerCarBlockingBenchmarks,
  toddlerCarPrompt,
} from '../__fixtures__/suggestionQualityBenchmarks';

function createEvaluator() {
  const sanitizeSuggestions = vi.fn(
    (suggestions: Suggestion[], context: {
      highlightedCategory?: string | null;
      contextBefore?: string;
    }) => {
      const category = String(context.highlightedCategory || '').toLowerCase();

      return suggestions.filter((suggestion) => {
        const text = suggestion.text.toLowerCase();

        if ((context.contextBefore || '').trimEnd().endsWith('a') && /^[a-z]+['’]s\b/i.test(suggestion.text)) {
          return false;
        }

        if (category === 'camera.angle') {
          return /\b(eye[-\s]?level|low[-\s]?angle|high[-\s]?angle|overhead|dutch tilt)\b/i.test(text) &&
            !/\b(dolly|track|pan|tilt|crane|zoom|handheld|lens|mm|focus|bokeh)\b/i.test(text);
        }

        if (category === 'camera.focus') {
          return /\b(focus|bokeh|blur|depth of field|rack focus|defocus)\b/i.test(text) &&
            !/\b(dolly|track|pan|tilt|crane|zoom|lens|mm|close-up|wide shot)\b/i.test(text);
        }

        if (category === 'lighting.timeofday') {
          return /\b(dawn|morning|afternoon|dusk|twilight|blue hour|night)\b/i.test(text) &&
            !/\b(backlight|window|flare|left|right|rim light)\b/i.test(text);
        }

        if (category === 'environment.context') {
          return /\b(window|windshield|glass|dashboard|reflection|condensation|haze)\b/i.test(text) &&
            !/\b(lake|beach|park|forest|city|street|meadow)\b/i.test(text);
        }

        if (category === 'style.aesthetic') {
          return /\b(grain|palette|filter|noir|retro|painterly|watercolor|monochrome|kodachrome|diffusion|digital)\b/i.test(text) &&
            !/\b(handheld|dolly|tracking|backlight|window|left|right)\b/i.test(text);
        }

        if (category.startsWith('subject.')) {
          return !/\b(puppy|dog|rabbit|alien|monster|robot|clown)\b/i.test(text);
        }

        return true;
      });
    }
  );

  const validateSuggestions = vi.fn(
    (suggestions: Suggestion[], _highlightedText: string, category: string) => {
      const normalizedCategory = category.toLowerCase();

      return suggestions.filter((suggestion) => {
        if (normalizedCategory === 'camera.angle') {
          return suggestion.category === 'camera.angle';
        }
        if (normalizedCategory === 'lighting.timeofday') {
          return suggestion.category === 'lighting.timeOfDay';
        }
        if (normalizedCategory === 'environment.context') {
          return suggestion.category === 'environment.context';
        }
        return suggestion.category?.toLowerCase() === normalizedCategory;
      });
    }
  );

  const validationService = {
    sanitizeSuggestions,
    validateSuggestions,
  };
  const videoService = {
    isVideoPrompt: vi.fn(() => true),
  };

  return {
    evaluator: new SuggestionQualityEvaluator(
      validationService as never,
      videoService as never
    ),
  };
}

function expectAllFives(scores: SuggestionQualityScores) {
  expect(scores).toEqual({
    contextualFit: 5,
    categoryAlignment: 5,
    diversity: 5,
    videoSpecificity: 5,
    sceneCoherence: 5,
  });
}

describe('SuggestionQualityEvaluator', () => {
  it('scores the toddler/car blocking benchmark at 5 across all dimensions', async () => {
    const { evaluator } = createEvaluator();

    for (const benchmark of toddlerCarBlockingBenchmarks) {
      const result = await evaluator.evaluateCase(benchmark.testCase, benchmark.suggestions);
      expect(result.passed).toBe(true);
      expect(result.failures).toEqual([]);
      expectAllFives(result.scores);
    }
  });

  it('scores the representative benchmark set at 5 across all dimensions', async () => {
    const { evaluator } = createEvaluator();

    for (const benchmark of representativeSuggestionBenchmarks) {
      const result = await evaluator.evaluateCase(benchmark.testCase, benchmark.suggestions);
      expect(result.passed).toBe(true);
      expect(result.failures).toEqual([]);
      expectAllFives(result.scores);
    }
  });

  it('fails when suggestions drift from the category or scene', async () => {
    const { evaluator } = createEvaluator();

    const result = await evaluator.evaluateCase(
      {
        id: 'bad-time-of-day-set',
        prompt: toddlerCarPrompt,
        span: { text: 'golden hour sunlight', category: 'lighting.timeOfDay' },
        contextBefore: 'Warm, ',
        contextAfter: ' streams through the car windows.',
        spanAnchors: '- environment: "car windows"\n- style: "Kodak Portra 400 film"',
        expectedQualities: {
          contextualFit: { min: 5 },
          categoryAlignment: { min: 5 },
          sceneCoherence: { min: 5 },
        },
      },
      [
        { text: 'amber backlight casting soft halos', category: 'lighting.timeOfDay' },
        { text: 'warm backlight with flare', category: 'lighting.timeOfDay' },
        { text: 'misty blue hour', category: 'camera.angle' },
      ]
    );

    expect(result.passed).toBe(false);
    expect(result.failures.join(' | ')).toMatch(
      /contextualFit|categoryAlignment|sceneCoherence/
    );
  });
});
