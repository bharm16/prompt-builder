import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SoraStrategy } from '../SoraStrategy';
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
    modelId: 'sora-2',
    pipelineVersion: '2.0.0',
    phases: [],
    warnings: [],
    tokensStripped: [],
    triggersInjected: [],
  },
});

describe('SoraStrategy', () => {
  let strategy: SoraStrategy;

  beforeEach(() => {
    strategy = new SoraStrategy();
  });

  describe('validate - error handling', () => {
    it('throws on empty input', async () => {
      await expect(strategy.validate('')).rejects.toThrow('Input must be a non-empty string');
    });

    it('throws on whitespace-only input', async () => {
      await expect(strategy.validate('   ')).rejects.toThrow('Input cannot be empty or whitespace only');
    });

    it('does not throw for valid input', async () => {
      await expect(strategy.validate('a ball bouncing on a table')).resolves.toBeUndefined();
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

  describe('normalize - whitespace cleanup only', () => {
    it('cleans up excessive whitespace', () => {
      const result = strategy.normalize('  too   many    spaces  ');
      expect(result).not.toMatch(/\s{2,}/);
      expect(result).toContain('too');
      expect(result).toContain('many');
      expect(result).toContain('spaces');
    });

    it('preserves all content words (no stripping logic)', () => {
      const input = 'a person floating in space with zero gravity effects';
      const result = strategy.normalize(input);
      expect(result).toContain('person');
      expect(result).toContain('floating');
      expect(result).toContain('space');
    });

    it('trims leading and trailing whitespace', () => {
      const result = strategy.normalize('   hello world   ');
      expect(result).toBe('hello world');
    });
  });

  describe('augment - physics trigger injection for physics content', () => {
    it('injects all three physics triggers when "bouncing" is present', () => {
      const input = makeResult('A ball bouncing off a wall');
      const result = strategy.augment(input);
      const prompt = result.prompt as string;

      expect(prompt).toContain('Newtonian physics');
      expect(prompt).toContain('momentum conservation');
      expect(prompt).toContain('surface friction');
    });

    it('injects physics triggers when "falling" is present', () => {
      const input = makeResult('A glass falling from the table');
      const result = strategy.augment(input);
      const prompt = result.prompt as string;

      expect(prompt).toContain('Newtonian physics');
    });

    it('injects physics triggers when "crash" is present', () => {
      const input = makeResult('Two cars crash into each other');
      const result = strategy.augment(input);
      const prompt = result.prompt as string;

      expect(prompt).toContain('Newtonian physics');
      expect(prompt).toContain('momentum conservation');
    });

    it('injects physics triggers when "rolling" is present', () => {
      const input = makeResult('A marble rolling across the floor');
      const result = strategy.augment(input);
      const prompt = result.prompt as string;

      expect(prompt).toContain('Newtonian physics');
    });

    it('injects physics triggers when "throwing" is present', () => {
      const input = makeResult('A person throwing a ball');
      const result = strategy.augment(input);
      const prompt = result.prompt as string;

      expect(prompt).toContain('Newtonian physics');
    });
  });

  describe('augment - "realistic physics" fallback for non-physics content', () => {
    it('injects "realistic physics" when no physics content detected', () => {
      const input = makeResult('A sunset over calm waters');
      const result = strategy.augment(input);
      const prompt = result.prompt as string;

      expect(prompt).toContain('realistic physics');
      expect(prompt).not.toContain('Newtonian physics');
      expect(prompt).not.toContain('momentum conservation');
    });

    it('injects "realistic physics" for purely descriptive prompts', () => {
      const input = makeResult('A beautiful garden with flowers swaying');
      const result = strategy.augment(input);
      const prompt = result.prompt as string;

      expect(prompt).toContain('realistic physics');
    });
  });

  describe('augment - deduplication of existing triggers', () => {
    it('does not duplicate "Newtonian physics" if already present', () => {
      const input = makeResult('A ball falls with Newtonian physics and momentum conservation and surface friction');
      const result = strategy.augment(input);
      const prompt = result.prompt as string;

      const newtonianCount = (prompt.match(/Newtonian physics/g) || []).length;
      expect(newtonianCount).toBe(1);
    });

    it('does not duplicate "realistic physics" if already present', () => {
      const input = makeResult('A calm scene with realistic physics');
      const result = strategy.augment(input);
      const prompt = result.prompt as string;

      const count = (prompt.match(/realistic physics/g) || []).length;
      expect(count).toBe(1);
    });
  });

  describe('augment - response_format metadata', () => {
    it('always includes response_format in triggersInjected', () => {
      strategy.normalize('any prompt');
      const result = strategy.augment(makeResult('any prompt'));
      expect(result.metadata.triggersInjected).toContain('response_format: json_object');
    });

    it('includes response_format for physics prompts too', () => {
      strategy.normalize('a ball bouncing');
      const result = strategy.augment(makeResult('a ball bouncing'));
      expect(result.metadata.triggersInjected).toContain('response_format: json_object');
    });
  });

  describe('extractCameoTokens', () => {
    it('extracts single @Cameo token', () => {
      const tokens = strategy.extractCameoTokens('Use @Cameo(user123) in this scene');
      expect(tokens).toEqual(['@Cameo(user123)']);
    });

    it('extracts multiple @Cameo tokens', () => {
      const tokens = strategy.extractCameoTokens('@Cameo(actor1) and @Cameo(actor2) walk together');
      expect(tokens).toHaveLength(2);
      expect(tokens[0]).toBe('@Cameo(actor1)');
      expect(tokens[1]).toBe('@Cameo(actor2)');
    });

    it('returns empty array when no @Cameo tokens present', () => {
      const tokens = strategy.extractCameoTokens('A simple scene with no references');
      expect(tokens).toEqual([]);
    });

    it('returns empty array for empty string', () => {
      const tokens = strategy.extractCameoTokens('');
      expect(tokens).toEqual([]);
    });

    it('extracts token with complex ID', () => {
      const tokens = strategy.extractCameoTokens('Show @Cameo(user_abc-123) walking');
      expect(tokens).toEqual(['@Cameo(user_abc-123)']);
    });
  });

  describe('identity', () => {
    it('has correct modelId', () => {
      expect(strategy.modelId).toBe('sora-2');
    });

    it('has correct modelName', () => {
      expect(strategy.modelName).toBe('OpenAI Sora 2');
    });
  });
});
