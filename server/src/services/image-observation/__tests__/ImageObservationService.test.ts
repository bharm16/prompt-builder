import { describe, it, expect, vi } from 'vitest';
import { ImageObservationService } from '../ImageObservationService';
import type { AIService } from '../../prompt-optimization/types';

const createAIStub = (): AIService => ({
  execute: vi.fn().mockImplementation(() => {
    throw new Error('AI should not be called in fast-path');
  }),
});

describe('ImageObservationService', () => {
  it('uses sourcePrompt fast-path and derives basic observations', async () => {
    const ai = createAIStub();
    const service = new ImageObservationService(ai);

    const result = await service.observe({
      image: 'https://example.com/image.jpg',
      sourcePrompt: 'A young woman in a close-up at golden hour',
      skipCache: true,
    });

    expect(result.success).toBe(true);
    expect(result.usedFastPath).toBe(true);
    expect(result.observation?.subject.type).toBe('person');
    expect(result.observation?.framing.shotType).toBe('close-up');
    expect(result.observation?.lighting.timeOfDay).toBe('golden-hour');
  });
});
