import { describe, expect, it, vi } from 'vitest';
import {
  SuggestionQualityEvaluator,
  type SuggestionTestCase,
} from '../SuggestionQualityEvaluator';
import type { Suggestion } from '@services/enhancement/services/types';

function createEvaluator(
  sanitizeImpl: (suggestions: Suggestion[]) => Suggestion[] = (suggestions) => suggestions
) {
  const validationService = {
    sanitizeSuggestions: vi.fn((suggestions: Suggestion[]) => sanitizeImpl(suggestions)),
  };
  const videoService = {
    isVideoPrompt: vi.fn(() => true),
  };

  const evaluator = new SuggestionQualityEvaluator(
    validationService as never,
    videoService as never
  );

  return { evaluator, validationService, videoService };
}

describe('SuggestionQualityEvaluator', () => {
  const baseCase: SuggestionTestCase = {
    id: 'camera-motion',
    prompt: 'A runner moves through rain at night.',
    span: {
      text: 'tracking shot',
      category: 'camera.movement',
    },
    allowedCategories: ['camera.movement'],
  };

  it('passes high-quality suggestion sets with strong rubric scores', async () => {
    const { evaluator } = createEvaluator();

    const result = await evaluator.evaluateCase(baseCase, [
      { text: 'Dolly in toward the subject', category: 'camera.movement' },
      { text: 'Arc left around the subject', category: 'camera.movement' },
      { text: 'Crane rise to reveal the skyline', category: 'camera.movement' },
    ]);

    expect(result.passed).toBe(true);
    expect(result.failures).toEqual([]);
    expect(result.scores.categoryCoherence).toBeCloseTo(1, 3);
    expect(result.scores.diversity).toBeGreaterThan(0.45);
    expect(result.scores.nonRepetition).toBeGreaterThan(0.6);
    expect(result.scores.syntacticValidity).toBeCloseTo(1, 3);
    expect(result.scores.lengthAppropriateness).toBeGreaterThan(0.6);
  });

  it('fails when forbidden outputs are present', async () => {
    const { evaluator } = createEvaluator();
    const testCase: SuggestionTestCase = {
      ...baseCase,
      forbiddenOutputs: ['Dolly in toward the subject'],
    };

    const result = await evaluator.evaluateCase(testCase, [
      { text: 'Dolly in toward the subject', category: 'camera.movement' },
      { text: 'Crane up for an overhead reveal', category: 'camera.movement' },
    ]);

    expect(result.passed).toBe(false);
    expect(result.failures.join(' ')).toContain('Forbidden output produced');
  });

  it('fails thresholded rubric expectations for low-quality suggestions', async () => {
    const { evaluator } = createEvaluator((suggestions) =>
      suggestions.filter((item) => !item.text.includes('INVALID'))
    );

    const testCase: SuggestionTestCase = {
      ...baseCase,
      expectedQualities: {
        categoryCoherence: { min: 0.8 },
        syntacticValidity: { min: 0.8 },
        nonRepetition: { min: 0.7 },
      },
    };

    const result = await evaluator.evaluateCase(testCase, [
      { text: 'tracking shot', category: 'lighting.quality' },
      { text: 'tracking shot', category: 'lighting.quality' },
      { text: 'INVALID', category: 'camera.movement' },
    ]);

    expect(result.passed).toBe(false);
    expect(result.failures.length).toBeGreaterThan(0);
    expect(result.failures.join(' | ')).toMatch(
      /categoryCoherence|syntacticValidity|nonRepetition/
    );
  });
});
