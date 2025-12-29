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
import type { PromptOptimizationResult, PromptContext } from './types';

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
 * Camera movement terms for CSAE ordering
 */
const CAMERA_MOVEMENT_TERMS = [
  'pan',
  'panning',
  'tilt',
  'tilting',
  'truck',
  'trucking',
  'pedestal',
  'dolly',
  'dollying',
  'zoom',
  'zooming',
  'crane',
  'jib',
  'steadicam',
  'handheld',
  'tracking',
  'follow',
  'following',
  'orbit',
  'orbiting',
  'arc',
  'arcing',
  'push in',
  'pull out',
  'push-in',
  'pull-out',
] as const;

/**
 * Camera angle terms
 */
const CAMERA_ANGLE_TERMS = [
  'low angle',
  'high angle',
  'eye level',
  'eye-level',
  'dutch angle',
  'dutch tilt',
  'birds eye',
  'bird\'s eye',
  'worms eye',
  'worm\'s eye',
  'overhead',
  'aerial',
  'ground level',
  'ground-level',
] as const;

/**
 * Camera lens terms
 */
const CAMERA_LENS_TERMS = [
  'wide angle',
  'wide-angle',
  'telephoto',
  'macro',
  'fisheye',
  'fish-eye',
  'anamorphic',
  'prime lens',
  'zoom lens',
  '35mm',
  '50mm',
  '85mm',
  '24mm',
  '70mm',
  '200mm',
] as const;

/**
 * Subject indicator terms
 */
const SUBJECT_INDICATORS = [
  'a man',
  'a woman',
  'a person',
  'a child',
  'a dog',
  'a cat',
  'an animal',
  'a car',
  'a building',
  'a tree',
  'the man',
  'the woman',
  'the person',
  'the child',
  'someone',
  'something',
  'figure',
  'character',
  'protagonist',
  'subject',
] as const;

/**
 * Action indicator terms
 */
const ACTION_INDICATORS = [
  'walking',
  'running',
  'jumping',
  'sitting',
  'standing',
  'moving',
  'dancing',
  'talking',
  'looking',
  'watching',
  'holding',
  'reaching',
  'falling',
  'flying',
  'swimming',
  'driving',
  'riding',
  'climbing',
  'descending',
  'ascending',
  'turning',
  'spinning',
  'rotating',
  'flowing',
  'drifting',
  'floating',
] as const;

/**
 * Environment indicator terms
 */
