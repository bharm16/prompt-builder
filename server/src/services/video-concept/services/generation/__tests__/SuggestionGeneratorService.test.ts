import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AIService } from '@services/prompt-optimization/types';
import type { CacheService } from '@services/cache/CacheService';
import type { PreferenceRepository } from '@services/video-concept/repositories/PreferenceRepository';
import { StructuredOutputEnforcer } from '@utils/StructuredOutputEnforcer';
import { SuggestionGeneratorService, type Suggestion } from '../SuggestionGeneratorService';

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

vi.mock('@utils/TemperatureOptimizer', () => ({
  TemperatureOptimizer: {
    getOptimalTemperature: vi.fn(() => 0.8),
  },
}));

const mockBuildSystemPrompt = vi.fn(() => 'mocked system prompt');

vi.mock('../SystemPromptBuilder.ts', () => {
  return {
    PromptBuilderService: class {
      buildSystemPrompt = mockBuildSystemPrompt;
    },
  };
});

vi.mock('#shared/taxonomy.ts', () => ({
  TAXONOMY: {
    SUBJECT: { id: 'subject', attributes: { ACTION: 'action' } },
    ENVIRONMENT: { attributes: { LOCATION: 'location', CONTEXT: 'context' } },
    LIGHTING: { attributes: { TIME: 'time' } },
    STYLE: { id: 'style', attributes: { AESTHETIC: 'aesthetic' } },
  },
}));

interface CompatibilityService {
  filterBySemanticCompatibility: ReturnType<typeof vi.fn>;
}

const createService = (): {
  service: SuggestionGeneratorService;
  aiService: AIService;
  cacheService: CacheService;
  preferenceRepository: PreferenceRepository;
  compatibilityService: CompatibilityService;
} => {
  const aiService = {
    execute: vi.fn(),
  } as unknown as AIService;

  const cacheService = {
    getConfig: vi.fn(() => ({ ttl: 300, namespace: 'creative' })),
    generateKey: vi.fn(() => 'test-cache-key'),
    get: vi.fn(() => null),
    set: vi.fn(),
  } as unknown as CacheService;

  const preferenceRepository = {
    getPreferences: vi.fn(() => null),
  } as unknown as PreferenceRepository;

  const compatibilityService = {
    filterBySemanticCompatibility: vi.fn((suggestions: Suggestion[]) => suggestions),
  };

  return {
    service: new SuggestionGeneratorService(
      aiService,
      cacheService,
      preferenceRepository,
      compatibilityService as unknown as ConstructorParameters<typeof SuggestionGeneratorService>[3]
    ),
    aiService,
    cacheService,
    preferenceRepository,
    compatibilityService,
  };
};

describe('SuggestionGeneratorService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns cached suggestions on cache hit', async () => {
    const { service, cacheService } = createService();
    const cachedResult = {
      suggestions: [
        { text: 'dramatic sunset', explanation: 'warm tones' },
      ],
    };
    vi.mocked(cacheService.get).mockResolvedValue(cachedResult);
    const enforceSpy = vi.spyOn(StructuredOutputEnforcer, 'enforceJSON');

    const result = await service.getCreativeSuggestions({
      elementType: 'mood',
    });

    expect(result).toEqual(cachedResult);
    expect(enforceSpy).not.toHaveBeenCalled();
  });

  it('generates suggestions via LLM, filters, and caches', async () => {
    const { service, cacheService, compatibilityService } = createService();
    const mockSuggestions: Suggestion[] = [
      { text: 'tense and brooding', explanation: 'dark atmosphere' },
      { text: 'peaceful and serene', explanation: 'calm atmosphere' },
    ];
    vi.spyOn(StructuredOutputEnforcer, 'enforceJSON').mockResolvedValue(mockSuggestions);

    const result = await service.getCreativeSuggestions({
      elementType: 'mood',
      context: { subject: 'detective', location: 'alley' },
      concept: 'film noir mystery',
    });

    expect(result.suggestions).toHaveLength(2);
    expect(compatibilityService.filterBySemanticCompatibility).toHaveBeenCalled();
    expect(cacheService.set).toHaveBeenCalled();
  });

  it('normalizes subjectDescriptor field names', async () => {
    const { service } = createService();
    vi.spyOn(StructuredOutputEnforcer, 'enforceJSON').mockResolvedValue([]);

    await service.getCreativeSuggestions({
      elementType: 'subjectDescriptor1',
    });

    // Should resolve without errors — the normalizedElementType should be 'subjectDescriptor'
    expect(StructuredOutputEnforcer.enforceJSON).toHaveBeenCalled();
  });

  it('ranks by user preferences when available', async () => {
    const { service, preferenceRepository } = createService();
    vi.mocked(preferenceRepository.getPreferences).mockResolvedValue({
      chosen: ['dark moody'],
      rejected: ['bright happy'],
    });

    const mockSuggestions: Suggestion[] = [
      { text: 'bright happy sunshine', explanation: 'cheerful' },
      { text: 'dark moody atmosphere', explanation: 'noir' },
    ];
    vi.spyOn(StructuredOutputEnforcer, 'enforceJSON').mockResolvedValue(mockSuggestions);

    const result = await service.getCreativeSuggestions({
      elementType: 'mood',
      userId: 'user-1',
    });

    // dark moody should rank higher due to preference match
    expect(result.suggestions[0]!.text).toContain('dark moody');
  });

  it('generates alternative phrasings', async () => {
    const { service } = createService();
    const mockAlternatives = [
      { text: 'sprinting across', tone: 'formal' },
      { text: 'dashing through', tone: 'casual' },
    ];
    vi.spyOn(StructuredOutputEnforcer, 'enforceJSON').mockResolvedValue(mockAlternatives);

    const result = await service.getAlternativePhrasings({
      elementType: 'action',
      value: 'running across',
    });

    expect(result.alternatives).toEqual(mockAlternatives);
  });

  it('returns empty alternatives on LLM failure', async () => {
    const { service } = createService();
    vi.spyOn(StructuredOutputEnforcer, 'enforceJSON').mockRejectedValue(new Error('timeout'));

    const result = await service.getAlternativePhrasings({
      elementType: 'action',
      value: 'running',
    });

    expect(result.alternatives).toEqual([]);
  });
});
