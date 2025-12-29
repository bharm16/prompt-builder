/**
 * RunwayStrategy - Prompt optimization for Runway Gen-4.5
 *
 * Implements the A2D (Autoregressive-to-Diffusion) architecture optimization
 * using CSAE protocol (Camera → Subject → Action → Environment) for structural prompts.
 *
 * Key features:
 * - Strips emotional/abstract terms unless translatable to lighting
 * - Strips morphing/blur terms unless explicitly requested as style
 * - Reorders content to CSAE protocol
 * - Injects cinematographic triggers for high-fidelity weights
 * - Maps depth/vertigo terms to camera motions
 *
 * @module RunwayStrategy
 */

import {
  BaseStrategy,
  type NormalizeResult,
  type TransformResult,
  type AugmentResult,
} from './BaseStrategy';
import type { PromptOptimizationResult, PromptContext, VideoPromptIR } from './types';

/**
 * Emotional/abstract terms to strip (unless translatable to lighting)
 */
const EMOTIONAL_TERMS = [
  'vibe',
  'vibes',
  'vibing',
  'sad',
  'sadness',
  'happy',
  'happiness',
  'melancholy',
  'melancholic',
  'joyful',
  'joyous',
  'anxious',
  'anxiety',
  'peaceful',
  'serene',
  'serenity',
  'tense',
  'tension',
  'calm',
  'calming',
  'exciting',
  'excitement',
  'boring',
  'interesting',
  'mysterious',
  'mystery',
  'romantic',
  'romance',
  'nostalgic',
  'nostalgia',
  'dreamy',
  'dreamlike',
  'ethereal',
  'surreal',
  'abstract',
  'emotional',
  'emotion',
  'feeling',
  'feelings',
  'mood',
  'moody',
  'atmosphere',
  'atmospheric',
] as const;

/**
 * Morphing/blur terms to strip (unless explicitly requested as style)
 */
const MORPHING_BLUR_TERMS = [
  'morphing',
  'morph',
  'morphs',
  'blur',
  'blurry',
  'blurred',
  'blurring',
  'soft focus',
  'out of focus',
  'defocused',
  'hazy',
  'haze',
  'foggy',
  'misty',
  'smudge',
  'smudged',
  'smearing',
  'distorted',
  'distortion',
  'warped',
  'warping',
] as const;

/**
 * Depth/3D terms that map to dolly camera motion
 */
const DEPTH_TERMS = ['depth', '3d feel', '3d effect', 'dimensional', 'parallax'] as const;

/**
 * Vertigo/compression terms that map to zoom camera motion
 */
const VERTIGO_TERMS = ['vertigo', 'compression', 'dolly zoom', 'zolly', 'contra-zoom'] as const;

/**
 * Cinematographic aesthetic triggers for high-fidelity weights
 */
const CINEMATOGRAPHIC_TRIGGERS = [
  'chromatic aberration',
  'anamorphic lens flare',
  'shallow depth of field',
  'film grain',
  'cinematic lighting',
  'volumetric lighting',
  'lens distortion',
  'bokeh',
] as const;

/**
 * Core stability triggers for A2D architecture
 */
const STABILITY_TRIGGERS = [
  'single continuous shot',
  'fluid motion',
  'consistent geometry',
] as const;

/**
 * RunwayStrategy optimizes prompts for Runway Gen-4.5's A2D architecture
 */
export class RunwayStrategy extends BaseStrategy {
  readonly modelId = 'runway-gen45';
  readonly modelName = 'Runway Gen-4.5';

  /**
   * Validate input against Runway-specific constraints
   */
  protected async doValidate(input: string, context?: PromptContext): Promise<void> {
    // Check for aspect ratio constraints if provided
    if (context?.constraints?.formRequirement) {
      const aspectRatio = context.constraints.formRequirement;
      const validAspectRatios = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'];
      if (!validAspectRatios.includes(aspectRatio)) {
        this.addWarning(`Aspect ratio "${aspectRatio}" may not be supported by Runway`);
      }
    }

    // Check for very long prompts
    const wordCount = input.split(/\s+/).length;
    if (wordCount > 200) {
      this.addWarning('Prompt exceeds 200 words; Runway may truncate or ignore excess content');
    }
  }

