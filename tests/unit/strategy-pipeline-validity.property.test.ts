/**
 * Property-based tests for Strategy Pipeline Validity
 *
 * Tests the following correctness property:
 * - Property 2: Strategy Pipeline Validity
 *
 * For any PromptOptimizationStrategy implementation and any valid input string,
 * executing the full pipeline (normalize → transform → augment) SHALL produce
 * a valid PromptOptimizationResult with non-null prompt field and populated metadata.
 *
 * @module strategy-pipeline-validity.property.test
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

import {
  StrategyRegistry,
  BaseStrategy,
  type PromptOptimizationStrategy,
  type PromptOptimizationResult,
  type PromptContext,
  type NormalizeResult,
  type TransformResult,
  type AugmentResult,
  type VideoPromptIR,
} from '../../server/src/services/video-prompt-analysis/strategies';

class StubAnalyzer {
  async analyze(text: string): Promise<VideoPromptIR> {
    return {
      subjects: [],
      actions: [],
      camera: { movements: [] },
      environment: { setting: '', lighting: [] },
      audio: {},
      meta: { mood: [], style: [] },
      technical: {},
      raw: text,
    };
  }
}

class StubRewriter {
  async rewrite(ir: VideoPromptIR): Promise<string> {
    return ir.raw;
  }
}

/**
 * Mock strategy implementation for testing pipeline validity
 * This represents a minimal valid strategy that follows the interface contract
 */
class MockStrategy implements PromptOptimizationStrategy {
  readonly modelId: string;
  readonly modelName: string;

  constructor(modelId: string, modelName: string) {
    this.modelId = modelId;
    this.modelName = modelName;
  }

  async validate(_input: string, _context?: PromptContext): Promise<void> {
    // No-op validation for mock
  }

  normalize(input: string, _context?: PromptContext): string {
    // Simple normalization: trim whitespace
    return input.trim();
  }

  async transform(input: string, _context?: PromptContext): Promise<PromptOptimizationResult> {
    return {
      prompt: input,
      metadata: {
        modelId: this.modelId,
        pipelineVersion: '1.0.0',
        phases: [
          { phase: 'normalize', durationMs: 1, changes: ['trimmed whitespace'] },
          { phase: 'transform', durationMs: 1, changes: ['identity transform'] },
        ],
        warnings: [],
        tokensStripped: [],
        triggersInjected: [],
      },
    };
  }

  augment(
    result: PromptOptimizationResult,
    _context?: PromptContext
  ): PromptOptimizationResult {
    const augmentedResult = { ...result };
    augmentedResult.metadata = {
      ...result.metadata,
      phases: [
        ...result.metadata.phases,
        { phase: 'augment' as const, durationMs: 1, changes: ['added trigger'] },
      ],
      triggersInjected: ['mock-trigger'],
    };
    return augmentedResult;
  }
}

/**
 * Execute the full pipeline for a strategy
 */
async function executePipeline(
  strategy: PromptOptimizationStrategy,
  input: string,
  context?: PromptContext
): Promise<PromptOptimizationResult> {
  // Phase 0: Validate
  await strategy.validate(input, context);

  // Phase 1: Normalize
  const normalized = strategy.normalize(input, context);

  // Phase 2: Transform
  const transformed = await strategy.transform(normalized, context);

  // Phase 3: Augment
  const augmented = strategy.augment(transformed, context);

  return augmented;
}

