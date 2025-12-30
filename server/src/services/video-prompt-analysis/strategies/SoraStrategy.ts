/**
 * SoraStrategy - Prompt optimization for OpenAI Sora 2
 *
 * Implements optimization for Sora's physics-grounded video generation
 * with temporal segmentation and safety filtering.
 *
 * Key features:
 * - Aggressively strips public figure names to prevent API rejections
 * - Preserves valid @Cameo identity tokens
 * - Analyzes physical interactions for collisions and gravity effects
 * - Segments complex prompts into temporal sequences (Shot 1 → Shot 2)
 * - Injects physics terms: "Newtonian physics", "momentum conservation", "surface friction"
 * - Injects response_format metadata for API calls
 * - Validates and enforces supported aspect ratios and resolutions
 *
 * @module SoraStrategy
 */

import {
  BaseStrategy,
  type NormalizeResult,
  type TransformResult,
  type AugmentResult,
} from './BaseStrategy';
import type { PromptOptimizationResult, PromptContext, VideoPromptIR } from './types';

/**
 * Pattern to match @Cameo tokens that should be preserved
 */
const CAMEO_TOKEN_PATTERN = /@Cameo\(([^)]+)\)/g;

/**
 * Physics-related terms for analysis
 */
const PHYSICS_INTERACTION_TERMS = [
  'fall',
  'falls',
  'falling',
  'drop',
  'drops',
  'dropping',
  'throw',
  'throws',
  'throwing',
  'catch',
  'catches',
  'catching',
  'bounce',
  'bounces',
  'bouncing',
  'roll',
  'rolls',
  'rolling',
  'slide',
  'slides',
  'sliding',
  'collide',
  'collides',
  'collision',
  'crash',
  'crashes',
  'crashing',
  'hit',
  'hits',
  'hitting',
  'push',
  'pushes',
  'pushing',
  'pull',
  'pulls',
  'pulling',
  'swing',
  'swings',
  'swinging',
  'spin',
  'spins',
  'spinning',
  'rotate',
  'rotates',
  'rotating',
  'float',
  'floats',
  'floating',
  'sink',
  'sinks',
  'sinking',
  'splash',
  'splashes',
  'splashing',
  'pour',
  'pours',
  'pouring',
  'spill',
  'spills',
  'spilling',
  'break',
  'breaks',
  'breaking',
  'shatter',
  'shatters',
  'shattering',
  'explode',
  'explodes',
  'explosion',
  'jump',
  'jumps',
  'jumping',
  'leap',
  'leaps',
  'leaping',
  'land',
  'lands',
  'landing',
] as const;

/**
 * Temporal sequence indicators
 */
const TEMPORAL_INDICATORS = [
  'then',
  'after',
  'before',
  'next',
  'finally',
  'first',
  'second',
  'third',
  'meanwhile',
  'suddenly',
  'eventually',
  'later',
  'afterwards',
  'subsequently',
  'following',
  'preceding',
  'initially',
  'ultimately',
] as const;

/**
 * Physics triggers for Sora
 */
const PHYSICS_TRIGGERS = [
  'Newtonian physics',
  'momentum conservation',
  'surface friction',
] as const;

/**
 * Supported aspect ratios for Sora
 */
const SUPPORTED_ASPECT_RATIOS = [
  '16:9',
  '9:16',
  '1:1',
  '4:3',
  '3:4',
  '21:9',
] as const;

/**
 * Supported resolutions for Sora
 */
const SUPPORTED_RESOLUTIONS = [
  '1080p',
  '720p',
  '480p',
  '1920x1080',
  '1280x720',
  '1080x1920', // vertical
  '720x1280',  // vertical
] as const;


/**
 * Sora temporal sequence structure
 */
interface SoraShot {
  index: number;
  startTime: number;
  endTime: number;
  description: string;
  transitions?: string;
}

/**
 * Physics constraints detected in prompt
 */
interface PhysicsConstraints {
  gravity: boolean;
  momentum: boolean;
  collisions: boolean;
  friction: boolean;
}

/**
 * Sora sequence structure
 */
interface SoraSequence {
  shots: SoraShot[];
  physics: PhysicsConstraints;
}

/**
 * SoraStrategy optimizes prompts for OpenAI Sora 2's physics-grounded generation
 */
export class SoraStrategy extends BaseStrategy {
  readonly modelId = 'sora-2';
  readonly modelName = 'OpenAI Sora 2';