const ENVIRONMENT_INDICATORS = [
  'in a',
  'in the',
  'at a',
  'at the',
  'on a',
  'on the',
  'inside',
  'outside',
  'outdoors',
  'indoors',
  'forest',
  'beach',
  'city',
  'street',
  'room',
  'building',
  'mountain',
  'ocean',
  'desert',
  'field',
  'garden',
  'park',
  'studio',
  'background',
  'setting',
  'scene',
  'location',
  'environment',
  'landscape',
  'skyline',
  'horizon',
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
   * Normalize input by stripping emotional/abstract and morphing/blur terms
   */
  protected doNormalize(input: string, context?: PromptContext): NormalizeResult {
    let text = input;
    const changes: string[] = [];
    const strippedTokens: string[] = [];

    // Check if morphing/blur is explicitly requested as style
    const isStyleRequest = this.isExplicitStyleRequest(text);

    // Strip emotional/abstract terms
    for (const term of EMOTIONAL_TERMS) {
      if (this.containsWord(text, term)) {
        // Check if term can be translated to lighting
        const lightingTranslation = this.translateToLighting(term);
        if (lightingTranslation) {
          text = this.replaceWord(text, term, lightingTranslation);
          changes.push(`Translated "${term}" to lighting term "${lightingTranslation}"`);
        } else {
          text = this.replaceWord(text, term, '');
          changes.push(`Stripped emotional term: "${term}"`);
          strippedTokens.push(term);
        }
      }
    }

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
   * Transform input using CSAE protocol (Camera → Subject → Action → Environment)
   */
  protected doTransform(input: string, context?: PromptContext): TransformResult {
    const changes: string[] = [];

    // Extract components
    const camera = this.extractCameraElements(input);
    const subject = this.extractSubjectElements(input);
    const action = this.extractActionElements(input);
    const environment = this.extractEnvironmentElements(input);
    const remaining = this.extractRemainingElements(input, [camera, subject, action, environment]);

    // Apply camera motion mapping
    const mappedCamera = this.applyCameraMotionMapping(camera, input);
    if (mappedCamera !== camera) {
      changes.push(`Mapped camera motion: "${camera}" → "${mappedCamera}"`);
    }

    // Build CSAE-ordered prompt
    const csaeComponents: string[] = [];

    if (mappedCamera.trim()) {
      csaeComponents.push(mappedCamera.trim());
      changes.push('Camera terms moved to start (CSAE protocol)');
    }

    if (subject.trim()) {
      csaeComponents.push(subject.trim());
    }

    if (action.trim()) {
      csaeComponents.push(action.trim());
    }

    if (environment.trim()) {
      csaeComponents.push(environment.trim());
    }

    if (remaining.trim()) {
      csaeComponents.push(remaining.trim());
    }

    // Join with appropriate separators
    let prompt = csaeComponents.filter(c => c.length > 0).join(', ');
    prompt = this.cleanWhitespace(prompt);

    // If no restructuring was possible, use original
    if (!prompt || prompt.length < input.length * 0.3) {
      prompt = input;
      changes.push('Minimal restructuring applied (input already well-structured)');
    } else {
      changes.push('Applied CSAE reordering');
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
   * Translate emotional terms to lighting equivalents where possible
   */
  private translateToLighting(term: string): string | null {
    const lightingMap: Record<string, string> = {
      'melancholy': 'low-key lighting',
      'melancholic': 'low-key lighting',
      'sad': 'low-key lighting',
      'sadness': 'low-key lighting',
      'happy': 'high-key lighting',
      'happiness': 'high-key lighting',
      'joyful': 'bright lighting',
      'joyous': 'bright lighting',
      'mysterious': 'chiaroscuro lighting',
      'mystery': 'chiaroscuro lighting',
      'romantic': 'golden hour lighting',
      'romance': 'golden hour lighting',
      'tense': 'harsh shadows',
      'tension': 'harsh shadows',
      'peaceful': 'soft diffused lighting',
      'serene': 'soft diffused lighting',
      'serenity': 'soft diffused lighting',
      'calm': 'even lighting',
      'calming': 'even lighting',
      'dreamy': 'soft backlight',
      'dreamlike': 'soft backlight',
      'ethereal': 'rim lighting',
    };

    return lightingMap[term.toLowerCase()] ?? null;
  }

  /**
   * Extract camera-related elements from text
   */
  private extractCameraElements(text: string): string {
    const cameraTerms: string[] = [];

    // Extract camera movements
    for (const term of CAMERA_MOVEMENT_TERMS) {
      const regex = new RegExp(`\\b${this.escapeRegex(term)}(?:\\s+\\w+)?\\b`, 'gi');
      const matches = text.match(regex);
      if (matches) {
        cameraTerms.push(...matches);
      }
    }

    // Extract camera angles
    for (const term of CAMERA_ANGLE_TERMS) {
      const regex = new RegExp(`\\b${this.escapeRegex(term)}\\b`, 'gi');
      const matches = text.match(regex);
      if (matches) {
        cameraTerms.push(...matches);
      }
    }

    // Extract camera lens terms
    for (const term of CAMERA_LENS_TERMS) {
      const regex = new RegExp(`\\b${this.escapeRegex(term)}\\b`, 'gi');
      const matches = text.match(regex);
      if (matches) {
        cameraTerms.push(...matches);
      }
    }

    return [...new Set(cameraTerms)].join(', ');
  }

  /**
   * Extract subject-related elements from text
   */
  private extractSubjectElements(text: string): string {
    const subjectPhrases: string[] = [];

    // Look for subject patterns - extract the subject phrase with limited following words
    for (const indicator of SUBJECT_INDICATORS) {
      // Match the indicator followed by up to 5 words (adjectives/descriptors)
      const regex = new RegExp(`${this.escapeRegex(indicator)}(?:\\s+\\w+){0,5}`, 'gi');
      const matches = text.match(regex);
      if (matches) {
        // Filter out matches that contain action terms (to avoid capturing "a man walking")
        const filteredMatches = matches.filter(match => {
          const lowerMatch = match.toLowerCase();
          return !ACTION_INDICATORS.some(action => lowerMatch.includes(action.toLowerCase()));
        });
        subjectPhrases.push(...filteredMatches);
      }
    }

    // Deduplicate and join
    const uniquePhrases = [...new Set(subjectPhrases.map(p => p.trim()))];
    return uniquePhrases.slice(0, 2).join(', '); // Limit to avoid over-extraction
  }

  /**
   * Extract action-related elements from text
   * Only extracts the action verb itself, not following content that might be subjects
   */
  private extractActionElements(text: string): string {
    const actionPhrases: string[] = [];

    for (const indicator of ACTION_INDICATORS) {
      // Match just the action term, possibly with an adverb before or after
      const regex = new RegExp(`(?:\\w+ly\\s+)?\\b${this.escapeRegex(indicator)}\\b(?:\\s+\\w+ly)?`, 'gi');
      const matches = text.match(regex);
      if (matches) {
        actionPhrases.push(...matches);
      }
    }

    const uniquePhrases = [...new Set(actionPhrases.map(p => p.trim()))];
    return uniquePhrases.slice(0, 2).join(', ');
  }

  /**
   * Extract environment-related elements from text
   */
  private extractEnvironmentElements(text: string): string {
    const envPhrases: string[] = [];

    for (const indicator of ENVIRONMENT_INDICATORS) {
      const regex = new RegExp(`${this.escapeRegex(indicator)}[^,\\.;]*`, 'gi');
      const matches = text.match(regex);
      if (matches) {
        envPhrases.push(...matches);
      }
    }

    const uniquePhrases = [...new Set(envPhrases.map(p => p.trim()))];
    return uniquePhrases.slice(0, 2).join(', ');
  }

  /**
   * Extract remaining elements not captured by CSAE categories
   */
  private extractRemainingElements(text: string, extracted: string[]): string {
    let remaining = text;

    // Remove extracted elements
    for (const element of extracted) {
      if (element) {
        for (const part of element.split(',')) {
          const trimmed = part.trim();
          if (trimmed) {
            remaining = remaining.replace(new RegExp(this.escapeRegex(trimmed), 'gi'), '');
          }
        }
      }
    }

    return this.cleanWhitespace(remaining);
  }

  /**
   * Apply camera motion mapping for depth/vertigo terms
   */
  private applyCameraMotionMapping(camera: string, fullText: string): string {
    let result = camera;

    // Check for depth terms → dolly
    for (const term of DEPTH_TERMS) {
      if (this.containsWord(fullText, term)) {
        if (!result.toLowerCase().includes('dolly')) {
          result = result ? `dolly, ${result}` : 'dolly';
        }
        break;
      }
    }

    // Check for vertigo terms → zoom
    for (const term of VERTIGO_TERMS) {
      if (this.containsWord(fullText, term)) {
        if (!result.toLowerCase().includes('zoom')) {
          result = result ? `zoom, ${result}` : 'zoom';
        }
        break;
      }
    }

    return result;
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