  /**
   * Normalize input by stripping morphing/blur terms
   */
  protected doNormalize(input: string, _context?: PromptContext): NormalizeResult {
    let text = input;
    const changes: string[] = [];
    const strippedTokens: string[] = [];

    // Check if morphing/blur is explicitly requested as style
    const isStyleRequest = this.isExplicitStyleRequest(text);

    // Strip morphing/blur terms unless explicitly requested as style
    if (!isStyleRequest) {
      for (const term of MORPHING_BLUR_TERMS) {
        if (this.containsWord(text, term)) {
          text = this.replaceWord(text, term, '');
          changes.push(`Stripped morphing/blur term: "${term}"`);
          strippedTokens.push(term);
        }
      }
    }

    // Clean up whitespace
    text = this.cleanWhitespace(text);

    return { text, changes, strippedTokens };
  }

  /**
   * Transform input using CSAE protocol via Natural Language Synthesis
   * Uses VideoPromptIR to construct a fluid sentence.
   */
  protected doTransform(ir: VideoPromptIR, context?: PromptContext): TransformResult {
    const changes: string[] = [];
    const parts: string[] = [];

    // 1. Camera (Start with shot type/movement)
    let cameraPart = '';
    
    // Enrich camera from raw text for depth/vertigo terms (legacy logic)
    this.enrichCameraFromRaw(ir);

    if (ir.camera.shotType) {
      cameraPart = ir.camera.shotType;
    }
    if (ir.camera.angle) {
      cameraPart = cameraPart ? `${cameraPart}, ${ir.camera.angle}` : ir.camera.angle;
    }
    if (ir.camera.movements.length > 0) {
      const move = ir.camera.movements.join(' and '); // e.g., "dolly and pan"
      cameraPart = cameraPart ? `${cameraPart} with ${move}` : move;
    }

    if (cameraPart) {
      // Capitalize first letter
      cameraPart = cameraPart.charAt(0).toUpperCase() + cameraPart.slice(1);
      parts.push(cameraPart + ' of');
      changes.push('Synthesized camera description');
    }

    // 2. Subject & Action
    let subjectPart = '';
    if (ir.subjects.length > 0) {
      // Join subjects naturally
      subjectPart = ir.subjects.map(s => s.text).join(' and ');
    }
    
    // Add action
    if (ir.actions.length > 0) {
      const actionText = ir.actions.join(' and ');
      if (subjectPart) {
        subjectPart += ` ${actionText}`; // "a dog running"
      } else {
        subjectPart = actionText; // just "running" (if no subject)
      }
    }

    if (subjectPart) {
      parts.push(subjectPart);
      changes.push('Synthesized subject and action');
    }

    // 3. Environment
    if (ir.environment.setting) {
      parts.push(`in ${ir.environment.setting}`);
    }

    // 4. Lighting & Weather
    const conditions = [...ir.environment.lighting];
    if (ir.environment.weather) conditions.push(ir.environment.weather);
    
    if (conditions.length > 0) {
      parts.push(`with ${conditions.join(', ')}`);
    }

    // 5. Construct full prompt
    let prompt = parts.join(' ');

    // Fallback: If synthesis yielded very little (e.g., regexes failed), use raw input
    // to avoid returning "with sunlight" as the whole prompt.
    if (prompt.length < 10 && ir.raw.length > 10) {
      prompt = ir.raw;
      changes.push('Reverted to raw input due to sparse analysis');
    } else {
      changes.push('Constructed natural language prompt from IR');
    }

    // Handle visual reference descriptions from context
    if (context?.assets) {
      for (const asset of context.assets) {
        if (asset.type === 'image' && asset.description) {
          prompt = `${prompt}. Reference: ${asset.description}`;
          changes.push('Appended visual reference description for concept consistency');
        }
      }
    }

    return { prompt, changes };
  }

