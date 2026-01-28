import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TAXONOMY } from '#shared/taxonomy';
import type { AIService, InputSpan, LabeledSpan } from '../types';

const cacheMocks = vi.hoisted(() => ({
  getCachedLabels: vi.fn(),
  setCachedLabels: vi.fn(),
  hashKey: vi.fn(() => 'hash-key'),
}));

const parserMocks = vi.hoisted(() => ({
  safeParseJSON: vi.fn(),
}));

const validatorMocks = vi.hoisted(() => ({
  validate: vi.fn(),
  ROLE_SET: new Set(['subject']),
}));

const warnSpy = vi.hoisted(() => vi.fn());

vi.mock('../roleClassifierCache', () => ({
  getCachedLabels: cacheMocks.getCachedLabels,
  setCachedLabels: cacheMocks.setCachedLabels,
  hashKey: cacheMocks.hashKey,
}));

vi.mock('../roleClassifierParser', () => ({
  safeParseJSON: parserMocks.safeParseJSON,
}));

vi.mock('../roleClassifierValidator', () => ({
  validate: validatorMocks.validate,
  ROLE_SET: validatorMocks.ROLE_SET,
}));

vi.mock('@infrastructure/Logger', () => ({
  logger: {
    child: () => ({ warn: warnSpy }),
  },
}));

import { roleClassify } from '../roleClassifier';

describe('roleClassify', () => {
  const spans: InputSpan[] = [
    { text: 'cat', start: 0, end: 3 },
    { text: 'runs', start: 4, end: 8 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    cacheMocks.getCachedLabels.mockReturnValue(undefined);
  });

  describe('error handling', () => {
    it('throws when aiService is missing', async () => {
      await expect(roleClassify(spans, 'v1', undefined as unknown as AIService)).rejects.toThrow(
        'aiService is required'
      );
    });

    it('falls back to deterministic labels when AI service fails', async () => {
      const aiService = {
        execute: vi.fn(async () => {
          throw new Error('LLM down');
        }),
      } as unknown as AIService;

      const result = await roleClassify(spans, 'v1', aiService);

      expect(result).toEqual([
        { ...spans[0], role: TAXONOMY.SUBJECT.id, confidence: 0 },
        { ...spans[1], role: TAXONOMY.SUBJECT.id, confidence: 0 },
      ]);
      expect(warnSpy).toHaveBeenCalledWith(
        'roleClassify fallback to deterministic labels',
        expect.objectContaining({ error: 'LLM down' })
      );
      expect(parserMocks.safeParseJSON).not.toHaveBeenCalled();
      expect(validatorMocks.validate).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('returns cached labels without calling the AI service', async () => {
      const cached: LabeledSpan[] = [
        { text: 'cat', start: 0, end: 3, role: 'subject', confidence: 0.9 },
      ];
      cacheMocks.getCachedLabels.mockReturnValue(cached);

      const aiService = { execute: vi.fn() } as unknown as AIService;
      const result = await roleClassify(spans, 'v1', aiService);

      expect(result).toBe(cached);
      expect(aiService.execute).not.toHaveBeenCalled();
      expect(parserMocks.safeParseJSON).not.toHaveBeenCalled();
      expect(validatorMocks.validate).not.toHaveBeenCalled();
    });
  });

  describe('core behavior', () => {
    it('executes the AI service, validates, and caches labels', async () => {
      const aiService = {
        execute: vi.fn(async () => ({ text: '{"spans": []}', metadata: {} })),
      } as unknown as AIService;

      parserMocks.safeParseJSON.mockReturnValue({ spans: [] });
      const labeled: LabeledSpan[] = [
        { text: 'cat', start: 0, end: 3, role: 'subject', confidence: 0.8 },
      ];
      validatorMocks.validate.mockReturnValue(labeled);

      const result = await roleClassify(spans, 'v1', aiService);

      expect(cacheMocks.hashKey).toHaveBeenCalledWith(spans, 'v1');
      expect(aiService.execute).toHaveBeenCalledWith('role_classification', expect.any(Object));
      expect(parserMocks.safeParseJSON).toHaveBeenCalledWith('{"spans": []}');
      expect(validatorMocks.validate).toHaveBeenCalledWith(spans, []);
      expect(cacheMocks.setCachedLabels).toHaveBeenCalledWith('hash-key', labeled);
      expect(result).toEqual(labeled);
    });
  });
});
