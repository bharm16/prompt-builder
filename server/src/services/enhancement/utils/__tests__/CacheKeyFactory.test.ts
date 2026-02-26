import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CacheKeyFactory, type EnhancementCacheParams } from '../CacheKeyFactory';

describe('CacheKeyFactory', () => {
  const mockGenerateKey = vi.fn((namespace: string, data: Record<string, unknown>) => `${namespace}:${JSON.stringify(data)}`);
  const mockCacheService = { generateKey: mockGenerateKey };
  const createBaseParams = (): EnhancementCacheParams => ({
    highlightedText: 'test highlight',
    contextBefore: 'before context',
    contextAfter: 'after context',
    fullPrompt: 'This is the full prompt text',
    originalUserPrompt: 'original user prompt',
    isVideoPrompt: true,
    brainstormSignature: null,
    highlightedCategory: 'action',
    highlightWordCount: 2,
    phraseRole: 'action.movement',
    videoConstraints: null,
    editHistory: [],
    modelTarget: 'runway-gen3',
    promptSection: 'main',
    spanFingerprint: null,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('handles null brainstormSignature', () => {
      const params = createBaseParams();
      params.brainstormSignature = null;

      const result = CacheKeyFactory.generateKey('test', params, mockCacheService as never);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('handles null videoConstraints', () => {
      const params = createBaseParams();
      params.videoConstraints = null;

      const result = CacheKeyFactory.generateKey('test', params, mockCacheService as never);

      expect(result).toBeDefined();
    });

    it('handles null highlightedCategory', () => {
      const params = createBaseParams();
      params.highlightedCategory = null;

      const result = CacheKeyFactory.generateKey('test', params, mockCacheService as never);

      expect(result).toBeDefined();
    });

    it('handles null phraseRole', () => {
      const params = createBaseParams();
      params.phraseRole = null;

      const result = CacheKeyFactory.generateKey('test', params, mockCacheService as never);

      expect(result).toBeDefined();
    });

    it('handles null modelTarget', () => {
      const params = createBaseParams();
      params.modelTarget = null;

      const result = CacheKeyFactory.generateKey('test', params, mockCacheService as never);

      expect(result).toBeDefined();
    });

    it('handles null promptSection', () => {
      const params = createBaseParams();
      params.promptSection = null;

      const result = CacheKeyFactory.generateKey('test', params, mockCacheService as never);

      expect(result).toBeDefined();
    });

    it('handles undefined fullPrompt', () => {
      const params = createBaseParams();
      (params as unknown as { fullPrompt: undefined }).fullPrompt = undefined;

      const result = CacheKeyFactory.generateKey('test', params, mockCacheService as never);

      expect(result).toBeDefined();
    });

    it('handles undefined originalUserPrompt', () => {
      const params = createBaseParams();
      (params as unknown as { originalUserPrompt: undefined }).originalUserPrompt = undefined;

      const result = CacheKeyFactory.generateKey('test', params, mockCacheService as never);

      expect(result).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('handles empty editHistory', () => {
      const params = createBaseParams();
      params.editHistory = [];

      const result = CacheKeyFactory.generateKey('test', params, mockCacheService as never);

      expect(result).toContain('"editFingerprint":null');
    });

    it('handles single edit in history', () => {
      const params = createBaseParams();
      params.editHistory = [
        { category: 'action', original: 'running', replacement: 'walking' },
      ];

      const result = CacheKeyFactory.generateKey('test', params, mockCacheService as never);

      expect(result).toContain('editFingerprint');
      expect(result).toContain('action:running');
    });

    it('limits edit fingerprint to last 5 edits', () => {
      const params = createBaseParams();
      params.editHistory = [
        { category: 'a', original: '1111111111111', replacement: 'x' },
        { category: 'b', original: '2222222222222', replacement: 'x' },
        { category: 'c', original: '3333333333333', replacement: 'x' },
        { category: 'd', original: '4444444444444', replacement: 'x' },
        { category: 'e', original: '5555555555555', replacement: 'x' },
        { category: 'f', original: '6666666666666', replacement: 'x' },
        { category: 'g', original: '7777777777777', replacement: 'x' },
      ];

      const result = CacheKeyFactory.generateKey('test', params, mockCacheService as never);

      // Should only contain last 5 (c through g)
      expect(result).not.toContain('a:1111111111');
      expect(result).not.toContain('b:2222222222');
      expect(result).toContain('c:3333333333');
    });

    it('truncates original text in edit fingerprint to 10 chars', () => {
      const params = createBaseParams();
      params.editHistory = [
        { category: 'action', original: 'very long original text here', replacement: 'x' },
      ];

      const result = CacheKeyFactory.generateKey('test', params, mockCacheService as never);

      // Should contain truncated version
      expect(result).toContain('action:very long ');
      expect(result).not.toContain('very long original text here');
    });

    it('handles edit history with null category', () => {
      const params = createBaseParams();
      params.editHistory = [
        { category: null as unknown as string, original: 'test', replacement: 'x' },
      ];

      const result = CacheKeyFactory.generateKey('test', params, mockCacheService as never);

      expect(result).toContain('n:test');
    });

    it('handles edit history with undefined original', () => {
      const params = createBaseParams();
      params.editHistory = [
        { category: 'action', original: undefined as unknown as string, replacement: 'x' },
      ];

      const result = CacheKeyFactory.generateKey('test', params, mockCacheService as never);

      expect(result).toContain('action:');
    });

    it('handles very long fullPrompt by truncating', async () => {
      const params = createBaseParams();
      params.fullPrompt = 'x'.repeat(10000);

      CacheKeyFactory.generateKey('test', params, mockCacheService as never);

      // The mock captures the call - verify truncation happened
      const mockCalls = mockGenerateKey.mock.calls;
      const mockCall = mockCalls[mockCalls.length - 1]?.[1] as { fullPrompt?: string } | undefined;

      expect(mockCall?.fullPrompt?.length).toBeLessThan(10000);
    });

    it('handles very long originalUserPrompt by truncating', async () => {
      const params = createBaseParams();
      params.originalUserPrompt = 'y'.repeat(1000);

      CacheKeyFactory.generateKey('test', params, mockCacheService as never);

      const mockCalls = mockGenerateKey.mock.calls;
      const mockCall = mockCalls[mockCalls.length - 1]?.[1] as { originalUserPrompt?: string } | undefined;

      expect(mockCall?.originalUserPrompt?.length).toBeLessThanOrEqual(500);
    });
  });

  describe('core behavior', () => {
    it('generates key with correct namespace', () => {
      const params = createBaseParams();

      const result = CacheKeyFactory.generateKey('enhancement', params, mockCacheService as never);

      expect(result).toContain('enhancement:');
    });

    it('includes highlightedText in key', () => {
      const params = createBaseParams();
      params.highlightedText = 'unique text';

      const result = CacheKeyFactory.generateKey('test', params, mockCacheService as never);

      expect(result).toContain('unique text');
    });

    it('includes context in key', () => {
      const params = createBaseParams();
      params.contextBefore = 'before context here';
      params.contextAfter = 'after context here';

      const result = CacheKeyFactory.generateKey('test', params, mockCacheService as never);

      expect(result).toContain('before context here');
      expect(result).toContain('after context here');
    });

    it('includes isVideoPrompt flag', () => {
      const params = createBaseParams();
      params.isVideoPrompt = true;

      const result = CacheKeyFactory.generateKey('test', params, mockCacheService as never);

      expect(result).toContain('"isVideoPrompt":true');
    });

    it('includes videoConstraintMode when videoConstraints provided', () => {
      const params = createBaseParams();
      params.videoConstraints = { mode: 'strict', model: 'test' } as never;

      const result = CacheKeyFactory.generateKey('test', params, mockCacheService as never);

      expect(result).toContain('"videoConstraintMode":"strict"');
    });

    it('includes spanFingerprint when provided', () => {
      const params = createBaseParams();
      params.spanFingerprint = 'abc123';

      const result = CacheKeyFactory.generateKey('test', params, mockCacheService as never);

      expect(result).toContain('"spanFingerprint":"abc123"');
    });

    it('includes highlightWordCount', () => {
      const params = createBaseParams();
      params.highlightWordCount = 5;

      const result = CacheKeyFactory.generateKey('test', params, mockCacheService as never);

      expect(result).toContain('"highlightWordCount":5');
    });

    it('generates different keys for different params', () => {
      const params1 = createBaseParams();
      params1.highlightedText = 'text one';

      const params2 = createBaseParams();
      params2.highlightedText = 'text two';

      const key1 = CacheKeyFactory.generateKey('test', params1, mockCacheService as never);
      const key2 = CacheKeyFactory.generateKey('test', params2, mockCacheService as never);

      expect(key1).not.toBe(key2);
    });

    it('generates same key for same params', () => {
      const params1 = createBaseParams();
      const params2 = createBaseParams();

      const key1 = CacheKeyFactory.generateKey('test', params1, mockCacheService as never);
      const key2 = CacheKeyFactory.generateKey('test', params2, mockCacheService as never);

      expect(key1).toBe(key2);
    });
  });

  describe('edit fingerprint generation', () => {
    it('creates pipe-separated fingerprint from edits', () => {
      const params = createBaseParams();
      params.editHistory = [
        { category: 'action', original: 'run', replacement: 'walk' },
        { category: 'subject', original: 'dog', replacement: 'cat' },
      ];

      const result = CacheKeyFactory.generateKey('test', params, mockCacheService as never);

      expect(result).toContain('action:run|subject:dog');
    });

    it('uses "n" for null categories in fingerprint', () => {
      const params = createBaseParams();
      params.editHistory = [
        { category: null as unknown as string, original: 'test', replacement: 'x' },
      ];

      const result = CacheKeyFactory.generateKey('test', params, mockCacheService as never);

      expect(result).toContain('n:test');
    });

    it('creates fingerprint only from last 5 edits for performance', () => {
      const params = createBaseParams();
      params.editHistory = Array.from({ length: 10 }, (_, i) => ({
        category: `cat${i}`,
        original: `orig${i}`,
        replacement: 'x',
      }));

      const result = CacheKeyFactory.generateKey('test', params, mockCacheService as never);

      // Should only have edits 5-9 (last 5)
      expect(result).not.toContain('cat0');
      expect(result).not.toContain('cat4');
      expect(result).toContain('cat5');
      expect(result).toContain('cat9');
    });
  });
});
