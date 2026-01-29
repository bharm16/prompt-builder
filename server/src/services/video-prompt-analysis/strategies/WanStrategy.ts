/**
 * WanStrategy - Prompt optimization for Wan 2.2 (Replicate)
 *
 * Implements optimization for Wan's architecture hosted on Replicate.
 * Follows best practices:
 * - Structured narrative: Subject -> Environment -> Camera -> Lighting
 * - Aspect ratio mapping to resolution strings
 * - Replicate-specific API payload generation
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
  'masterpiece',
  'cinematic motion',
  'volumetric lighting',
  '4k',
] as const;

/**
 * Default negative prompt to avoid common artifacts
 */
const DEFAULT_NEGATIVE_PROMPT = 'morphing, distorted, disfigured, text, watermark, low quality, blurry, static, extra limbs, fused fingers';

/**
 * Replicate supported aspect ratio mapping
 */
const ASPECT_RATIO_MAP: Record<string, string> = {
  '16:9': '1280*720',
  '9:16': '720*1280',
  '1:1': '1024*1024',
  '4:3': '1024*768',
  '3:4': '768*1024',
};

interface WanApiPayload {
  prompt: string;
  negative_prompt: string;
  size: string;
  num_frames: number;
  frames_per_second: number;
  prompt_extend: boolean;
}

/**
 * WanStrategy optimizes prompts for Wan 2.2 series on Replicate
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
      if (!ASPECT_RATIO_MAP[aspectRatio]) {
        this.addWarning(`Aspect ratio "${aspectRatio}" is not directly supported; supported ratios are ${Object.keys(ASPECT_RATIO_MAP).join(', ')}`);
      }
    }

    // Check for very long prompts
    const wordCount = input.split(/\s+/).length;
    if (wordCount > 300) {
      this.addWarning('Prompt exceeds 300 words; Wan performs best with 80-120 words');
    }
  }

  /**
   * Normalize input with whitespace cleanup
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
   * Reconstructs prompt to enforce: Subject -> Environment -> Camera -> Lighting
   */
  protected doTransform(llmPrompt: string | Record<string, unknown>, ir: VideoPromptIR, _context?: PromptContext): TransformResult {
    const changes: string[] = [];
    let prompt = typeof llmPrompt === 'string' ? llmPrompt : JSON.stringify(llmPrompt);
    
    // Fallback if LLM failed to produce string
    if (typeof llmPrompt !== 'string') {
        prompt = JSON.stringify(llmPrompt);
    }
    
    // Cleanup punctuation
    prompt = this.cleanWhitespace(prompt)
      .replace(/\.\./g, '.')
      .replace(/\s\./g, '.');

    return { 
      prompt: prompt, 
      changes,
      negativePrompt: DEFAULT_NEGATIVE_PROMPT
    };
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

    // Clean up final prompt
    prompt = this.cleanWhitespace(prompt);

    return {
      prompt,
      changes,
      triggersInjected,
      negativePrompt: result.negativePrompt || DEFAULT_NEGATIVE_PROMPT
    };
  }

  /**
   * Generates the API payload for Replicate
   * 
   * @param prompt - The optimized prompt string
   * @param context - The context containing constraints like aspect ratio
   * @returns The payload object for the Replicate API
   */
  public getApiPayload(prompt: string, context?: PromptContext): WanApiPayload {
    const aspectRatio = context?.constraints?.formRequirement || '16:9';
    const size = ASPECT_RATIO_MAP[aspectRatio] || '1280*720'; // Default to 16:9 (720p)

    return {
      prompt,
      negative_prompt: DEFAULT_NEGATIVE_PROMPT,
      size,
      num_frames: 81,
      frames_per_second: 16,
      prompt_extend: true
    };
  }
}

/**
 * Singleton instance for convenience
 */
export const wanStrategy = new WanStrategy();
