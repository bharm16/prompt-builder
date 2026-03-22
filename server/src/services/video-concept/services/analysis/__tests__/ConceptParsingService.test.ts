import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AIService } from '@services/prompt-optimization/types';
import { StructuredOutputEnforcer } from '@utils/StructuredOutputEnforcer';
import { ConceptParsingService } from '../ConceptParsingService';

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

const createService = (): { service: ConceptParsingService; aiService: AIService } => {
  const aiService = {
    execute: vi.fn(),
  } as unknown as AIService;

  return {
    service: new ConceptParsingService(aiService),
    aiService,
  };
};

describe('ConceptParsingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses a concept into structured elements via LLM', async () => {
    const { service } = createService();
    const mockElements = {
      subject: 'a lone astronaut',
      action: 'floating weightlessly',
      location: 'inside a space station',
      time: 'near future',
      mood: 'isolation and wonder',
      style: 'cinematic sci-fi',
      event: 'first contact',
    };

    vi.spyOn(StructuredOutputEnforcer, 'enforceJSON').mockResolvedValue(mockElements);

    const result = await service.parseConcept({ concept: 'An astronaut discovers alien life on a space station' });

    expect(result.elements).toEqual(mockElements);
    expect(StructuredOutputEnforcer.enforceJSON).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('An astronaut discovers alien life'),
      expect.objectContaining({
        operation: 'video_concept_parsing',
        schema: expect.objectContaining({
          type: 'object',
          required: ['subject', 'action', 'location', 'time', 'mood', 'style', 'event'],
        }),
      })
    );
  });

  it('returns empty elements on LLM failure', async () => {
    const { service } = createService();
    vi.spyOn(StructuredOutputEnforcer, 'enforceJSON').mockRejectedValue(new Error('LLM timeout'));

    const result = await service.parseConcept({ concept: 'test concept' });

    expect(result.elements).toEqual({
      subject: '',
      action: '',
      location: '',
      time: '',
      mood: '',
      style: '',
      event: '',
    });
  });
});
