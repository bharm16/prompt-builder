/**
 * Types for prompt optimization services
 * Shared type definitions used across prompt optimization modules
 */

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
  context?: InferredContext | null;
  brainstormContext?: Record<string, unknown> | null;
  shotPlan?: ShotPlan | null;
  useConstitutionalAI?: boolean;
  useIterativeRefinement?: boolean;
  domainContent?: unknown;
}

/**
 * Two-stage optimization request
 */
export interface TwoStageOptimizationRequest {
  prompt: string;
  mode?: OptimizationMode;
  context?: InferredContext | null;
  brainstormContext?: Record<string, unknown> | null;
  onDraft?: ((draft: string) => void) | null;
}

/**
 * Two-stage optimization result
 */
export interface TwoStageOptimizationResult {
  draft: string;
  refined: string;
  metadata?: {
    draftTime?: number;
    refinementTime?: number;
    usedFallback?: boolean;
  };
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
  execute(operation: string, options: {
    systemPrompt: string;
    userMessage?: string;
    maxTokens?: number;
    temperature?: number;
    timeout?: number;
  }): Promise<{ text?: string; content?: Array<{ text: string }> }>;
  supportsStreaming?(operation: string): boolean;
  getAvailableClients?(): string[];
}

/**
 * Template service interface (minimal)
 */
export interface TemplateService {
  getTemplate?(name: string, version?: string): Promise<string>;
  [key: string]: unknown;
}

