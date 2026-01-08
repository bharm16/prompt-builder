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
    
    // Construct structured prompt from IR components
    const segments: string[] = [];

    // 1. Subject & Action
    const subjectParts: string[] = [];
    ir.subjects.forEach(sub => {
      let text = sub.text;
      if (sub.attributes && sub.attributes.length > 0) {
        text = `${sub.attributes.join(' ')} ${text}`;
      }
      subjectParts.push(text);
    });
    
    // Add main action if present
    if (ir.actions && ir.actions.length > 0) {
        subjectParts.push(ir.actions.join(', '));
    }
    
    if (subjectParts.length > 0) {
      segments.push(subjectParts.join(' '));
    }

    // 2. Environment/Scene
    const envParts: string[] = [];
    if (ir.environment.setting) envParts.push(ir.environment.setting);
    if (ir.environment.weather) envParts.push(ir.environment.weather);
    
    if (envParts.length > 0) {
      segments.push(envParts.join(', '));
    }

    // 3. Camera Movement
    const cameraParts: string[] = [];
    if (ir.camera.shotType) cameraParts.push(ir.camera.shotType);
    if (ir.camera.angle) cameraParts.push(ir.camera.angle);
    if (ir.camera.movements && ir.camera.movements.length > 0) {
      cameraParts.push(ir.camera.movements.join(', '));
    }

    if (cameraParts.length > 0) {
      segments.push(cameraParts.join(', '));
    }

    // 4. Lighting & Style
    const styleParts: string[] = [];
    if (ir.environment.lighting && ir.environment.lighting.length > 0) {
      styleParts.push(ir.environment.lighting.join(', '));
    }
    if (ir.meta.style && ir.meta.style.length > 0) {
      styleParts.push(ir.meta.style.join(', '));
    }

    if (styleParts.length > 0) {
      segments.push(styleParts.join(', '));
    }

    // Combine segments
    let structuredPrompt = segments.join('. ');
    
    // Fallback if IR extraction yielded an empty or very short string (unlikely but possible)
    if (structuredPrompt.length < 10 && typeof llmPrompt === 'string') {
      structuredPrompt = llmPrompt;
      changes.push('Used LLM rewrite directly (IR extraction insufficient)');
    } else {
      changes.push('Enforced structured narrative: Subject -> Environment -> Camera -> Lighting');
    }

    // Cleanup punctuation
    structuredPrompt = this.cleanWhitespace(structuredPrompt)
      .replace(/\.\./g, '.')
      .replace(/\s\./g, '.');

    return { 
      prompt: structuredPrompt, 
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
  public getApiPayload(prompt: string, context?: PromptContext): Record<string, any> {
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
