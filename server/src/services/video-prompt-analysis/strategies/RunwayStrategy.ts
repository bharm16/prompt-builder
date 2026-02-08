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
import type { RewriteConstraints } from './types';

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
   * Final adjustments after LLM rewrite
   */
  protected doTransform(llmPrompt: string | Record<string, unknown>, ir: VideoPromptIR, context?: PromptContext): TransformResult {
    const changes: string[] = [];
    const sourcePrompt = typeof llmPrompt === 'string' ? llmPrompt : JSON.stringify(llmPrompt);

    this.enrichCameraFromRaw(ir);

    let prompt = this.buildCsaePrompt(ir, sourcePrompt);
    if (prompt !== sourcePrompt) {
      changes.push('Reordered output to CSAE structure (camera → subject → action → environment)');
    }

    // Handle visual reference descriptions from context (Runway-specific requirement)
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

    // Enforce required A2D stability constraints post-rewrite to guarantee invariants.
    const mandatoryResult = this.enforceMandatoryConstraints(prompt, [...STABILITY_TRIGGERS]);
    prompt = mandatoryResult.prompt;
    changes.push(...mandatoryResult.changes);
    triggersInjected.push(...mandatoryResult.injected);

    // Inject context-aware cinematographic triggers when absent.
    const suggestedTriggers = this.selectCinematographicTriggers(prompt);
    for (const trigger of suggestedTriggers) {
      if (!prompt.toLowerCase().includes(trigger.toLowerCase())) {
        prompt = `${prompt}, ${trigger}`;
        triggersInjected.push(trigger);
        changes.push(`Injected cinematographic trigger: "${trigger}"`);
      }
    }
    prompt = this.cleanWhitespace(prompt);

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
    return {
      mandatory: [...STABILITY_TRIGGERS],
      suggested: this.selectCinematographicTriggers(ir.raw || ''),
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
    
    // Check for depth terms → dolly (EXCLUDING depth of field)
    for (const term of DEPTH_TERMS) {
      if (lowerRaw.includes(term)) {
        // Specifically avoid "depth of field"
        if (term === 'depth' && lowerRaw.includes('depth of field')) {
            continue;
        }
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
   * Build a deterministic prompt in CSAE order from IR + raw text.
   */
  private buildCsaePrompt(ir: VideoPromptIR, fallbackPrompt: string): string {
    const raw = this.cleanWhitespace(ir.raw || fallbackPrompt);
    const camera = this.extractCameraPhrase(ir, raw);
    const subject = this.extractSubjectPhrase(ir, raw);
    const action = this.extractActionPhrase(ir, raw);
    const environment = this.extractEnvironmentPhrase(ir, raw);

    const orderedParts = [camera, subject, action, environment].filter(
      (part): part is string => Boolean(part && part.trim().length > 0)
    );

    if (orderedParts.length === 0) {
      return this.cleanWhitespace(fallbackPrompt || raw);
    }

    // Preserve additional context not captured by CSAE extraction.
    let remainder = raw;
    for (const part of orderedParts) {
      remainder = this.removeFirstOccurrence(remainder, part);
    }
    remainder = this.cleanWhitespace(remainder.replace(/^[,.;:\s]+|[,.;:\s]+$/g, ''));
    if (remainder.length > 0) {
      orderedParts.push(remainder);
    }

    return this.cleanWhitespace(orderedParts.join(', '));
  }

  private extractCameraPhrase(ir: VideoPromptIR, raw: string): string | null {
    if (ir.camera.movements.length > 0) {
      const movement = ir.camera.movements[0];
      if (movement && movement.trim().length > 0) {
        return movement;
      }
    }

    const cameraTerms = [
      'pan left',
      'pan right',
      'tilt up',
      'tilt down',
      'dolly in',
      'dolly out',
      'zoom in',
      'zoom out',
      'tracking shot',
      'crane shot',
      'steadicam',
      'handheld',
      'low angle',
      'high angle',
      'wide angle',
      'telephoto',
      'dolly',
      'zoom',
    ];

    return this.findFirstMatchingTerm(raw, cameraTerms);
  }

  private extractSubjectPhrase(ir: VideoPromptIR, raw: string): string | null {
    const irSubject = ir.subjects[0]?.text?.trim();
    if (irSubject) {
      return irSubject;
    }

    const subjectMatch = raw.match(
      /\b(?:a man|a woman|a person|a child|a dog|a cat|the man|the woman|someone|a figure|a character)\b/i
    );
    return subjectMatch?.[0] ?? null;
  }

  private extractActionPhrase(ir: VideoPromptIR, raw: string): string | null {
    const irAction = ir.actions[0]?.trim();
    if (irAction) {
      return irAction;
    }

    const actionTerms = [
      'walking',
      'running',
      'jumping',
      'sitting',
      'standing',
      'dancing',
      'talking',
      'looking',
      'holding',
      'reaching',
      'falling',
      'flying',
      'swimming',
      'driving',
    ];

    return this.findFirstMatchingTerm(raw, actionTerms);
  }

  private extractEnvironmentPhrase(ir: VideoPromptIR, raw: string): string | null {
    if (ir.environment.setting && ir.environment.setting.trim().length > 0) {
      return ir.environment.setting.trim();
    }

    if (ir.environment.weather && ir.environment.weather.trim().length > 0) {
      return ir.environment.weather.trim();
    }

    const environmentTerms = [
      'in a forest',
      'in the city',
      'at the beach',
      'on a mountain',
      'in a room',
      'at a park',
      'in the desert',
      'on the street',
      'inside a building',
      'outside',
      'in the garden',
    ];

    return this.findFirstMatchingTerm(raw, environmentTerms);
  }

  private findFirstMatchingTerm(text: string, terms: readonly string[]): string | null {
    const lower = text.toLowerCase();
    for (const term of terms) {
      const lowerTerm = term.toLowerCase();
      const index = lower.indexOf(lowerTerm);
      if (index !== -1) {
        return text.substring(index, index + term.length);
      }
    }
    return null;
  }

  private removeFirstOccurrence(text: string, value: string): string {
    const index = text.toLowerCase().indexOf(value.toLowerCase());
    if (index === -1) return text;
    return `${text.slice(0, index)} ${text.slice(index + value.length)}`.replace(/\s+/g, ' ');
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
