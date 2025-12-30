/**
 * Types for video model prompt optimization strategies
 * Defines interfaces for the 3-phase optimization pipeline (Normalize → Transform → Augment)
 */

import type { ConstraintConfig, EditHistoryEntry, VideoPromptIR } from '../types';

export type { VideoPromptIR };

/**
 * Result of a single pipeline phase
 */
export interface PhaseResult {
  phase: 'normalize' | 'transform' | 'augment';
  durationMs: number;
  changes: string[];
}

/**
 * Metadata about the optimization process
 */
export interface OptimizationMetadata {
  modelId: string;
  pipelineVersion: string;
  phases: PhaseResult[];
  warnings: string[];
  tokensStripped: string[];
  triggersInjected: string[];
}

/**
 * Result of prompt optimization pipeline
 */
export interface PromptOptimizationResult {
  /** The optimized prompt (string for text-based, object for JSON-based like Veo) */
  prompt: string | Record<string, unknown>;
  /** Optional negative prompt for models that support it */
  negativePrompt?: string;
  /** Metadata about the optimization process */
  metadata: OptimizationMetadata;
}

/**
 * Reference to an asset (image, video, or cameo identity)
 */
export interface AssetReference {
  type: 'image' | 'video' | 'cameo';
  localPath?: string;
  url?: string;
  token?: string;
  description?: string;
}

/**
 * Context provided to optimization strategies
 */
export interface PromptContext {
  userIntent: string;
  detectedSection?: string;
  constraints?: ConstraintConfig;
  history?: EditHistoryEntry[];
  apiParams?: Record<string, unknown>;
  assets?: AssetReference[];
}

/**
 * Strategy interface for model-specific optimization
 * Each video model (Runway, Luma, Kling, Sora, Veo) implements this interface
 */
export interface PromptOptimizationStrategy {
  readonly modelId: string;
  readonly modelName: string;

  /**
   * Phase 0: Validate input against model constraints (Aspect ratios, duration, physics)
   * Returns warnings or throws errors for hard constraints.
   */
  validate(input: string, context?: PromptContext): Promise<void>;

  /**
   * Phase 1: Strip incompatible tokens and normalize input
   */
  normalize(input: string, context?: PromptContext): string;

  /**
   * Phase 2: Translate intent into model-native structure
   */
  transform(input: string, context?: PromptContext): Promise<PromptOptimizationResult>;

  /**
   * Phase 3: Inject model-specific triggers and enforce compliance
   * Note: Runway strategy must inject VLM descriptions from assets here.
   */
  augment(
    result: PromptOptimizationResult,
    context?: PromptContext
  ): PromptOptimizationResult;
}
