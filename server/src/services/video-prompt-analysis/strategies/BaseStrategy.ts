/**
 * BaseStrategy Abstract Class
 *
 * Provides common pipeline logic for all model-specific optimization strategies.
 * Implements shared validate, normalize, transform, augment scaffolding with
 * integrated SafetySanitizer calls, post-IR TechStripper, plus metadata tracking and timing.
 *
 * @module BaseStrategy
 */

import { TechStripper, techStripper } from '../utils/TechStripper';
import { SafetySanitizer, safetySanitizer } from '../utils/SafetySanitizer';
import { VideoPromptAnalyzer } from '../services/analysis/VideoPromptAnalyzer';
import { VideoPromptLLMRewriter } from '../services/rewriter/VideoPromptLLMRewriter';
import type {
  PromptOptimizationStrategy,
  PromptOptimizationResult,
  PromptContext,
  OptimizationMetadata,
  PhaseResult,
  VideoPromptIR,
  RewriteConstraints,
} from './types';

/**
 * Pipeline version for tracking optimization changes
 */
const PIPELINE_VERSION = '2.0.0';

export interface BaseStrategyDeps {
  techStripper?: TechStripper;
  safetySanitizer?: SafetySanitizer;
  analyzer?: VideoPromptAnalyzer;
  llmRewriter?: VideoPromptLLMRewriter;
}

/**
 * BaseStrategy provides common pipeline infrastructure for all model strategies.
 *
 * Subclasses must implement:
 * - `doValidate`: Model-specific validation logic
 * - `doNormalize`: Model-specific normalization after common processing
 * - `doTransform`: Final model-specific adjustments after LLM rewrite
 * - `doAugment`: Model-specific augmentation logic
 */
export abstract class BaseStrategy implements PromptOptimizationStrategy {
  abstract readonly modelId: string;
  abstract readonly modelName: string;

  protected readonly techStripper: TechStripper;
  protected readonly safetySanitizer: SafetySanitizer;
  protected readonly analyzer: VideoPromptAnalyzer;
  protected readonly llmRewriter: VideoPromptLLMRewriter;

  // Accumulated metadata during pipeline execution
  private currentMetadata: OptimizationMetadata | null = null;

  constructor(deps?: BaseStrategyDeps);
  constructor(
    techStripperInstance?: TechStripper,
    safetySanitizerInstance?: SafetySanitizer,
    analyzerInstance?: VideoPromptAnalyzer,
    llmRewriterInstance?: VideoPromptLLMRewriter
  );
  constructor(
    arg1?: BaseStrategyDeps | TechStripper,
    arg2?: SafetySanitizer,
    arg3?: VideoPromptAnalyzer,
    arg4?: VideoPromptLLMRewriter
  ) {
    if (arguments.length > 1) {
      const positionalTechStripper = arg1 as TechStripper | undefined;
      this.techStripper =
        positionalTechStripper && typeof positionalTechStripper.strip === 'function'
          ? positionalTechStripper
          : techStripper;
      this.safetySanitizer = arg2 ?? safetySanitizer;
      this.analyzer = arg3 ?? new VideoPromptAnalyzer();
      this.llmRewriter = arg4 ?? new VideoPromptLLMRewriter();
      return;
    }

    const deps = (arg1 ?? {}) as BaseStrategyDeps;
    this.techStripper = deps.techStripper ?? techStripper;
    this.safetySanitizer = deps.safetySanitizer ?? safetySanitizer;
    this.analyzer = deps.analyzer ?? new VideoPromptAnalyzer();
    this.llmRewriter = deps.llmRewriter ?? new VideoPromptLLMRewriter();
  }

  /**
   * Initialize fresh metadata for a new pipeline run
   */
  protected initializeMetadata(): OptimizationMetadata {
    return {
      modelId: this.modelId,
      pipelineVersion: PIPELINE_VERSION,
      phases: [],
      warnings: [],
      tokensStripped: [],
      triggersInjected: [],
    };
  }

  /**
   * Record a phase result in the current metadata
   */
  protected recordPhaseResult(result: PhaseResult): void {
    if (this.currentMetadata) {
      this.currentMetadata.phases.push(result);
    }
  }

  /**
   * Add a warning to the current metadata
   */
  protected addWarning(warning: string): void {
    if (this.currentMetadata && !this.currentMetadata.warnings.includes(warning)) {
      this.currentMetadata.warnings.push(warning);
    }
  }

  /**
   * Record stripped tokens in metadata
   */
  protected recordStrippedTokens(tokens: string[]): void {
    if (this.currentMetadata) {
      for (const token of tokens) {
        if (!this.currentMetadata.tokensStripped.includes(token)) {
          this.currentMetadata.tokensStripped.push(token);
        }
      }
    }
  }

  /**
   * Record injected triggers in metadata
   */
  protected recordInjectedTriggers(triggers: string[]): void {
    if (this.currentMetadata) {
      for (const trigger of triggers) {
        if (!this.currentMetadata.triggersInjected.includes(trigger)) {
          this.currentMetadata.triggersInjected.push(trigger);
        }
      }
    }
  }