  /**
   * Validate input against Sora-specific constraints
   */
  protected async doValidate(input: string, context?: PromptContext): Promise<void> {
    // Check for aspect ratio constraints if provided
    if (context?.constraints?.formRequirement) {
      const aspectRatio = context.constraints.formRequirement;
      if (!SUPPORTED_ASPECT_RATIOS.includes(aspectRatio as typeof SUPPORTED_ASPECT_RATIOS[number])) {
        this.addWarning(`Aspect ratio "${aspectRatio}" may not be supported by Sora. Supported: ${SUPPORTED_ASPECT_RATIOS.join(', ')}`);
      }
    }

    // Check for resolution in apiParams
    if (context?.apiParams?.resolution) {
      const resolution = String(context.apiParams.resolution);
      if (!SUPPORTED_RESOLUTIONS.includes(resolution as typeof SUPPORTED_RESOLUTIONS[number])) {
        this.addWarning(`Resolution "${resolution}" may not be supported by Sora. Supported: ${SUPPORTED_RESOLUTIONS.join(', ')}`);
      }
    }

    // Check for very long prompts
    const wordCount = input.split(/\s+/).length;
    if (wordCount > 500) {
      this.addWarning('Prompt exceeds 500 words; Sora may truncate or ignore excess content');
    }

    // Check for potential physics violations
    const hasFloating = /\bfloat(?:s|ing)?\b/i.test(input) && !/\b(?:water|air|space|zero.?gravity)\b/i.test(input);
    if (hasFloating) {
      this.addWarning('Floating objects detected without context (water/air/space); may cause physics inconsistencies');
    }
  }

  /**
   * Normalize input
   * (Removed redundant public figure stripping; SafetySanitizer handles this now)
   */
  protected doNormalize(input: string, _context?: PromptContext): NormalizeResult {
    let text = input;
    const changes: string[] = [];
    const strippedTokens: string[] = [];

    // Clean up whitespace
    text = this.cleanWhitespace(text);

    return { text, changes, strippedTokens };
  }

  /**
   * Final adjustments after LLM rewrite
   */
  protected doTransform(llmPrompt: string | Record<string, unknown>, _ir: VideoPromptIR, _context?: PromptContext): TransformResult {
    const changes: string[] = [];
    let prompt = typeof llmPrompt === 'string' ? llmPrompt : JSON.stringify(llmPrompt);

    return { prompt, changes };
  }

