import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { DIContainer } from '@infrastructure/DIContainer';
import { registerGenerationServices } from '@config/services/generation.services';

describe('keyframe service alias regression', () => {
  const originalFalKey = process.env.FAL_KEY;

  beforeEach(() => {
    process.env.FAL_KEY = 'fal_test_key';
  });

  afterEach(() => {
    if (originalFalKey === undefined) {
      delete process.env.FAL_KEY;
      return;
    }
    process.env.FAL_KEY = originalFalKey;
  });

  it('resolves keyframeService and keyframeGenerationService to the same singleton instance', () => {
    const container = new DIContainer();
    registerGenerationServices(container);

    const generationService = container.resolve('keyframeGenerationService');
    const keyframeService = container.resolve('keyframeService');
    const keyframeServiceAgain = container.resolve('keyframeService');

    expect(keyframeService).toBe(generationService);
    expect(keyframeServiceAgain).toBe(generationService);
  });
});