describe('Strategy Pipeline Validity Property Tests', () => {
  /**
   * Property 2: Strategy Pipeline Validity
   *
   * For any PromptOptimizationStrategy implementation and any valid input string,
   * executing the full pipeline (normalize → transform → augment) SHALL produce
   * a valid PromptOptimizationResult with non-null prompt field and populated metadata.
   *
   * **Feature: video-model-optimization, Property 2: Strategy Pipeline Validity**
   * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**
   */
  describe('Property 2: Strategy Pipeline Validity', () => {
    it('pipeline produces valid result with non-null prompt for any input', async () => {
      const strategy = new MockStrategy('mock-model', 'Mock Model');

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 500 }),
          async (input) => {
            const result = await executePipeline(strategy, input);

            // Result must have non-null prompt
            expect(result.prompt).not.toBeNull();
            expect(result.prompt).not.toBeUndefined();

            // Prompt must be string or object
            expect(
              typeof result.prompt === 'string' ||
                typeof result.prompt === 'object'
            ).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('pipeline produces result with populated metadata', async () => {
      const strategy = new MockStrategy('mock-model', 'Mock Model');

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 500 }),
          async (input) => {
            const result = await executePipeline(strategy, input);

            // Metadata must exist
            expect(result.metadata).toBeDefined();

            // Metadata must have required fields
            expect(result.metadata.modelId).toBe('mock-model');
            expect(result.metadata.pipelineVersion).toBeDefined();
            expect(Array.isArray(result.metadata.phases)).toBe(true);
            expect(Array.isArray(result.metadata.warnings)).toBe(true);
            expect(Array.isArray(result.metadata.tokensStripped)).toBe(true);
            expect(Array.isArray(result.metadata.triggersInjected)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('pipeline executes all three phases in order', async () => {
      const strategy = new MockStrategy('mock-model', 'Mock Model');

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 500 }),
          async (input) => {
            const result = await executePipeline(strategy, input);

            // Must have at least 3 phases
            expect(result.metadata.phases.length).toBeGreaterThanOrEqual(3);

            // Phases must be in correct order
            const phaseNames = result.metadata.phases.map((p) => p.phase);
            expect(phaseNames).toContain('normalize');
            expect(phaseNames).toContain('transform');
            expect(phaseNames).toContain('augment');

            // Normalize must come before transform
            const normalizeIndex = phaseNames.indexOf('normalize');
            const transformIndex = phaseNames.indexOf('transform');
            const augmentIndex = phaseNames.indexOf('augment');

            expect(normalizeIndex).toBeLessThan(transformIndex);
            expect(transformIndex).toBeLessThan(augmentIndex);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('pipeline handles whitespace-only input gracefully', async () => {
      const strategy = new MockStrategy('mock-model', 'Mock Model');

      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 1, maxLength: 20 }),
          async (whitespaceChars) => {
            const whitespaceInput = whitespaceChars.join('');
            const result = await executePipeline(strategy, whitespaceInput);

            // Should still produce valid result
            expect(result.prompt).not.toBeNull();
            expect(result.metadata).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('pipeline handles special characters in input', async () => {
      const strategy = new MockStrategy('mock-model', 'Mock Model');

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 200 }),
          fc.constantFrom(
            '!@#$%^&*()',
            '<>{}[]',
            '"\'`',
            '\\/',
            '\n\t\r',
            '🎬🎥📹'
          ),
          async (baseInput, specialChars) => {
            const input = baseInput + specialChars;
            const result = await executePipeline(strategy, input);

            // Should still produce valid result
            expect(result.prompt).not.toBeNull();
            expect(result.metadata).toBeDefined();
            expect(result.metadata.modelId).toBe('mock-model');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

describe('StrategyRegistry Integration', () => {
    it('registered strategies can be retrieved and executed', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
          fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
          fc.string({ minLength: 1, maxLength: 200 }),
          async (modelId, modelName, input) => {
            const registry = new StrategyRegistry();
            const strategy = new MockStrategy(modelId, modelName);

            registry.register(strategy);

            // Strategy should be retrievable
            const retrieved = registry.get(modelId);
            expect(retrieved).toBeDefined();
            expect(retrieved?.modelId).toBe(modelId);

            // Retrieved strategy should execute pipeline correctly
            if (retrieved) {
              const result = await executePipeline(retrieved, input);
              expect(result.prompt).not.toBeNull();
              expect(result.metadata.modelId).toBe(modelId);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('registry correctly reports has() for registered strategies', () => {
      fc.assert(
        fc.property(
          fc.uniqueArray(
            fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
            { minLength: 1, maxLength: 10 }
          ),
          fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
          (modelIds, unregisteredId) => {
            // Ensure unregisteredId is not in modelIds
            fc.pre(!modelIds.includes(unregisteredId));

            const registry = new StrategyRegistry();

            // Register all strategies
            for (const modelId of modelIds) {
              registry.register(new MockStrategy(modelId, `Model ${modelId}`));
            }

            // has() should return true for registered
            for (const modelId of modelIds) {
              expect(registry.has(modelId)).toBe(true);
            }

            // has() should return false for unregistered
            expect(registry.has(unregisteredId)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('registry getAll() returns all registered strategies', () => {
      fc.assert(
        fc.property(
          fc.uniqueArray(
            fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
            { minLength: 1, maxLength: 10 }
          ),
          (modelIds) => {
            const registry = new StrategyRegistry();

            // Register all strategies
            for (const modelId of modelIds) {
              registry.register(new MockStrategy(modelId, `Model ${modelId}`));
            }

            // getAll() should return all strategies
            const allStrategies = registry.getAll();
            expect(allStrategies.length).toBe(modelIds.length);

            // All model IDs should be present
            const retrievedIds = allStrategies.map((s) => s.modelId);
            for (const modelId of modelIds) {
              expect(retrievedIds).toContain(modelId);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('registry throws on duplicate registration', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
          (modelId) => {
            const registry = new StrategyRegistry();
            const strategy1 = new MockStrategy(modelId, 'Model 1');
            const strategy2 = new MockStrategy(modelId, 'Model 2');

            // First registration should succeed
            registry.register(strategy1);

            // Second registration with same modelId should throw
            expect(() => registry.register(strategy2)).toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});


/**
 * Concrete implementation of BaseStrategy for testing
 * This tests that BaseStrategy correctly integrates TechStripper and SafetySanitizer
 */
class TestBaseStrategy extends BaseStrategy {
  readonly modelId = 'runway-gen45'; // Use runway to test tech stripping
  readonly modelName = 'Test Runway Strategy';

  protected async doValidate(_input: string, _context?: PromptContext): Promise<void> {
    // No additional validation for test
  }

  protected doNormalize(input: string, _context?: PromptContext): NormalizeResult {
    // Simple model-specific normalization: remove "vibe" terms
    let text = input;
    const changes: string[] = [];
    const strippedTokens: string[] = [];

    if (text.toLowerCase().includes('vibe')) {
      text = text.replace(/\bvibe\b/gi, '');
      text = this.cleanWhitespace(text);
      changes.push('Stripped "vibe" term');
      strippedTokens.push('vibe');
    }

    return { text, changes, strippedTokens };
  }

  protected doTransform(
    llmPrompt: string | Record<string, unknown>,
    ir: VideoPromptIR,
    _context?: PromptContext
  ): TransformResult {
    const basePrompt = typeof llmPrompt === 'string' ? llmPrompt : ir.raw;
    // Simple transformation: wrap in CSAE structure using IR raw
    return {
      prompt: `[Camera] [Subject] ${basePrompt} [Environment]`,
      changes: ['Applied CSAE structure'],
    };
  }

  protected doAugment(
    result: PromptOptimizationResult,
    _context?: PromptContext
  ): AugmentResult {
    // Simple augmentation: add trigger
    const prompt = typeof result.prompt === 'string'
      ? `${result.prompt}, single continuous shot`
      : result.prompt;
    const augmentResult: AugmentResult = {
      prompt,
      changes: ['Added continuous shot trigger'],
      triggersInjected: ['single continuous shot'],
    };
    if (typeof result.negativePrompt === 'string') {
      augmentResult.negativePrompt = result.negativePrompt;
    }
    return augmentResult;
  }
}

/**
 * Concrete implementation for Kling model (keeps placebo tokens)
 */
class TestKlingStrategy extends BaseStrategy {
  readonly modelId = 'kling-26';
  readonly modelName = 'Test Kling Strategy';

  protected async doValidate(_input: string, _context?: PromptContext): Promise<void> {
    // No additional validation
  }

  protected doNormalize(input: string, _context?: PromptContext): NormalizeResult {
    return { text: input, changes: [], strippedTokens: [] };
  }

  protected doTransform(
    llmPrompt: string | Record<string, unknown>,
    ir: VideoPromptIR,
    _context?: PromptContext
  ): TransformResult {
    const basePrompt = typeof llmPrompt === 'string' ? llmPrompt : ir.raw;
    return {
      prompt: basePrompt,
      changes: ['Identity transform'],
    };
  }

  protected doAugment(
    result: PromptOptimizationResult,
    _context?: PromptContext
  ): AugmentResult {
    const augmentResult: AugmentResult = {
      prompt: result.prompt,
      changes: [],
      triggersInjected: [],
    };
    if (typeof result.negativePrompt === 'string') {
      augmentResult.negativePrompt = result.negativePrompt;
    }
    return augmentResult;
  }
}

describe('BaseStrategy Implementation Tests', () => {
  /**
   * Tests that BaseStrategy correctly integrates TechStripper
   * For Runway model, placebo tokens should be stripped
   */
  describe('TechStripper Integration', () => {
    it('strips placebo tokens for Runway model', async () => {
      const strategy = new TestBaseStrategy(
        undefined,
        undefined,
        new StubAnalyzer(),
        new StubRewriter()
      );

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          async (baseInput) => {
            const inputWithPlacebo = `${baseInput} 4k trending on artstation`;
            const normalized = strategy.normalize(inputWithPlacebo);
            const transformed = await strategy.transform(normalized);
            const output = typeof transformed.prompt === 'string'
              ? transformed.prompt
              : JSON.stringify(transformed.prompt);

            // Placebo tokens should be stripped for Runway
            expect(output.toLowerCase()).not.toContain('4k');
            expect(output.toLowerCase()).not.toContain('trending on artstation');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('preserves placebo tokens for Kling model', async () => {
      const strategy = new TestKlingStrategy(
        undefined,
        undefined,
        new StubAnalyzer(),
        new StubRewriter()
      );

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          async (baseInput) => {
            const inputWithPlacebo = `${baseInput} 4k trending on artstation`;
            const normalized = strategy.normalize(inputWithPlacebo);
            const transformed = await strategy.transform(normalized);
            const output = typeof transformed.prompt === 'string'
              ? transformed.prompt
              : JSON.stringify(transformed.prompt);

            // Placebo tokens should be preserved for Kling
            expect(output.toLowerCase()).toContain('4k');
            expect(output.toLowerCase()).toContain('trending on artstation');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Tests that BaseStrategy correctly integrates SafetySanitizer
   */
  describe('SafetySanitizer Integration', () => {
    it('sanitizes celebrity names', async () => {
      const strategy = new TestBaseStrategy();

      const inputWithCelebrity = 'A video of Taylor Swift walking in the park';
      const normalized = strategy.normalize(inputWithCelebrity);

      // Celebrity name should be replaced
      expect(normalized.toLowerCase()).not.toContain('taylor swift');
      expect(normalized.toLowerCase()).toContain('pop star');
    });

    it('sanitizes NSFW terms', async () => {
      const strategy = new TestBaseStrategy();

      const inputWithNSFW = 'A video with nude content';
      const normalized = strategy.normalize(inputWithNSFW);

      // NSFW term should be replaced
      expect(normalized.toLowerCase()).not.toContain('nude');
      expect(normalized).toContain('[content removed]');
    });
  });

  /**
   * Tests that BaseStrategy correctly tracks metadata
   */
  describe('Metadata Tracking', () => {
    it('records stripped tokens in metadata', async () => {
      const strategy = new TestBaseStrategy();

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          async (baseInput) => {
            const inputWithPlacebo = `${baseInput} 4k award winning`;

            // Run full pipeline
            await strategy.validate(inputWithPlacebo);
            const normalized = strategy.normalize(inputWithPlacebo);
            const transformed = await strategy.transform(normalized);
            const result = strategy.augment(transformed);

            // Metadata should contain stripped tokens
            expect(result.metadata.tokensStripped.length).toBeGreaterThan(0);
            expect(result.metadata.tokensStripped.some(t => t.toLowerCase() === '4k')).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('records injected triggers in metadata', async () => {
      const strategy = new TestBaseStrategy();

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          async (input) => {
            // Run full pipeline
            await strategy.validate(input);
            const normalized = strategy.normalize(input);
            const transformed = await strategy.transform(normalized);
            const result = strategy.augment(transformed);

            // Metadata should contain injected triggers
            expect(result.metadata.triggersInjected).toContain('single continuous shot');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('records all three phases with timing', async () => {
      const strategy = new TestBaseStrategy();

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
          async (input) => {
            // Run full pipeline
            await strategy.validate(input);
            const normalized = strategy.normalize(input);
            const transformed = await strategy.transform(normalized);
            const result = strategy.augment(transformed);

            // Should have all three phases
            expect(result.metadata.phases.length).toBe(3);

            const phaseNames = result.metadata.phases.map(p => p.phase);
            expect(phaseNames).toEqual(['normalize', 'transform', 'augment']);

            // Each phase should have timing
            for (const phase of result.metadata.phases) {
              expect(typeof phase.durationMs).toBe('number');
              expect(phase.durationMs).toBeGreaterThanOrEqual(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('sets correct modelId and pipelineVersion', async () => {
      const strategy = new TestBaseStrategy();

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          async (input) => {
            // Run full pipeline
            await strategy.validate(input);
            const normalized = strategy.normalize(input);
            const transformed = await strategy.transform(normalized);
            const result = strategy.augment(transformed);

            expect(result.metadata.modelId).toBe('runway-gen45');
            expect(result.metadata.pipelineVersion).toBe('1.0.0');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Tests that BaseStrategy validation works correctly
   */
  describe('Validation', () => {
    it('throws on empty input', async () => {
      const strategy = new TestBaseStrategy();

      await expect(strategy.validate('')).rejects.toThrow();
    });

    it('throws on whitespace-only input', async () => {
      const strategy = new TestBaseStrategy();

      await expect(strategy.validate('   ')).rejects.toThrow();
      await expect(strategy.validate('\t\n')).rejects.toThrow();
    });

    it('accepts valid non-empty input', async () => {
      const strategy = new TestBaseStrategy();

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          async (input) => {
            // Should not throw
            await strategy.validate(input);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Tests full pipeline execution with BaseStrategy
   */
  describe('Full Pipeline Execution', () => {
    it('produces valid result for any non-empty input', async () => {
      const strategy = new TestBaseStrategy();

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
          async (input) => {
            const result = await executePipeline(strategy, input);

            // Result must have non-null prompt
            expect(result.prompt).not.toBeNull();
            expect(result.prompt).not.toBeUndefined();

            // Metadata must be populated
            expect(result.metadata).toBeDefined();
            expect(result.metadata.modelId).toBe('runway-gen45');
            expect(result.metadata.phases.length).toBe(3);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
