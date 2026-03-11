import { describe, expect, it } from 'vitest';
import {
  BaseStrategy,
  type AugmentResult,
  type NormalizeResult,
  type TransformResult,
} from '../BaseStrategy';
import type { PromptContext, PromptOptimizationResult, VideoPromptIR } from '../types';

class BudgetPreservingStrategy extends BaseStrategy {
  readonly modelId = 'budget-test';
  readonly modelName = 'Budget Test';

  getModelConstraints() {
    return {
      wordLimits: { min: 1, max: 12 },
      triggerBudgetWords: 4,
    };
  }

  protected async doValidate(_input: string, _context?: PromptContext): Promise<void> {}

  protected doNormalize(input: string): NormalizeResult {
    return { text: input, changes: [], strippedTokens: [] };
  }

  protected doTransform(
    llmPrompt: string | Record<string, unknown>,
    _ir: VideoPromptIR
  ): TransformResult {
    return {
      prompt: typeof llmPrompt === 'string' ? llmPrompt : JSON.stringify(llmPrompt),
      changes: [],
    };
  }

  protected doAugment(result: PromptOptimizationResult): AugmentResult {
    const basePrompt = typeof result.prompt === 'string' ? result.prompt : JSON.stringify(result.prompt);
    const enforced = this.enforceMandatoryConstraints(basePrompt, [
      'natural speech',
      'synced lips',
    ]);

    return {
      prompt: enforced.prompt,
      changes: enforced.changes,
      triggersInjected: enforced.injected,
    };
  }
}

describe('regression: BaseStrategy budget enforcement preserves mandatory triggers', () => {
  it('trims the body instead of dropping injected triggers when the prompt exceeds the word budget', () => {
    const strategy = new BudgetPreservingStrategy();
    strategy.normalize('warmup');

    const longBody = new Array(20).fill('detail').join(' ');
    const result = strategy.augment({
      prompt: longBody,
      metadata: {
        modelId: 'budget-test',
        pipelineVersion: '2.0.0',
        phases: [],
        warnings: [],
        tokensStripped: [],
        triggersInjected: [],
      },
    });

    const prompt = result.prompt as string;
    expect(prompt).toContain('natural speech');
    expect(prompt).toContain('synced lips');
    expect(prompt.trim().split(/\s+/).length).toBeLessThanOrEqual(12);
    expect(result.metadata.triggersInjected).toEqual(['natural speech', 'synced lips']);
  });
});
