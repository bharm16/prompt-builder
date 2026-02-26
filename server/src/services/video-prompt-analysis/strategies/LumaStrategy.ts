/**
 * LumaStrategy - Prompt optimization for Luma Ray-3
 *
 * Implements optimization for Luma's diffusion-based video generation
 * with causal chain expansion for coherent action sequences.
 *
 * Key features:
 * - Strips "loop"/"seamless" when loop:true API parameter is active
 * - Strips redundant resolution tokens like "4k"/"8k"
 * - Expands static descriptions into causal chains (conditionally)
 * - Injects HDR pipeline triggers
 * - Supports keyframe structure for first-to-last frame interpolation
 *
 * @module LumaStrategy
 */

import {
  BaseStrategy,
  type NormalizeResult,
  type TransformResult,
  type AugmentResult,
} from './BaseStrategy';
import type { PromptOptimizationResult, PromptContext, VideoPromptIR, RewriteConstraints } from './types';

/**
 * Loop-related terms to strip when loop:true is active
 */
const LOOP_TERMS = [
  'loop',
  'looping',
  'looped',
  'seamless',
  'seamlessly',
  'infinite',
  'continuous loop',
  'perfect loop',
  'endless',
] as const;

/**
 * Resolution tokens to avoid in LLM output
 */
const RESOLUTION_TERMS = [
  '4k',
  '8k',
  '1080p',
  '720p',
  '2k',
  'ultra hd',
  'ultra-hd',
  'uhd',
  'full hd',
  'high resolution',
  'high-resolution',
  'hi-res',
] as const;

/**
 * HDR pipeline triggers for Luma
 */
const HDR_TRIGGERS = [
  'High Dynamic Range',
  '16-bit color',
  'ACES colorspace',
] as const;

/**
 * Motion triggers based on content
 */
const MOTION_TRIGGERS = {
  slow: ['slow motion', 'slow-motion', 'slowmo'],
  fast: ['high-speed camera', 'high-speed', 'fast motion'],
} as const;

/**
 * Static description indicators that need causal expansion
 */
const STATIC_INDICATORS = [
  'standing',
  'sitting',
  'lying',
  'positioned',
  'placed',
  'resting',
  'still',
  'stationary',
  'motionless',
  'frozen',
  'static',
] as const;

/**
 * Action verbs for causal chain expansion
 */
const CAUSAL_EXPANSIONS: Record<string, string> = {
  standing: 'shifts weight slightly, breathing visible',
  sitting: 'adjusts position subtly, natural micro-movements',
  lying: 'chest rises and falls with breath',
  positioned: 'maintains pose with subtle natural movement',
  placed: 'settles into position with gentle motion',
  resting: 'relaxes with visible breathing rhythm',
  still: 'holds position with natural micro-movements',
  stationary: 'remains in place with ambient motion',
  motionless: 'stays fixed while environment moves around',
  frozen: 'holds pose as surroundings shift',
  static: 'maintains position with subtle life signs',
};

/**
 * Motion speed indicators
 */
const SLOW_MOTION_INDICATORS = [
  'slow',
  'slowly',
  'gentle',
  'gently',
  'graceful',
  'gracefully',
  'flowing',
  'drifting',
  'floating',
  'gliding',
] as const;

const FAST_MOTION_INDICATORS = [
  'fast',
  'quickly',
  'rapid',
  'rapidly',
  'swift',
  'swiftly',
  'speeding',
  'racing',
  'rushing',
  'explosive',
] as const;

/**
 * LumaStrategy optimizes prompts for Luma Ray-3's diffusion architecture
 */
export class LumaStrategy extends BaseStrategy {
  readonly modelId = 'luma-ray3';
  readonly modelName = 'Luma Ray-3';

  /**
   * Validate input against Luma-specific constraints
   */
  protected async doValidate(input: string, context?: PromptContext): Promise<void> {
    // Check for aspect ratio constraints if provided
    if (context?.constraints?.formRequirement) {
      const aspectRatio = context.constraints.formRequirement;
      const validAspectRatios = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'];
      if (!validAspectRatios.includes(aspectRatio)) {
        this.addWarning(`Aspect ratio "${aspectRatio}" may not be supported by Luma`);
      }
    }

    // Check for keyframe validation
    if (context?.assets) {
      const imageAssets = context.assets.filter(a => a.type === 'image');
      if (imageAssets.length > 2) {
        this.addWarning('Luma supports maximum 2 keyframes (start and end); extra images will be ignored');
      }
    }

    // Check for very long prompts
    const wordCount = input.split(/\s+/).length;
    if (wordCount > 150) {
      this.addWarning('Prompt exceeds 150 words; Luma may truncate or ignore excess content');
    }
  }