  /**
   * Augment result with Runway-specific triggers
   */
  protected doAugment(
    result: PromptOptimizationResult,
    _context?: PromptContext
  ): AugmentResult {
    const changes: string[] = [];
    const triggersInjected: string[] = [];

    let prompt = typeof result.prompt === 'string' ? result.prompt : JSON.stringify(result.prompt);

    // Inject stability triggers for A2D architecture
    for (const trigger of STABILITY_TRIGGERS) {
      if (!prompt.toLowerCase().includes(trigger.toLowerCase())) {
        prompt = `${prompt}, ${trigger}`;
        triggersInjected.push(trigger);
        changes.push(`Injected stability trigger: "${trigger}"`);
      }
    }

    // Inject cinematographic triggers (select 2-3 based on content)
    const selectedTriggers = this.selectCinematographicTriggers(prompt);
    for (const trigger of selectedTriggers) {
      if (!prompt.toLowerCase().includes(trigger.toLowerCase())) {
        prompt = `${prompt}, ${trigger}`;
        triggersInjected.push(trigger);
        changes.push(`Injected cinematographic trigger: "${trigger}"`);
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

  // ============================================================
  // Private Helper Methods
  // ============================================================

  /**
   * Check if morphing/blur is explicitly requested as a style
   */
  private isExplicitStyleRequest(text: string): boolean {
    const stylePatterns = [
      /style[:\s]+.*(?:blur|morph|haz|fog|mist)/i,
      /(?:blur|morph|haz|fog|mist).*style/i,
      /artistic\s+(?:blur|morph)/i,
      /intentional\s+(?:blur|morph)/i,
      /(?:blur|morph)\s+effect/i,
      /(?:blur|morph)\s+aesthetic/i,
    ];

    return stylePatterns.some(pattern => pattern.test(text));
  }

  /**
   * Enrich camera movements in IR based on raw text triggers (depth, vertigo)
   */
  private enrichCameraFromRaw(ir: VideoPromptIR): void {
    const lowerRaw = ir.raw.toLowerCase();
    
    // Check for depth terms → dolly
    for (const term of DEPTH_TERMS) {
      if (lowerRaw.includes(term)) {
        if (!ir.camera.movements.includes('dolly')) {
          ir.camera.movements.push('dolly');
        }
        break;
      }
    }

    // Check for vertigo terms → zoom
    for (const term of VERTIGO_TERMS) {
      if (lowerRaw.includes(term)) {
        if (!ir.camera.movements.includes('zoom')) {
          ir.camera.movements.push('zoom');
        }
        break;
      }
    }
  }

  /**
   * Select appropriate cinematographic triggers based on content
   */
  private selectCinematographicTriggers(prompt: string): string[] {
    const selected: string[] = [];
    const lowerPrompt = prompt.toLowerCase();

    // Always add shallow depth of field for subject focus
    if (lowerPrompt.includes('person') || lowerPrompt.includes('man') ||
        lowerPrompt.includes('woman') || lowerPrompt.includes('character')) {
      selected.push('shallow depth of field');
    }

    // Add lens flare for outdoor/bright scenes
    if (lowerPrompt.includes('sun') || lowerPrompt.includes('outdoor') ||
        lowerPrompt.includes('bright') || lowerPrompt.includes('day')) {
      selected.push('anamorphic lens flare');
    }

    // Add film grain for cinematic feel
    if (lowerPrompt.includes('cinematic') || lowerPrompt.includes('film') ||
        lowerPrompt.includes('movie')) {
      selected.push('film grain');
    }

    // Add volumetric lighting for atmospheric scenes
    if (lowerPrompt.includes('fog') || lowerPrompt.includes('mist') ||
        lowerPrompt.includes('smoke') || lowerPrompt.includes('dust')) {
      selected.push('volumetric lighting');
    }

    // Default: add at least one trigger if none selected
    if (selected.length === 0) {
      selected.push('cinematic lighting');
    }

    // Limit to 3 triggers
    return selected.slice(0, 3);
  }
}

/**
 * Singleton instance for convenience
 */
export const runwayStrategy = new RunwayStrategy();
