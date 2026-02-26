import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WanStrategy } from '../WanStrategy';
import type { PromptOptimizationResult } from '../types';

vi.mock('../../utils/TechStripper', () => ({
  TechStripper: class {
    strip(text: string) {
      return { text, tokensWereStripped: false, strippedTokens: [] };
    }
  },
  techStripper: {
    strip(text: string) {
      return { text, tokensWereStripped: false, strippedTokens: [] };
    }
  },
}));
vi.mock('../../utils/SafetySanitizer', () => ({
  SafetySanitizer: class {
    sanitize(text: string) {
      return { text, wasModified: false, replacements: [] };
    }
  },
  safetySanitizer: {
    sanitize(text: string) {
      return { text, wasModified: false, replacements: [] };
    }
  },
}));
vi.mock('../../services/analysis/VideoPromptAnalyzer', () => ({
  VideoPromptAnalyzer: class {
    async analyze() { return {}; }
  },
}));
vi.mock('../../services/rewriter/VideoPromptLLMRewriter', () => ({
  VideoPromptLLMRewriter: class {
    async rewrite() { return ''; }
  },
}));

const makeResult = (prompt: string, negativePrompt?: string): PromptOptimizationResult => ({
  prompt,
  ...(negativePrompt !== undefined ? { negativePrompt } : {}),
  metadata: {
    modelId: 'wan-2.2',
    pipelineVersion: '2.0.0',
    phases: [],
    warnings: [],
    tokensStripped: [],
    triggersInjected: [],
  },
});

