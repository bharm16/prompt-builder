export type StageName =
  | "shot_interpreter"
  | "strategy"
  | "constitutional"
  | "intent_lock"
  | "compilation"
  | "prompt_lint"
  | "cache";

export type OptimizeOutcome = "success" | "error" | "aborted";

export interface OptimizeTraceCompleteSummary {
  outcome: OptimizeOutcome;
  promptLength: number;
  outputLength: number;
  lockedSpanCount: number;
  targetModel: string | null;
  mode: "video";
  hasContext: boolean;
  hasBrainstormContext: boolean;
  hasShotPlan: boolean;
  useConstitutionalAI: boolean;
}

export interface OptimizeEventStages {
  shotInterpreterMs: number | null;
  strategyOptimizeMs: number | null;
  constitutionalMs: number | null;
  intentLockMs: number | null;
  compilationMs: number | null;
  promptLintMs: number | null;
}

export interface OptimizeEventProperties {
  requestId: string;
  userId: string | null;
  outcome: OptimizeOutcome;
  errorMessage?: string;
  errorStage?: StageName;
  durationMs: number;
  llmCallCount: number;
  cacheHit: boolean;
  targetModel: string | null;
  mode: "video";
  promptLength: number;
  outputLength: number;
  lockedSpanCount: number;
  hasContext: boolean;
  hasBrainstormContext: boolean;
  hasShotPlan: boolean;
  useConstitutionalAI: boolean;
  stages: OptimizeEventStages;
}

// ----- LLM call telemetry -----

export type LlmCallOutcome = "success" | "error";

export interface LlmCallSummary {
  executionType: string;
  durationMs: number;
  provider: string | null;
  model: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  finishReason: string | null;
  outcome: LlmCallOutcome;
  errorMessage?: string;
  userId?: string | null;
}

export interface LlmCallEventProperties {
  executionType: string;
  provider: string | null;
  model: string | null;
  durationMs: number;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  finishReason: string | null;
  outcome: LlmCallOutcome;
  errorMessage?: string;
  requestId?: string;
  userId: string | null;
}

// ----- Suggestions telemetry -----

export type SuggestionsStageName =
  | "video_context"
  | "span_context"
  | "cache"
  | "v2_engine"
  | "post_processing";

export type SuggestionsOutcome = "success" | "error" | "aborted";

export interface SuggestionsTraceCompleteSummary {
  outcome: SuggestionsOutcome;
  promptLength: number;
  suggestionCount: number;
  highlightedCategory: string | null;
  isVideoPrompt: boolean;
  isPlaceholder: boolean;
  modelTarget: string | null;
  promptSection: string | null;
  phraseRole: string | null;
  policyVersion: string | null;
  categoryId: string | null;
  engineMode: string | null;
  modelCallCount: number;
  fallbackApplied: boolean;
  debug: boolean;
}

export interface SuggestionsEventStages {
  videoContextMs: number | null;
  spanContextMs: number | null;
  cacheCheckMs: number | null;
  v2EngineMs: number | null;
  postProcessingMs: number | null;
}

export interface SuggestionsEventProperties {
  requestId: string;
  userId: string | null;
  outcome: SuggestionsOutcome;
  errorMessage?: string;
  errorStage?: SuggestionsStageName;
  durationMs: number;
  cacheHit: boolean;
  suggestionCount: number;
  highlightedCategory: string | null;
  promptLength: number;
  isVideoPrompt: boolean;
  isPlaceholder: boolean;
  modelTarget: string | null;
  promptSection: string | null;
  phraseRole: string | null;
  policyVersion: string | null;
  categoryId: string | null;
  engineMode: string | null;
  modelCallCount: number;
  fallbackApplied: boolean;
  debug: boolean;
  stages: SuggestionsEventStages;
}