  /**
   * Get the current metadata (for use in transform/augment phases)
   */
  protected getMetadata(): OptimizationMetadata {
    if (!this.currentMetadata) {
      this.currentMetadata = this.initializeMetadata();
    }
    return this.currentMetadata;
  }

  // ============================================================
  // Public Pipeline Methods (implements PromptOptimizationStrategy)
  // ============================================================

  /**
   * Phase 0: Validate input against model constraints
   * Runs model-specific validation after basic checks
   */
  async validate(input: string, context?: PromptContext): Promise<void> {
    // Basic validation
    if (!input || typeof input !== 'string') {
      throw new Error('Input must be a non-empty string');
    }

    if (input.trim().length === 0) {
      throw new Error('Input cannot be empty or whitespace only');
    }

    // Model-specific validation
    await this.doValidate(input, context);
  }

  /**
   * Phase 1: Normalize input (safety compliance + model-specific cleanup)
   *
   * Pipeline:
   * 1. Apply SafetySanitizer (safety compliance)
   * 2. Apply model-specific normalization
   */
  normalize(input: string, context?: PromptContext): string {
    const startTime = performance.now();
    const changes: string[] = [];

    // Initialize metadata for this pipeline run
    this.currentMetadata = this.initializeMetadata();

    let processedText = input;

    // Step 1: Safety sanitization
    const sanitizerResult = this.safetySanitizer.sanitize(processedText);
    if (sanitizerResult.wasModified) {
      processedText = sanitizerResult.text;
      for (const replacement of sanitizerResult.replacements) {
        changes.push(`Replaced "${replacement.original}" with "${replacement.replacement}" (${replacement.category})`);
        this.recordStrippedTokens([replacement.original]);
      }
    }

    // Step 2: Model-specific normalization
    const modelNormalizeResult = this.doNormalize(processedText, context);
    if (modelNormalizeResult.text !== processedText) {
      processedText = modelNormalizeResult.text;
      changes.push(...modelNormalizeResult.changes);
      this.recordStrippedTokens(modelNormalizeResult.strippedTokens);
    }

    // Record phase result
    const durationMs = performance.now() - startTime;
    this.recordPhaseResult({
      phase: 'normalize',
      durationMs,
      changes,
    });

    return processedText;
  }

  /**
   * Phase 2: Transform normalized input into model-native structure using LLM
   */
  async transform(input: string, context?: PromptContext): Promise<PromptOptimizationResult> {
    const startTime = performance.now();

    // 1. IR Analysis (Now the primary driver for LLM rewrite)
    const ir = await this.analyzer.analyze(input);

    // 2. LLM-powered rewrite (Consumes structured IR)
    const rewriteConstraints = this.getRewriteConstraints(ir, context);
    let rewrittenPrompt: string | Record<string, unknown>;
    let rewriteFallbackUsed = false;
    try {
      rewrittenPrompt = await this.llmRewriter.rewrite(ir, this.modelId, rewriteConstraints);
    } catch (error) {
      // Keep the strategy pipeline deterministic even when the LLM provider is unavailable.
      rewrittenPrompt = ir.raw;
      rewriteFallbackUsed = true;

      const message = error instanceof Error ? error.message : String(error);
      this.addWarning(`LLM rewrite unavailable; using fallback prompt (${message})`);
    }

    // 2.5. Post-IR TechStripper (model-aware placebo removal on LLM output)
    let postRewritePrompt = rewrittenPrompt as string | Record<string, unknown>;
    const postStripChanges: string[] = [];
    if (typeof rewrittenPrompt === 'string') {
      const stripperResult = this.techStripper.strip(rewrittenPrompt, this.modelId);
      if (stripperResult.tokensWereStripped) {
        postRewritePrompt = stripperResult.text;
        this.recordStrippedTokens(stripperResult.strippedTokens);
        postStripChanges.push(
          `Stripped placebo tokens post-IR: ${stripperResult.strippedTokens.join(', ')}`
        );
      }
    }

    // 3. Model-specific final adjustments
    const transformResult = this.doTransform(postRewritePrompt, ir, context);

    this.recordPhaseResult({
      phase: 'transform',
      durationMs: performance.now() - startTime,
      changes: [
        ...transformResult.changes,
        rewriteFallbackUsed
          ? 'LLM rewrite unavailable; used deterministic fallback from analyzed prompt'
          : 'LLM-powered model rewrite from IR',
        ...postStripChanges,
      ],
    });

    const result: PromptOptimizationResult = {
      prompt: transformResult.prompt,
      metadata: this.getMetadata(),
    };

    if (transformResult.negativePrompt !== undefined) {
      result.negativePrompt = transformResult.negativePrompt;
    }

    return result;
  }