  /**
   * Normalize input by stripping loop terms (when loop:true)
   */
  protected doNormalize(input: string, context?: PromptContext): NormalizeResult {
    let text = input;
    const changes: string[] = [];
    const strippedTokens: string[] = [];

    // Check if loop:true is active in API params
    const loopActive = context?.apiParams?.loop === true;

    // Strip loop terms when loop:true is active
    if (loopActive) {
      for (const term of LOOP_TERMS) {
        if (this.containsWord(text, term)) {
          text = this.replaceWord(text, term, '');
          changes.push(`Stripped loop term: "${term}" (loop:true active)`);
          strippedTokens.push(term);
        }
      }
    }

    // Clean up whitespace
    text = this.cleanWhitespace(text);

    return { text, changes, strippedTokens };
  }

  /**
   * Final adjustments after LLM rewrite
   */
  protected doTransform(llmPrompt: string | Record<string, unknown>, _ir: VideoPromptIR, context?: PromptContext): TransformResult {
    const changes: string[] = [];
    let prompt = typeof llmPrompt === 'string' ? llmPrompt : JSON.stringify(llmPrompt);

    // Handle keyframe structure if assets are provided
    if (context?.assets) {
      const imageAssets = context.assets.filter(a => a.type === 'image');
      if (imageAssets.length >= 2) {
        // Validate physical plausibility between keyframes
        const plausibilityWarning = this.validateKeyframePlausibility(
          imageAssets[0]?.description,
          imageAssets[1]?.description
        );
        if (plausibilityWarning) {
          this.addWarning(plausibilityWarning);
        }
        changes.push('Keyframe structure detected for first-to-last frame interpolation');
      }
    }

    return { prompt, changes };
  }

  /**
   * Augment result with HDR and motion triggers
   */
  protected doAugment(
    result: PromptOptimizationResult,
    _context?: PromptContext
  ): AugmentResult {
    const changes: string[] = [];
    const triggersInjected: string[] = [];

    // HDR_TRIGGERS are now handled by the LLM via Mandatory Constraints
    const prompt = typeof result.prompt === 'string' ? result.prompt : JSON.stringify(result.prompt);

    return {
      prompt,
      changes,
      triggersInjected,
    };
  }

  /**
   * Provide mandatory and suggested constraints for LLM rewrite.
   */
  protected override getRewriteConstraints(ir: VideoPromptIR, _context?: PromptContext): RewriteConstraints {
    const motionTrigger = this.selectMotionTrigger(ir.raw || '');
    return {
      mandatory: [...HDR_TRIGGERS],
      suggested: motionTrigger ? [motionTrigger] : [],
      avoid: [...RESOLUTION_TERMS],
    };
  }

  // ============================================================
  // Private Helper Methods
  // ============================================================

  /**
   * Apply causal chain expansion to static descriptions
   * Converts static poses into dynamic descriptions with cause and effect
   */
  private applyCausalChainExpansion(text: string): string {
    let result = text;

    for (const indicator of STATIC_INDICATORS) {
      if (this.containsWord(result, indicator)) {
        const expansion = CAUSAL_EXPANSIONS[indicator];
        if (expansion) {
          // Add the causal expansion after the static term
          const regex = new RegExp(`(\\b${this.escapeRegex(indicator)}\\b)`, 'gi');
          result = result.replace(regex, `$1, ${expansion}`);
        }
      }
    }

    return result;
  }

  /**
   * Select appropriate motion trigger based on content
   */
  private selectMotionTrigger(prompt: string): string | null {
    const lowerPrompt = prompt.toLowerCase();

    // Check for slow motion indicators
    for (const indicator of SLOW_MOTION_INDICATORS) {
      if (lowerPrompt.includes(indicator)) {
        return MOTION_TRIGGERS.slow[0]; // "slow motion"
      }
    }

    // Check for fast motion indicators
    for (const indicator of FAST_MOTION_INDICATORS) {
      if (lowerPrompt.includes(indicator)) {
        return MOTION_TRIGGERS.fast[0]; // "high-speed camera"
      }
    }

    // No specific motion detected
    return null;
  }

  /**
   * Validate physical plausibility between keyframes
   * Returns a warning message if there's a large semantic leap
   */
  private validateKeyframePlausibility(
    startDescription?: string,
    endDescription?: string
  ): string | null {
    if (!startDescription || !endDescription) {
      return null;
    }

    // Simple heuristic: check for completely different subjects
    const startWords = new Set(startDescription.toLowerCase().split(/\s+/));
    const endWords = new Set(endDescription.toLowerCase().split(/\s+/));

    // Calculate word overlap
    let overlap = 0;
    for (const word of startWords) {
      if (endWords.has(word)) {
        overlap++;
      }
    }

    const overlapRatio = overlap / Math.max(startWords.size, endWords.size);

    // If less than 20% overlap, warn about semantic leap
    if (overlapRatio < 0.2) {
      return 'Large semantic difference between keyframes detected; motion may appear unnatural';
    }

    return null;
  }
}

