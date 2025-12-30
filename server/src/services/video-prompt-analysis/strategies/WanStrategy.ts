/**
 * WanStrategy - Prompt optimization for Wan 2.2 (Alibaba)
 *
 * Implements optimization for Wan's architecture.
 * Supports dual-text (Chinese/English) prompting for maximum adherence.
 *
 * Key features:
 * - Bilingual (English + Chinese) prompt generation for key visual elements
 * - Optimized for 1080p 30fps native generation
 * - Native support for variable aspect ratios (21:9, 16:9, 9:16)
 *
 * @module WanStrategy
 */

import {
  BaseStrategy,
  type NormalizeResult,
  type TransformResult,
  type AugmentResult,
} from './BaseStrategy';
import type { PromptOptimizationResult, PromptContext, VideoPromptIR } from './types';

/**
 * Technical triggers for Wan 2.x high-fidelity generation
 */
const WAN_TRIGGERS = [
  'ultra-high definition',
  '1080p 30fps',
  'masterpiece',
  'highly detailed',
  'cinematic motion',
] as const;

/**
 * WanStrategy optimizes prompts for Alibaba's Wan 2.2 series
 */
export class WanStrategy extends BaseStrategy {
  readonly modelId = 'wan-2.2';
  readonly modelName = 'Wan 2.2';

  /**
   * Validate input against Wan-specific constraints
   */
  protected async doValidate(input: string, context?: PromptContext): Promise<void> {
    // Check for aspect ratio constraints if provided
    if (context?.constraints?.formRequirement) {
      const aspectRatio = context.constraints.formRequirement;
      const validAspectRatios = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'];
      if (!validAspectRatios.includes(aspectRatio)) {
        this.addWarning(`Aspect ratio "${aspectRatio}" may not be supported by Wan; recommended ratios are 16:9, 9:16, 21:9`);
      }
    }

    // Check for very long prompts
    const wordCount = input.split(/\s+/).length;
    if (wordCount > 300) {
      this.addWarning('Prompt exceeds 300 words; Wan may truncate or ignore excess content');
    }
  }

  /**
   * Normalize input by cleaning up redundant tech tokens handled by TechStripper
   */
  protected doNormalize(input: string, _context?: PromptContext): NormalizeResult {
    const text = this.cleanWhitespace(input);
    return { 
      text, 
      changes: [], 
      strippedTokens: [] 
    };
  }

  /**
   * Final adjustments after LLM rewrite
   * Wan benefits from bilingual prompts (English/Chinese)
   */
  protected doTransform(llmPrompt: string | Record<string, unknown>, _ir: VideoPromptIR, _context?: PromptContext): TransformResult {
    const changes: string[] = [];
    const prompt = typeof llmPrompt === 'string' ? llmPrompt : JSON.stringify(llmPrompt);

    if (prompt.includes('(') && prompt.includes(')')) {
      changes.push('Bilingual (EN/ZH) structure detected for enhanced adherence');
    }

    return { prompt, changes };
  }

  /**
   * Augment result with Wan-specific quality triggers
   */
  protected doAugment(
    result: PromptOptimizationResult,
    _context?: PromptContext
  ): AugmentResult {
    const changes: string[] = [];
    const triggersInjected: string[] = [];

    let prompt = typeof result.prompt === 'string' ? result.prompt : JSON.stringify(result.prompt);

    // Inject Wan-specific triggers
    for (const trigger of WAN_TRIGGERS) {
      if (!prompt.toLowerCase().includes(trigger.toLowerCase())) {
        prompt = `${prompt}, ${trigger}`;
        triggersInjected.push(trigger);
        changes.push(`Injected Wan quality trigger: "${trigger}"`);
      }
    }

    // Clean up final prompt
    prompt = this.cleanWhitespace(prompt);

    return {
      prompt,
      changes,
      triggersInjected,
    };
  }
}

/**
 * Singleton instance for convenience
 */
export const wanStrategy = new WanStrategy();
