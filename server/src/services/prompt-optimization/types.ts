/**
 * Types for prompt optimization services
 * Shared type definitions used across prompt optimization modules
 */
import type { ExecuteParams } from '@services/ai-model/AIModelService';
import type { AIResponse } from '@interfaces/IAIClient';
import type { CapabilityValues } from '@shared/capabilities';

/**
 * Optimization mode type
 */
export type OptimizationMode = 'video' | 'reasoning' | 'research' | 'socratic' | 'optimize';

/**
 * Context inferred from prompt
 */
export interface InferredContext {
  specificAspects: string;
  backgroundLevel: 'beginner' | 'intermediate' | 'advanced';
  intendedUse: string;
}

/**
 * Quality assessment result
 */
export interface QualityAssessment {
  score: number;
  details: {
    clarity: number;
    specificity: number;
    structure: number;
    completeness: number;
    actionability: number;
  };
  strengths: string[];
  weaknesses: string[];
}

export interface LockedSpan {
  id?: string;
  text: string;
  leftCtx?: string | null;
  rightCtx?: string | null;
  category?: string | null;
  source?: string | null;
  confidence?: number | null;
}

/**
 * Shot plan from interpreter
 */
export interface ShotPlan {
  shot_type: string;
  core_intent: string;
  subject?: string | null;
  action?: string | null;
  visual_focus?: string | null;
  setting?: string | null;
  time?: string | null;
  mood?: string | null;
  style?: string | null;
  camera_move?: string | null;
  camera_angle?: string | null;
  lighting?: string | null;
  audio?: string | null;
  duration_hint?: string | null;
  risks?: string[];
  confidence?: number;
}

/**
 * Optimization request parameters
 */
export interface OptimizationRequest {
  prompt: string;
  mode?: OptimizationMode;
  targetModel?: string; // e.g., 'runway', 'luma', 'veo'
  context?: InferredContext | null;
  brainstormContext?: Record<string, unknown> | null;
  generationParams?: CapabilityValues | null;
  skipCache?: boolean;
  lockedSpans?: LockedSpan[];
  shotPlan?: ShotPlan | null;
  shotPlanAttempted?: boolean;
  domainContent?: string | null;
  useConstitutionalAI?: boolean;
  useIterativeRefinement?: boolean;
  onMetadata?: (metadata: Record<string, unknown>) => void;
  signal?: AbortSignal;
}

export interface TwoStageOptimizationRequest {
  prompt: string;
  mode?: OptimizationMode;
  targetModel?: string; // e.g., 'runway', 'luma', 'veo'
  context?: InferredContext | null;
  brainstormContext?: Record<string, unknown> | null;
  generationParams?: CapabilityValues | null;
  skipCache?: boolean;
  lockedSpans?: LockedSpan[];
  onDraft?: ((draft: string, spans: any) => void) | null;
  signal?: AbortSignal;
}

/**
 * Two-stage optimization result
 */
export interface TwoStageOptimizationResult {
  draft: string;
  refined: string;
  draftSpans?: { spans?: unknown[]; meta?: unknown } | null;
  refinedSpans?: { spans?: unknown[]; meta?: unknown } | null;
  metadata?: Record<string, unknown>;
  usedFallback?: boolean;
  error?: string;
}

/**
 * Optimization strategy interface
 */
export interface OptimizationStrategy {
  optimize(request: OptimizationRequest): Promise<string>;
  generateDomainContent?(prompt: string, context?: InferredContext | null, shotPlan?: ShotPlan | null): Promise<unknown>;
  name: string;
}

/**
 * AI Service interface (minimal)
 */
export interface AIService {
  execute(operation: string, options: ExecuteParams): Promise<AIResponse>;
  supportsStreaming?(operation: string): boolean;
  getAvailableClients?(): string[];
}

/**
 * Template service interface (minimal)
 */
export interface TemplateService {
  getTemplate?(name: string, version?: string): Promise<string>;
  load?(templateName: string, variables?: Record<string, string | number | null | undefined>): Promise<string>;
  loadSection?(sectionName: string, variables?: Record<string, string | number | null | undefined>): Promise<string>;
}