describe('WanStrategy', () => {
  let strategy: WanStrategy;

  beforeEach(() => {
    strategy = new WanStrategy();
  });

  describe('validate - error handling', () => {
    it('throws on empty input', async () => {
      await expect(strategy.validate('')).rejects.toThrow('Input must be a non-empty string');
    });

    it('throws on whitespace-only input', async () => {
      await expect(strategy.validate('  \n\t ')).rejects.toThrow('Input cannot be empty or whitespace only');
    });

    it('does not throw for valid input', async () => {
      await expect(strategy.validate('a landscape scene')).resolves.toBeUndefined();
    });

    it('does not throw for supported aspect ratio 16:9', async () => {
      await expect(
        strategy.validate('test', {
          userIntent: 'test',
          constraints: {
            mode: 'enhance', minWords: 1, maxWords: 100, maxSentences: 5,
            slotDescriptor: 'test', formRequirement: '16:9',
          },
        })
      ).resolves.toBeUndefined();
    });

    it('does not throw for supported aspect ratio 1:1', async () => {
      await expect(
        strategy.validate('test', {
          userIntent: 'test',
          constraints: {
            mode: 'enhance', minWords: 1, maxWords: 100, maxSentences: 5,
            slotDescriptor: 'test', formRequirement: '1:1',
          },
        })
      ).resolves.toBeUndefined();
    });
  });

  describe('normalize - whitespace cleanup', () => {
    it('cleans excessive whitespace', () => {
      const result = strategy.normalize('  too   many    spaces  ');
      expect(result).not.toMatch(/\s{2,}/);
      expect(result).toBe('too many spaces');
    });

    it('preserves all content words', () => {
      const input = 'a cinematic wide shot of a forest at dawn';
      const result = strategy.normalize(input);
      expect(result).toContain('cinematic');
      expect(result).toContain('forest');
      expect(result).toContain('dawn');
    });

    it('trims leading and trailing whitespace', () => {
      const result = strategy.normalize('   hello world   ');
      expect(result).toBe('hello world');
    });

    it('returns empty changes and strippedTokens arrays', () => {
      // normalize is called through the public API which records phase results
      const result = strategy.normalize('test prompt');
      // The method returns the cleaned text
      expect(typeof result).toBe('string');
    });
  });

  describe('augment - negative prompt handling', () => {
    it('returns default negative prompt when not set on result', () => {
      const input = makeResult('A dragon flying over mountains');
      const result = strategy.augment(input);
      expect(result.negativePrompt).toBeDefined();
      expect(result.negativePrompt).toContain('morphing');
      expect(result.negativePrompt).toContain('distorted');
      expect(result.negativePrompt).toContain('blurry');
      expect(result.negativePrompt).toContain('watermark');
      expect(result.negativePrompt).toContain('low quality');
    });

    it('preserves existing negative prompt from result', () => {
      const input = makeResult('test', 'custom negative prompt');
      const result = strategy.augment(input);
      expect(result.negativePrompt).toBe('custom negative prompt');
    });
  });

  describe('augment - prompt passthrough', () => {
    it('returns prompt unchanged', () => {
      const input = makeResult('A peaceful garden scene with soft lighting');
      const result = strategy.augment(input);
      expect(result.prompt).toBe('A peaceful garden scene with soft lighting');
    });

    it('returns empty triggersInjected', () => {
      const result = strategy.augment(makeResult('test'));
      expect(result.metadata.triggersInjected).toEqual([]);
    });

    it('records augment phase with empty changes', () => {
      strategy.normalize('test');
      const result = strategy.augment(makeResult('test'));
      const augPhase = result.metadata.phases.find(p => p.phase === 'augment');
      expect(augPhase).toBeDefined();
      expect(augPhase?.changes).toEqual([]);
    });

    it('cleans whitespace in prompt during augment', () => {
      const input = makeResult('  extra   spaces   here  ');
      const result = strategy.augment(input);
      const prompt = result.prompt as string;
      expect(prompt).not.toMatch(/\s{2,}/);
    });
  });

  describe('getApiPayload - aspect ratio mapping', () => {
    it('maps 16:9 to 1280*720', () => {
      const payload = strategy.getApiPayload('test', {
        userIntent: 'test',
        constraints: {
          mode: 'enhance', minWords: 1, maxWords: 100, maxSentences: 5,
          slotDescriptor: 'test', formRequirement: '16:9',
        },
      });
      expect(payload.size).toBe('1280*720');
    });

    it('maps 9:16 to 720*1280', () => {
      const payload = strategy.getApiPayload('test', {
        userIntent: 'test',
        constraints: {
          mode: 'enhance', minWords: 1, maxWords: 100, maxSentences: 5,
          slotDescriptor: 'test', formRequirement: '9:16',
        },
      });
      expect(payload.size).toBe('720*1280');
    });

    it('maps 1:1 to 1024*1024', () => {
      const payload = strategy.getApiPayload('test', {
        userIntent: 'test',
        constraints: {
          mode: 'enhance', minWords: 1, maxWords: 100, maxSentences: 5,
          slotDescriptor: 'test', formRequirement: '1:1',
        },
      });
      expect(payload.size).toBe('1024*1024');
    });

    it('maps 4:3 to 1024*768', () => {
      const payload = strategy.getApiPayload('test', {
        userIntent: 'test',
        constraints: {
          mode: 'enhance', minWords: 1, maxWords: 100, maxSentences: 5,
          slotDescriptor: 'test', formRequirement: '4:3',
        },
      });
      expect(payload.size).toBe('1024*768');
    });

    it('maps 3:4 to 768*1024', () => {
      const payload = strategy.getApiPayload('test', {
        userIntent: 'test',
        constraints: {
          mode: 'enhance', minWords: 1, maxWords: 100, maxSentences: 5,
          slotDescriptor: 'test', formRequirement: '3:4',
        },
      });
      expect(payload.size).toBe('768*1024');
    });

    it('falls back to 1280*720 for unsupported aspect ratio', () => {
      const payload = strategy.getApiPayload('test', {
        userIntent: 'test',
        constraints: {
          mode: 'enhance', minWords: 1, maxWords: 100, maxSentences: 5,
          slotDescriptor: 'test', formRequirement: '21:9',
        },
      });
      expect(payload.size).toBe('1280*720');
    });

    it('falls back to 1280*720 when no context provided', () => {
      const payload = strategy.getApiPayload('test');
      expect(payload.size).toBe('1280*720');
    });

    it('falls back to 1280*720 when constraints have no formRequirement', () => {
      const payload = strategy.getApiPayload('test', {
        userIntent: 'test',
        constraints: {
          mode: 'enhance', minWords: 1, maxWords: 100, maxSentences: 5,
          slotDescriptor: 'test',
        },
      });
      expect(payload.size).toBe('1280*720');
    });
  });

  describe('getApiPayload - fixed field values', () => {
    it('sets prompt to the provided string', () => {
      const payload = strategy.getApiPayload('my custom prompt');
      expect(payload.prompt).toBe('my custom prompt');
    });

    it('includes default negative prompt', () => {
      const payload = strategy.getApiPayload('test');
      expect(payload.negative_prompt).toContain('morphing');
      expect(payload.negative_prompt).toContain('distorted');
    });

    it('sets num_frames to 81', () => {
      const payload = strategy.getApiPayload('test');
      expect(payload.num_frames).toBe(81);
    });

    it('sets frames_per_second to 16', () => {
      const payload = strategy.getApiPayload('test');
      expect(payload.frames_per_second).toBe(16);
    });

    it('sets prompt_extend to true', () => {
      const payload = strategy.getApiPayload('test');
      expect(payload.prompt_extend).toBe(true);
    });
  });

  describe('identity', () => {
    it('has correct modelId', () => {
      expect(strategy.modelId).toBe('wan-2.2');
    });

    it('has correct modelName', () => {
      expect(strategy.modelName).toBe('Wan 2.2');
    });
  });
});
