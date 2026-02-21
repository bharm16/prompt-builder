import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RunwayStrategy } from '../RunwayStrategy';
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
    modelId: 'runway-gen45',
    pipelineVersion: '2.0.0',
    phases: [],
    warnings: [],
    tokensStripped: [],
    triggersInjected: [],
  },
});

describe('RunwayStrategy', () => {
  let strategy: RunwayStrategy;

  beforeEach(() => {
    strategy = new RunwayStrategy();
  });

  describe('validate - error handling', () => {
    it('throws on empty input', async () => {
      await expect(strategy.validate('')).rejects.toThrow('Input must be a non-empty string');
    });

    it('throws on whitespace-only input', async () => {
      await expect(strategy.validate('  \n ')).rejects.toThrow('Input cannot be empty or whitespace only');
    });

    it('does not throw for valid prompt', async () => {
      await expect(strategy.validate('a car drives through city streets')).resolves.toBeUndefined();
    });

    it('does not throw for supported aspect ratio', async () => {
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
  });

  describe('normalize - morphing/blur term stripping', () => {
    it('strips "morphing" from standard prompts', () => {
      const result = strategy.normalize('a face morphing into another face');
      expect(result).not.toMatch(/\bmorphing\b/i);
    });

    it('strips "blurry" from standard prompts', () => {
      const result = strategy.normalize('a blurry background with detail');
      expect(result).not.toMatch(/\bblurry\b/i);
    });

    it('strips "hazy" from standard prompts', () => {
      const result = strategy.normalize('a hazy morning landscape');
      expect(result).not.toMatch(/\bhazy\b/i);
    });

    it('strips "warped" from standard prompts', () => {
      const result = strategy.normalize('a warped perspective shot');
      expect(result).not.toMatch(/\bwarped\b/i);
    });

    it('strips "foggy" from standard prompts', () => {
      const result = strategy.normalize('a foggy valley at dawn');
      expect(result).not.toMatch(/\bfoggy\b/i);
    });

    it('strips "misty" from standard prompts', () => {
      const result = strategy.normalize('a misty forest path');
      expect(result).not.toMatch(/\bmisty\b/i);
    });

    it('strips "distorted" from standard prompts', () => {
      const result = strategy.normalize('a distorted reflection in water');
      expect(result).not.toMatch(/\bdistorted\b/i);
    });

    it('strips multiple terms in one pass', () => {
      const result = strategy.normalize('a foggy misty hazy valley');
      expect(result).not.toMatch(/\bfoggy\b/i);
      expect(result).not.toMatch(/\bmisty\b/i);
      expect(result).not.toMatch(/\bhazy\b/i);
    });
  });

  describe('normalize - preserves blur/morph when explicit style request', () => {
    it('preserves blur when "style: blur" pattern detected', () => {
      const result = strategy.normalize('style: artistic blur on the edges');
      expect(result).toContain('blur');
    });

    it('preserves morph when "intentional morph" pattern detected', () => {
      const result = strategy.normalize('intentional morph transition between scenes');
      expect(result).toContain('morph');
    });

    it('preserves blur when "blur effect" pattern detected', () => {
      const result = strategy.normalize('apply a blur effect to the background');
      expect(result).toContain('blur');
    });

    it('preserves morph when "blur aesthetic" pattern detected', () => {
      const result = strategy.normalize('this has a blur aesthetic quality');
      expect(result).toContain('blur');
    });
  });

  describe('normalize - preserves non-morphing content', () => {
    it('preserves non-morphing terms', () => {
      const result = strategy.normalize('a sharp cinematic tracking shot of a runner');
      expect(result).toContain('sharp');
      expect(result).toContain('cinematic');
      expect(result).toContain('runner');
    });
  });

  describe('transform - fallback behavior', () => {
    it('falls back deterministically when LLM rewrite fails', async () => {
      const fallbackStrategy = new RunwayStrategy({
        analyzer: {
          analyze: vi.fn(async () => ({
            subjects: [],
            actions: [],
            camera: { movements: [] },
            environment: { setting: '', lighting: [] },
            audio: {},
            meta: { mood: [], style: [] },
            technical: {},
            raw: 'fallback raw prompt',
          })),
        } as never,
        llmRewriter: {
          rewrite: vi.fn(async () => {
            throw new Error('gateway unavailable');
          }),
        } as never,
      });

      fallbackStrategy.normalize('fallback raw prompt');
      const transformed = await fallbackStrategy.transform('fallback raw prompt');

      expect(typeof transformed.prompt).toBe('string');
      expect(transformed.metadata.warnings.some((warning) => warning.includes('LLM rewrite unavailable'))).toBe(true);
    });
  });

  describe('augment - mandatory stability behavior', () => {
    it('injects mandatory stability constraints when missing', () => {
      const input = makeResult('Dolly in: A woman walks through a garden');
      const result = strategy.augment(input);
      expect(result.prompt).toContain('Dolly in: A woman walks through a garden');
      expect(result.prompt).toContain('single continuous shot');
      expect(result.prompt).toContain('fluid motion');
      expect(result.prompt).toContain('consistent geometry');
    });

    it('records injected triggers', () => {
      strategy.normalize('test');
      const result = strategy.augment(makeResult('test'));
      expect(result.metadata.triggersInjected).toEqual(
        expect.arrayContaining(['single continuous shot', 'fluid motion', 'consistent geometry'])
      );
    });

    it('records augment phase with constraint changes', () => {
      strategy.normalize('test');
      const result = strategy.augment(makeResult('test'));
      const augPhase = result.metadata.phases.find(p => p.phase === 'augment');
      expect(augPhase).toBeDefined();
      expect(augPhase?.changes).toEqual(
        expect.arrayContaining([
          'Injected mandatory constraint: "single continuous shot"',
          'Injected mandatory constraint: "fluid motion"',
          'Injected mandatory constraint: "consistent geometry"',
        ])
      );
    });
  });

  describe('identity', () => {
    it('has correct modelId', () => {
      expect(strategy.modelId).toBe('runway-gen45');
    });

    it('has correct modelName', () => {
      expect(strategy.modelName).toBe('Runway Gen-4.5');
    });
  });
});