  /**
   * Phase 3: Augment result with model-specific triggers
   */
  augment(
    result: PromptOptimizationResult,
    context?: PromptContext
  ): PromptOptimizationResult {
    const startTime = performance.now();

    // Perform model-specific augmentation
    const augmentResult = this.doAugment(result, context);

    // Record injected triggers
    this.recordInjectedTriggers(augmentResult.triggersInjected);

    // Record phase result
    const durationMs = performance.now() - startTime;
    this.recordPhaseResult({
      phase: 'augment',
      durationMs,
      changes: augmentResult.changes,
    });

    // Return final result with complete metadata
    const finalResult: PromptOptimizationResult = {
      prompt: augmentResult.prompt,
      metadata: this.getMetadata(),
    };

    if (augmentResult.negativePrompt !== undefined) {
      finalResult.negativePrompt = augmentResult.negativePrompt;
    }

    return finalResult;
  }

  // ============================================================
  // Abstract Methods (must be implemented by subclasses)
  // ============================================================

  /**
   * Model-specific validation logic
   * Override to add constraints like aspect ratio, duration, physics checks
   *
   * @param input - The input text to validate
   * @param context - Optional context with constraints and history
   * @throws Error if validation fails
   */
  protected abstract doValidate(
    input: string,
    context?: PromptContext
  ): Promise<void>;

  /**
   * Model-specific normalization after common processing
   *
   * @param input - Text after SafetySanitizer and TechStripper
   * @param context - Optional context
   * @returns Normalized text with changes and stripped tokens
   */
  protected abstract doNormalize(
    input: string,
    context?: PromptContext
  ): NormalizeResult;

  /**
   * Model-specific final adjustments after LLM rewrite
   */
  protected abstract doTransform(
    llmPrompt: string | Record<string, unknown>,
    ir: VideoPromptIR,
    context?: PromptContext
  ): TransformResult;

  /**
   * Model-specific augmentation logic
   *
   * @param result - Result from transform phase
   * @param context - Optional context
   * @returns Augmented result with triggers
   */
  protected abstract doAugment(
    result: PromptOptimizationResult,
    context?: PromptContext
  ): AugmentResult;

  // ============================================================
  // Utility Methods (available to subclasses)
  // ============================================================

  /**
   * Clean up whitespace in text
   */
  protected cleanWhitespace(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/\s*,\s*,/g, ',')
      .replace(/,\s*$/g, '')
      .replace(/^\s*,/g, '')
      .replace(/\s*,/g, ',')
      .replace(/,\s*/g, ', ')
      .trim();
  }

  /**
   * Extract sentences from text
   */
  protected extractSentences(text: string): string[] {
    return text
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  /**
   * Check if text contains a word (case-insensitive, word boundary)
   */
  protected containsWord(text: string, word: string): boolean {
    const pattern = new RegExp(`\\b${this.escapeRegex(word)}\\b`, 'i');
    return pattern.test(text);
  }

  /**
   * Replace a word in text (case-insensitive, word boundary)
   */
  protected replaceWord(text: string, word: string, replacement: string): string {
    const pattern = new RegExp(`\\b${this.escapeRegex(word)}\\b`, 'gi');
    return text.replace(pattern, replacement);
  }

  /**
   * Escape special regex characters
   */
  protected escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Provide model-specific constraints for the LLM rewrite.
   * Override to inject mandatory or suggested triggers without blind string concatenation.
   */
  protected getRewriteConstraints(
    _ir: VideoPromptIR,
    _context?: PromptContext
  ): RewriteConstraints {
    return {};
  }

  /**
   * Ensure mandatory constraints appear in the prompt, appending only if missing.
   */
  protected enforceMandatoryConstraints(
    prompt: string,
    constraints: string[]
  ): { prompt: string; injected: string[]; changes: string[] } {
    if (constraints.length === 0) {
      return { prompt, injected: [], changes: [] };
    }

    let nextPrompt = prompt;
    const injected: string[] = [];
    const changes: string[] = [];

    for (const constraint of constraints) {
      if (!nextPrompt.toLowerCase().includes(constraint.toLowerCase())) {
        nextPrompt = `${nextPrompt}, ${constraint}`;
        injected.push(constraint);
        changes.push(`Injected mandatory constraint: "${constraint}"`);
      }
    }

    return {
      prompt: this.cleanWhitespace(nextPrompt),
      injected,
      changes,
    };
  }
}

// ============================================================
// Result Types for Abstract Methods
// ============================================================

/**
 * Result from model-specific normalization
 */
export interface NormalizeResult {
  /** The normalized text */
  text: string;
  /** Description of changes made */
  changes: string[];
  /** Tokens that were stripped */
  strippedTokens: string[];
}

/**
 * Result from model-specific transformation
 */
export interface TransformResult {
  /** The transformed prompt (string or object) */
  prompt: string | Record<string, unknown>;
  /** Optional negative prompt */
  negativePrompt?: string;
  /** Description of changes made */
  changes: string[];
}

/**
 * Result from model-specific augmentation
 */
export interface AugmentResult {
  /** The augmented prompt */
  prompt: string | Record<string, unknown>;
  /** Optional negative prompt */
  negativePrompt?: string;
  /** Description of changes made */
  changes: string[];
  /** Triggers that were injected */
  triggersInjected: string[];
}

/**
 * Optional constraints for LLM rewrite.
 */
