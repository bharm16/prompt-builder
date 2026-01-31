import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LumaStrategy } from '../LumaStrategy';
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

const makeResult = (prompt: string): PromptOptimizationResult => ({
  prompt,
  metadata: {
    modelId: 'luma-ray3',
    pipelineVersion: '2.0.0',
    phases: [],
    warnings: [],
    tokensStripped: [],
    triggersInjected: [],
  },
});

describe('LumaStrategy', () => {
  let strategy: LumaStrategy;

  beforeEach(() => {
    strategy = new LumaStrategy();
  });

  describe('validate - error handling', () => {
    it('throws on empty input', async () => {
      await expect(strategy.validate('')).rejects.toThrow('Input must be a non-empty string');
    });

    it('throws on whitespace-only input', async () => {
      await expect(strategy.validate('   ')).rejects.toThrow('Input cannot be empty or whitespace only');
    });

    it('does not throw for valid input without context', async () => {
      await expect(strategy.validate('a bird flies over the ocean')).resolves.toBeUndefined();
    });

    it('does not throw for supported aspect ratio', async () => {
      await expect(
        strategy.validate('test', {
          userIntent: 'test',
          constraints: {
            mode: 'enhance', minWords: 1, maxWords: 100, maxSentences: 5,
            slotDescriptor: 'test', formRequirement: '21:9',
          },
        })
      ).resolves.toBeUndefined();
    });
  });

  describe('normalize - loop term stripping when loop:true', () => {
    it('strips "loop" when loop:true is active', () => {
      const result = strategy.normalize('a seamless loop of a spinning top', {
        userIntent: 'test',
        apiParams: { loop: true },
      });
      expect(result).not.toMatch(/\bloop\b/i);
    });

    it('strips "seamless" when loop:true is active', () => {
      const result = strategy.normalize('a seamless animation of waves', {
        userIntent: 'test',
        apiParams: { loop: true },
      });
      expect(result).not.toMatch(/\bseamless\b/i);
    });

    it('strips "endless" when loop:true is active', () => {
      const result = strategy.normalize('an endless flowing river', {
        userIntent: 'test',
        apiParams: { loop: true },
      });
      expect(result).not.toMatch(/\bendless\b/i);
    });

    it('strips "infinite" when loop:true is active', () => {
      const result = strategy.normalize('an infinite zoom effect', {
        userIntent: 'test',
        apiParams: { loop: true },
      });
      expect(result).not.toMatch(/\binfinite\b/i);
    });

    it('strips "looping" when loop:true is active', () => {
      const result = strategy.normalize('a looping pattern of colors', {
        userIntent: 'test',
        apiParams: { loop: true },
      });
      expect(result).not.toMatch(/\blooping\b/i);
    });

    it('strips multiple loop terms in a single pass', () => {
      const result = strategy.normalize(
        'a seamless looping infinite animation',
        { userIntent: 'test', apiParams: { loop: true } }
      );
      expect(result).not.toMatch(/\bseamless\b/i);
      expect(result).not.toMatch(/\blooping\b/i);
      expect(result).not.toMatch(/\binfinite\b/i);
    });
  });

  describe('normalize - preserves loop terms when loop flag is absent or false', () => {
    it('preserves "loop" when no apiParams provided', () => {
      const result = strategy.normalize('create a perfect loop animation');
      expect(result).toContain('loop');
    });

    it('preserves "loop" when apiParams.loop is false', () => {
      const result = strategy.normalize('a seamless loop video', {
        userIntent: 'test',
        apiParams: { loop: false },
      });
      expect(result).toContain('loop');
      expect(result).toContain('seamless');
    });

    it('preserves "seamless" when loop flag not set', () => {
      const result = strategy.normalize('seamless transition between scenes');
      expect(result).toContain('seamless');
    });
  });

  describe('normalize - preserves non-loop content', () => {
    it('returns input mostly unchanged when no loop flag', () => {
      const input = 'a cat sits on a wall in golden hour light';
      const result = strategy.normalize(input);
      expect(result).toContain('cat');
      expect(result).toContain('golden hour');
      expect(result).toContain('wall');
    });
  });

  describe('augment - passthrough behavior', () => {
    it('returns prompt unchanged (HDR triggers delegated to LLM)', () => {
      const input = makeResult('A sunset over mountains with dramatic lighting');
      const result = strategy.augment(input);
      expect(result.prompt).toBe('A sunset over mountains with dramatic lighting');
    });

    it('returns empty triggersInjected', () => {
      const input = makeResult('test');
      const result = strategy.augment(input);
      expect(result.metadata.triggersInjected).toEqual([]);
    });

    it('records augment phase with empty changes', () => {
      strategy.normalize('test');
      const input = makeResult('test');
      const result = strategy.augment(input);
      const augPhase = result.metadata.phases.find(p => p.phase === 'augment');
      expect(augPhase).toBeDefined();
      expect(augPhase?.changes).toEqual([]);
    });
  });

  describe('identity', () => {
    it('has correct modelId', () => {
      expect(strategy.modelId).toBe('luma-ray3');
    });

    it('has correct modelName', () => {
      expect(strategy.modelName).toBe('Luma Ray-3');
    });
  });
});
