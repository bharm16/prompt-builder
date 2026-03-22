import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AIService } from '@services/prompt-optimization/types';
import { StructuredOutputEnforcer } from '@utils/StructuredOutputEnforcer';
import { TechnicalParameterService } from '../TechnicalParameterService';

vi.mock('@infrastructure/Logger', () => ({
  logger: {
    child: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

const createService = (): { service: TechnicalParameterService; aiService: AIService } => {
  const aiService = {
    execute: vi.fn(),
  } as unknown as AIService;

  return {
    service: new TechnicalParameterService(aiService),
    aiService,
  };
};

describe('TechnicalParameterService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('generates technical parameters from elements', async () => {
    const { service } = createService();
    const mockParams = {
      camera: { angle: 'low', movement: 'dolly forward', lens: '35mm' },
      lighting: { type: 'golden hour', direction: 'side', quality: 'soft' },
      color: { grading: 'warm tones', palette: 'amber and gold' },
      format: { frameRate: '24fps', aspectRatio: '2.39:1', resolution: '4K' },
      audio: { style: 'ambient', mood: 'contemplative' },
      postProduction: { effects: ['lens flare'], transitions: 'slow dissolve' },
    };

    vi.spyOn(StructuredOutputEnforcer, 'enforceJSON').mockResolvedValue(mockParams);

    const result = await service.generateTechnicalParams({
      elements: { subject: 'lone cowboy', location: 'desert at sunset', mood: 'melancholic' },
    });

    expect(result.technicalParams).toEqual(mockParams);
    expect(StructuredOutputEnforcer.enforceJSON).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('lone cowboy'),
      expect.objectContaining({
        operation: 'video_technical_params',
        schema: expect.objectContaining({
          type: 'object',
          required: ['camera', 'lighting', 'color', 'format', 'audio', 'postProduction'],
        }),
      })
    );
  });

  it('returns empty params on LLM failure', async () => {
    const { service } = createService();
    vi.spyOn(StructuredOutputEnforcer, 'enforceJSON').mockRejectedValue(new Error('timeout'));

    const result = await service.generateTechnicalParams({
      elements: { subject: 'person' },
    });

    expect(result.technicalParams).toEqual({});
  });

  it('filters out empty elements from the prompt', async () => {
    const { service } = createService();
    const enforceSpy = vi.spyOn(StructuredOutputEnforcer, 'enforceJSON').mockResolvedValue({});

    await service.generateTechnicalParams({
      elements: { subject: 'dancer', action: '', location: 'stage', mood: '' },
    });

    const promptArg = enforceSpy.mock.calls[0]![1] as string;
    expect(promptArg).toContain('subject: dancer');
    expect(promptArg).toContain('location: stage');
    expect(promptArg).not.toContain('action:');
    expect(promptArg).not.toContain('mood:');
  });
});
