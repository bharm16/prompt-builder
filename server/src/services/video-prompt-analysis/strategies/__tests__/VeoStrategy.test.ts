import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VeoStrategy } from '../VeoStrategy';
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

const makeResult = (prompt: string | Record<string, unknown>): PromptOptimizationResult => ({
  prompt,
  metadata: {
    modelId: 'veo-4',
    pipelineVersion: '2.0.0',
    phases: [],
    warnings: [],
    tokensStripped: [],
    triggersInjected: [],
  },
});

const makeValidSchema = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  mode: 'generate',
  subject: { description: 'a mountain landscape', action: 'still' },
  camera: { type: 'wide', movement: 'static' },
  environment: { lighting: 'natural' },
  ...overrides,
});

describe('VeoStrategy', () => {
  let strategy: VeoStrategy;

  beforeEach(() => {
    strategy = new VeoStrategy();
    strategy.resetSessionState();
  });

  describe('validate - error handling', () => {
    it('throws on empty input', async () => {
      await expect(strategy.validate('')).rejects.toThrow('Input must be a non-empty string');
    });

    it('throws on whitespace-only input', async () => {
      await expect(strategy.validate('   ')).rejects.toThrow('Input cannot be empty or whitespace only');
    });

    it('does not throw for valid input', async () => {
      await expect(strategy.validate('a cinematic shot of a mountain')).resolves.toBeUndefined();
    });
  });

  describe('normalize - markdown stripping', () => {
    it('strips markdown headers but preserves text content', () => {
      const result = strategy.normalize('## Title\nSome prompt text');
      expect(result).not.toContain('##');
      expect(result).toContain('Title');
      expect(result).toContain('Some prompt text');
    });

    it('strips bold markdown but preserves inner text', () => {
      const result = strategy.normalize('a **bold** scene in the city');
      expect(result).not.toContain('**');
      expect(result).toContain('bold');
    });

    it('strips italic markdown but preserves inner text', () => {
      const result = strategy.normalize('an *italic* mood setting');
      expect(result).not.toContain('*italic*');
      expect(result).toContain('italic');
    });

    it('strips inline code backticks but preserves content', () => {
      const result = strategy.normalize('use `cinematic` style for this');
      expect(result).not.toContain('`');
      expect(result).toContain('cinematic');
    });
  });

  describe('normalize - conversational filler stripping', () => {
    it('strips "i want" filler', () => {
      const result = strategy.normalize('i want a cinematic sunrise over the ocean');
      expect(result.toLowerCase()).not.toMatch(/\bi want\b/);
      expect(result).toContain('cinematic');
      expect(result).toContain('sunrise');
    });

    it('strips "please create" filler', () => {
      const result = strategy.normalize('please create a dramatic scene');
      expect(result.toLowerCase()).not.toMatch(/\bplease create\b/);
      expect(result).toContain('dramatic');
    });

    it('strips "can you" filler', () => {
      const result = strategy.normalize('can you make a video of a bird');
      expect(result.toLowerCase()).not.toMatch(/\bcan you\b/);
      expect(result).toContain('bird');
    });

    it('strips "basically" filler', () => {
      const result = strategy.normalize('basically a car driving on a highway');
      expect(result.toLowerCase()).not.toMatch(/\bbasically\b/);
      expect(result).toContain('car');
    });

    it('strips "um" and "uh" fillers', () => {
      const result = strategy.normalize('um a sunset uh over the mountains');
      expect(result.toLowerCase()).not.toMatch(/\bum\b/);
      expect(result.toLowerCase()).not.toMatch(/\buh\b/);
      expect(result).toContain('sunset');
    });

    it('strips multiple fillers from a single input', () => {
      const result = strategy.normalize('i want to basically create a sunset');
      expect(result.toLowerCase()).not.toMatch(/\bi want\b/);
      expect(result.toLowerCase()).not.toMatch(/\bbasically\b/);
      expect(result).toContain('sunset');
    });
  });

  describe('augment - style_preset injection', () => {
    it('injects default "cinematic" style when no style keyword in prompt', () => {
      const schema = makeValidSchema({
        subject: { description: 'a plain white room', action: 'still' },
      });
      const result = strategy.augment(makeResult(schema));
      const output = result.prompt as Record<string, unknown>;
      expect(output.style_preset).toBe('cinematic');
    });

    it('detects "anime" keyword and injects anime preset', () => {
      const schema = makeValidSchema({
        subject: { description: 'an anime character running', action: 'running' },
      });
      const result = strategy.augment(makeResult(schema));
      const output = result.prompt as Record<string, unknown>;
      expect(output.style_preset).toBe('anime');
    });

    it('detects "documentary" keyword and injects documentary preset', () => {
      const schema = makeValidSchema({
        subject: { description: 'a documentary about wildlife', action: 'grazing' },
      });
      const result = strategy.augment(makeResult(schema));
      const output = result.prompt as Record<string, unknown>;
      expect(output.style_preset).toBe('documentary');
    });

    it('detects "noir" keyword and injects noir preset', () => {
      const schema = makeValidSchema({
        subject: { description: 'a noir detective scene', action: 'investigating' },
      });
      const result = strategy.augment(makeResult(schema));
      const output = result.prompt as Record<string, unknown>;
      expect(output.style_preset).toBe('noir');
    });

    it('preserves existing style_preset if already set', () => {
      const schema = makeValidSchema({ style_preset: 'horror' });
      const result = strategy.augment(makeResult(schema));
      const output = result.prompt as Record<string, unknown>;
      expect(output.style_preset).toBe('horror');
    });
  });

  describe('augment - brand_context injection', () => {
    it('injects brand colors when provided in apiParams', () => {
      const result = strategy.augment(makeResult(makeValidSchema()), {
        userIntent: 'test',
        apiParams: { brandColors: ['#FF0000', '#00FF00'] },
      });
      const output = result.prompt as Record<string, unknown>;
      const brand = output.brand_context as Record<string, unknown>;
      expect(brand.colors).toEqual(['#FF0000', '#00FF00']);
    });

    it('injects style guide when provided in apiParams', () => {
      const result = strategy.augment(makeResult(makeValidSchema()), {
        userIntent: 'test',
        apiParams: { styleGuide: 'minimalist corporate' },
      });
      const output = result.prompt as Record<string, unknown>;
      const brand = output.brand_context as Record<string, unknown>;
      expect(brand.style_guide).toBe('minimalist corporate');
    });

    it('does not inject brand_context when no brand params provided', () => {
      const result = strategy.augment(makeResult(makeValidSchema()));
      const output = result.prompt as Record<string, unknown>;
      expect(output.brand_context).toBeUndefined();
    });
  });

  describe('augment - non-JSON string fallback', () => {
    it('returns string as-is when prompt is unparseable string', () => {
      const result = strategy.augment(makeResult('not valid json at all'));
      expect(result.prompt).toBe('not valid json at all');
    });

    it('includes change note about inability to augment in augment result changes', () => {
      strategy.normalize('not json');
      const result = strategy.augment(makeResult('not json'));
      const augPhase = result.metadata.phases.find(p => p.phase === 'augment');
      expect(augPhase).toBeDefined();
      expect(augPhase?.changes.some(c => c.includes('Could not augment'))).toBe(true);
    });
  });

  describe('session state management', () => {
    it('stores schema when sessionId provided in apiParams', () => {
      strategy.augment(makeResult(makeValidSchema()), {
        userIntent: 'test',
        apiParams: { sessionId: 'sess-123' },
      });
      const stored = strategy.getSessionState('sess-123');
      expect(stored).toBeDefined();
      expect(stored?.mode).toBe('generate');
    });

    it('returns undefined for unknown session ID', () => {
      expect(strategy.getSessionState('nonexistent')).toBeUndefined();
    });

    it('resetSessionState clears all sessions', () => {
      strategy.augment(makeResult(makeValidSchema()), {
        userIntent: 'test',
        apiParams: { sessionId: 'sess-456' },
      });
      strategy.resetSessionState();
      expect(strategy.getSessionState('sess-456')).toBeUndefined();
    });

    it('does not store schema when sessionId not provided', () => {
      strategy.augment(makeResult(makeValidSchema()), {
        userIntent: 'test',
      });
      // No way to check without sessionId, but should not throw
      expect(strategy.getSessionState('undefined')).toBeUndefined();
    });

    it('overwrites schema for same sessionId on subsequent calls', () => {
      const ctx = { userIntent: 'test', apiParams: { sessionId: 'sess-789' } };
      strategy.augment(makeResult(makeValidSchema({ mode: 'generate' })), ctx);
      strategy.augment(makeResult(makeValidSchema({ mode: 'edit' })), ctx);
      const stored = strategy.getSessionState('sess-789');
      expect(stored?.mode).toBe('edit');
    });
  });

  describe('isValidSchema', () => {
    it('returns true for valid minimal schema', () => {
      expect(strategy.isValidSchema({
        subject: { description: 'test', action: 'walk' },
        camera: { type: 'wide', movement: 'pan' },
        environment: { lighting: 'natural' },
      })).toBe(true);
    });

    it('returns false for null', () => {
      expect(strategy.isValidSchema(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(strategy.isValidSchema(undefined)).toBe(false);
    });

    it('returns false for non-object (string)', () => {
      expect(strategy.isValidSchema('string')).toBe(false);
    });

    it('returns false for non-object (number)', () => {
      expect(strategy.isValidSchema(42)).toBe(false);
    });

    it('returns false when subject is missing', () => {
      expect(strategy.isValidSchema({
        camera: { type: 'wide', movement: 'pan' },
        environment: { lighting: 'natural' },
      })).toBe(false);
    });

    it('returns false when camera is missing', () => {
      expect(strategy.isValidSchema({
        subject: { description: 'test', action: 'walk' },
        environment: { lighting: 'natural' },
      })).toBe(false);
    });

    it('returns false when environment is missing', () => {
      expect(strategy.isValidSchema({
        subject: { description: 'test', action: 'walk' },
        camera: { type: 'wide', movement: 'pan' },
      })).toBe(false);
    });

    it('returns false when subject.description is not a string', () => {
      expect(strategy.isValidSchema({
        subject: { description: 123, action: 'walk' },
        camera: { type: 'wide', movement: 'pan' },
        environment: { lighting: 'natural' },
      })).toBe(false);
    });

    it('returns false when subject.action is not a string', () => {
      expect(strategy.isValidSchema({
        subject: { description: 'test', action: null },
        camera: { type: 'wide', movement: 'pan' },
        environment: { lighting: 'natural' },
      })).toBe(false);
    });

    it('returns false when camera.type is not a string', () => {
      expect(strategy.isValidSchema({
        subject: { description: 'test', action: 'walk' },
        camera: { type: 42, movement: 'pan' },
        environment: { lighting: 'natural' },
      })).toBe(false);
    });

    it('returns false when camera.movement is not a string', () => {
      expect(strategy.isValidSchema({
        subject: { description: 'test', action: 'walk' },
        camera: { type: 'wide', movement: null },
        environment: { lighting: 'natural' },
      })).toBe(false);
    });

    it('returns false when environment.lighting is not a string', () => {
      expect(strategy.isValidSchema({
        subject: { description: 'test', action: 'walk' },
        camera: { type: 'wide', movement: 'pan' },
        environment: { lighting: 42 },
      })).toBe(false);
    });

    it('returns false when subject is not an object', () => {
      expect(strategy.isValidSchema({
        subject: 'not an object',
        camera: { type: 'wide', movement: 'pan' },
        environment: { lighting: 'natural' },
      })).toBe(false);
    });

    it('returns true for schema with optional fields', () => {
      expect(strategy.isValidSchema({
        mode: 'generate',
        subject: { description: 'test', action: 'walk' },
        camera: { type: 'wide', movement: 'pan' },
        environment: { lighting: 'natural', weather: 'sunny', setting: 'outdoor' },
        style_preset: 'cinematic',
        audio: { dialogue: 'hello' },
      })).toBe(true);
    });
  });

  describe('identity', () => {
    it('has correct modelId', () => {
      expect(strategy.modelId).toBe('veo-4');
    });

    it('has correct modelName', () => {
      expect(strategy.modelName).toBe('Google Veo 4');
    });
  });
});
