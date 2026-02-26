import { describe, it, expect } from 'vitest';
import { I2VConstrainedSuggestions } from '../I2VConstrainedSuggestions';
import { deriveLockMap } from '@services/prompt-optimization/types/i2v';
import type { ImageObservation } from '@services/image-observation/types';
import type { Suggestion } from '../types';

const observation: ImageObservation = {
  imageHash: 'hash',
  observedAt: new Date(),
  confidence: 0.9,
  subject: {
    type: 'person',
    description: 'elderly man',
    position: 'center',
    confidence: 0.9,
  },
  framing: {
    shotType: 'close-up',
    angle: 'eye-level',
    confidence: 0.9,
  },
  lighting: {
    quality: 'natural',
    timeOfDay: 'day',
    confidence: 0.9,
  },
  motion: {
    recommended: ['static'],
    risky: ['pan-left'],
    risks: [{ movement: 'pan-left', reason: 'risky' }],
  },
};

describe('I2VConstrainedSuggestions', () => {
  it('blocks hard-locked categories with reason and motion alternatives', () => {
    const constraints = new I2VConstrainedSuggestions();
    const lockMap = deriveLockMap('strict');
    const suggestions: Suggestion[] = [
      { text: 'bright neon lighting', category: 'lighting.type', confidence: 0.9 },
    ];

    const result = constraints.filterSuggestions(
      suggestions,
      'lighting.type',
      lockMap,
      observation
    );

    expect(result.suggestions).toEqual([]);
    expect(result.blockedReason).toContain('Lighting is');
    expect(result.motionAlternatives?.length).toBeGreaterThan(0);
  });

  it('filters risky camera movements when unlocked', () => {
    const constraints = new I2VConstrainedSuggestions();
    const lockMap = deriveLockMap('transform');
    const suggestions: Suggestion[] = [
      { text: 'pan left', category: 'camera.movement', confidence: 0.8 },
      { text: 'tilt up', category: 'camera.movement', confidence: 0.8 },
    ];

    const result = constraints.filterSuggestions(
      suggestions,
      'camera.movement',
      lockMap,
      observation
    );

    const texts = result.suggestions.map((item) => item.text);
    expect(texts).toContain('tilt up');
    expect(texts).not.toContain('pan left');
  });
});
