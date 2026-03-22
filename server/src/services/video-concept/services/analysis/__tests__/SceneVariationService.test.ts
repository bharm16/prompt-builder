import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AIService } from '@services/prompt-optimization/types';
import { StructuredOutputEnforcer } from '@utils/StructuredOutputEnforcer';
import { SceneVariationService, type SceneVariation } from '../SceneVariationService';

vi.mock('@infrastructure/Logger', () => ({
  logger: {
    child: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

const createService = (): { service: SceneVariationService; aiService: AIService } => {
  const aiService = {
    execute: vi.fn(),
  } as unknown as AIService;

  return {
    service: new SceneVariationService(aiService),
    aiService,
  };
};

describe('SceneVariationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('generates scene variations via LLM', async () => {
    const { service } = createService();
    const mockVariations: SceneVariation[] = [
      {
        name: 'Noir Version',
        description: 'Dark and moody take',
        elements: { subject: 'detective', location: 'rainy alley' },
        changes: ['noir lighting', 'rain added'],
      },
      {
        name: 'Bright Version',
        description: 'Optimistic take',
        elements: { subject: 'explorer', location: 'sunny meadow' },
        changes: ['bright palette', 'open spaces'],
      },
    ];

    vi.spyOn(StructuredOutputEnforcer, 'enforceJSON').mockResolvedValue(mockVariations);

    const result = await service.generateVariations({
      elements: { subject: 'person', location: 'street' },
      concept: 'urban exploration',
    });

    expect(result.variations).toEqual(mockVariations);
    expect(StructuredOutputEnforcer.enforceJSON).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('urban exploration'),
      expect.objectContaining({
        operation: 'video_scene_variations',
        isArray: true,
      })
    );
  });

  it('returns empty variations on LLM failure', async () => {
    const { service } = createService();
    vi.spyOn(StructuredOutputEnforcer, 'enforceJSON').mockRejectedValue(new Error('bad response'));

    const result = await service.generateVariations({
      elements: { subject: 'person' },
      concept: 'test',
    });

    expect(result.variations).toEqual([]);
  });
});