  /**
   * Augment result with physics terms and response_format metadata
   */
  protected doAugment(
    result: PromptOptimizationResult,
    _context?: PromptContext
  ): AugmentResult {
    const changes: string[] = [];
    const triggersInjected: string[] = [];

    let prompt = typeof result.prompt === 'string' ? result.prompt : JSON.stringify(result.prompt);

    // Analyze if prompt has physics content
    const hasPhysicsContent = PHYSICS_INTERACTION_TERMS.some(term => 
      this.containsWord(prompt, term)
    );

    // Inject physics triggers if physics content detected
    if (hasPhysicsContent) {
      for (const trigger of PHYSICS_TRIGGERS) {
        if (!prompt.toLowerCase().includes(trigger.toLowerCase())) {
          prompt = `${prompt}, ${trigger}`;
          triggersInjected.push(trigger);
          changes.push(`Injected physics trigger: "${trigger}"`);
        }
      }
    } else {
      // Even without explicit physics, add basic physics grounding
      const basicTrigger = 'realistic physics';
      if (!prompt.toLowerCase().includes(basicTrigger)) {
        prompt = `${prompt}, ${basicTrigger}`;
        triggersInjected.push(basicTrigger);
        changes.push(`Injected basic physics trigger: "${basicTrigger}"`);
      }
    }

    // Add response_format metadata indicator
    const responseFormatTrigger = 'response_format: json_object';
    triggersInjected.push(responseFormatTrigger);
    changes.push('Added response_format metadata for API compatibility');

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
   * Analyze physics interactions in the prompt
   */
  private analyzePhysics(input: string): PhysicsConstraints {
    const lowerInput = input.toLowerCase();

    // Detect gravity-related interactions
    const gravityTerms = ['fall', 'drop', 'land', 'jump', 'leap', 'sink', 'float'];
    const gravity = gravityTerms.some(term => this.containsWord(lowerInput, term));

    // Detect momentum-related interactions
    const momentumTerms = ['throw', 'catch', 'push', 'pull', 'swing', 'spin', 'rotate', 'roll'];
    const momentum = momentumTerms.some(term => this.containsWord(lowerInput, term));

    // Detect collision-related interactions
    const collisionTerms = ['collide', 'crash', 'hit', 'bounce', 'break', 'shatter', 'explode'];
    const collisions = collisionTerms.some(term => this.containsWord(lowerInput, term));

    // Detect friction-related interactions
    const frictionTerms = ['slide', 'slip', 'skid', 'roll', 'drag', 'friction'];
    const friction = frictionTerms.some(term => this.containsWord(lowerInput, term));

    return { gravity, momentum, collisions, friction };
  }

  /**
   * Check if prompt needs temporal segmentation
   */
  private needsTemporalSegmentation(input: string): boolean {
    const lowerInput = input.toLowerCase();

    // Check for temporal indicators
    const hasTemporalIndicators = TEMPORAL_INDICATORS.some(indicator =>
      this.containsWord(lowerInput, indicator)
    );

    // Check for multiple sentences that suggest sequence
    const sentences = this.extractSentences(input);
    const hasMultipleSentences = sentences.length > 2;

    // Check for explicit shot/scene references
    const hasExplicitShots = /\b(?:shot|scene|cut|transition)\s*\d/i.test(input);

    return hasTemporalIndicators || hasExplicitShots || (hasMultipleSentences && hasTemporalIndicators);
  }

  /**
   * Segment prompt into temporal shots
   */
  private segmentIntoShots(input: string): SoraSequence {
    const shots: SoraShot[] = [];
    const physics = this.analyzePhysics(input);

    // Split by temporal indicators or sentences
    const segments = this.splitByTemporalIndicators(input);

    // Default shot duration (4 seconds each)
    const shotDuration = 4;
    let currentTime = 0;

    for (let i = 0; i < segments.length; i++) {
      const segmentItem = segments[i];
      if (!segmentItem) continue;
      const segment = segmentItem.trim();
      if (segment.length === 0) continue;

      const shot: SoraShot = {
        index: shots.length + 1,
        startTime: currentTime,
        endTime: currentTime + shotDuration,
        description: segment,
      };

      // Add transition if not the last shot
      if (i < segments.length - 1) {
        shot.transitions = 'cut';
      }

      shots.push(shot);
      currentTime += shotDuration;
    }

    // If no segments were created, create a single shot
    if (shots.length === 0) {
      shots.push({
        index: 1,
        startTime: 0,
        endTime: shotDuration,
        description: input,
      });
    }

    return { shots, physics };
  }

  /**
   * Split input by temporal indicators
   */
  private splitByTemporalIndicators(input: string): string[] {
    // Create pattern from temporal indicators
    const indicatorPattern = new RegExp(
      `\b(${TEMPORAL_INDICATORS.join('|')})\b`,
      'gi'
    );

    // Split by indicators, keeping the indicator with the following segment
    const parts = input.split(indicatorPattern);
    const segments: string[] = [];
    let currentSegment = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue;
      const isIndicator = TEMPORAL_INDICATORS.some(
        ind => ind.toLowerCase() === part.toLowerCase()
      );

      if (isIndicator) {
        // Save current segment if not empty
        if (currentSegment.trim()) {
          segments.push(currentSegment.trim());
        }
        // Start new segment with indicator
        currentSegment = part;
      } else {
        currentSegment += ' ' + part;
      }
    }

    // Add final segment
    if (currentSegment.trim()) {
      segments.push(currentSegment.trim());
    }

    // If no splits occurred, try splitting by sentences
    if (segments.length <= 1) {
      return this.extractSentences(input);
    }

    return segments;
  }

  /**
   * Format sequence into Sora prompt format
   */
  private formatSequence(sequence: SoraSequence): string {
    const parts: string[] = [];

    for (const shot of sequence.shots) {
      const timeRange = `${shot.startTime}-${shot.endTime}s`;
      parts.push(`Shot ${shot.index} (${timeRange}): ${shot.description}`);
      
      if (shot.transitions) {
        parts.push(`→ ${shot.transitions}`);
      }
    }

    return parts.join(' ');
  }

  /**
   * Extract @Cameo tokens from text
   */
  public extractCameoTokens(text: string): string[] {
    const tokens: string[] = [];
    const pattern = new RegExp(CAMEO_TOKEN_PATTERN.source, 'g');
    let match;
    while ((match = pattern.exec(text)) !== null) {
      tokens.push(match[0]);
    }
    return tokens;
  }
}

/**
 * Singleton instance for convenience
 */
export const soraStrategy = new SoraStrategy();