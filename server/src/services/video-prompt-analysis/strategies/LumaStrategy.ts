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
import type { PromptOptimizationResult, PromptContext, VideoPromptIR } from './types';

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
 * Resolution tokens to strip (handled by TechStripper, but we add extras)
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
   * Normalize input by stripping loop terms (when loop:true) and resolution tokens
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

    // Strip resolution tokens (additional to TechStripper)
    for (const term of RESOLUTION_TERMS) {
      if (this.containsWord(text, term)) {
        text = this.replaceWord(text, term, '');
        changes.push(`Stripped resolution term: "${term}"`);
        strippedTokens.push(term);
      }
    }

    // Clean up whitespace
    text = this.cleanWhitespace(text);

    return { text, changes, strippedTokens };
  }

  /**
   * Transform input with causal chain expansion for static descriptions
   */
  protected doTransform(ir: VideoPromptIR, context?: PromptContext): TransformResult {
    const changes: string[] = [];
    let prompt = ir.raw; // Luma works well with raw text usually

    // Re-inject Technical Specs if they were stripped from raw (to prevent leakage) but are valid for the prompt
    // Luma benefits from explicit camera and lighting descriptions appended to the narrative
    const specsToAdd: string[] = [];

    // Camera
    if (ir.camera.shotType && !prompt.toLowerCase().includes(ir.camera.shotType.toLowerCase())) {
        specsToAdd.push(ir.camera.shotType);
    }
    if (ir.camera.angle && !prompt.toLowerCase().includes(ir.camera.angle.toLowerCase())) {
        specsToAdd.push(ir.camera.angle);
    }
    // Lighting
    for (const light of ir.environment.lighting) {
        if (!prompt.toLowerCase().includes(light.toLowerCase())) {
            specsToAdd.push(light);
        }
    }
    // Style
    for (const style of ir.meta.style) {
        if (!prompt.toLowerCase().includes(style.toLowerCase())) {
            specsToAdd.push(`Style: ${style}`);
        }
    }

    if (specsToAdd.length > 0) {
        prompt = `${prompt}. ${specsToAdd.join(', ')}.`;
        changes.push('Appended technical specs from IR');
    }

    // Check for explicit static/frozen request in camera or style
    // If user asked for "frozen", "static", "time-stop", we should SKIP expansion
    const isExplicitlyStatic = 
       ir.camera.movements.includes('static') || 
       ir.meta.style.includes('frozen') ||
       /\b(time.?stop|frozen|statue)\b/i.test(ir.raw);

    if (!isExplicitlyStatic) {
        // Apply causal chain expansion for static descriptions
        const expandedPrompt = this.applyCausalChainExpansion(prompt);
        if (expandedPrompt !== prompt) {
            prompt = expandedPrompt;
            changes.push('Applied causal chain expansion for static descriptions');
        }
    } else {
        changes.push('Skipped causal expansion due to explicit static request');
    }

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

    // Clean up final prompt
    prompt = this.cleanWhitespace(prompt);

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

    let prompt = typeof result.prompt === 'string' ? result.prompt : JSON.stringify(result.prompt);

    // Inject HDR pipeline triggers
    for (const trigger of HDR_TRIGGERS) {
      if (!prompt.toLowerCase().includes(trigger.toLowerCase())) {
        prompt = `${prompt}, ${trigger}`;
        triggersInjected.push(trigger);
        changes.push(`Injected HDR trigger: "${trigger}"`);
      }
    }

    // Detect and inject appropriate motion triggers
    const motionTrigger = this.selectMotionTrigger(prompt);
    if (motionTrigger && !prompt.toLowerCase().includes(motionTrigger.toLowerCase())) {
      prompt = `${prompt}, ${motionTrigger}`;
      triggersInjected.push(motionTrigger);
      changes.push(`Injected motion trigger: "${motionTrigger}"`);
    }

    // Clean up final prompt
    prompt = this.cleanWhitespace(prompt);

    return {
      prompt,
      changes,
      triggersInjected,
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
          const regex = new RegExp(`(\b${this.escapeRegex(indicator)}\b)`, 'gi');
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

/**
 * Singleton instance for convenience
 */
export const lumaStrategy = new LumaStrategy();