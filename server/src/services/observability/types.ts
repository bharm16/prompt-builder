export type StageName =
  | 'shot_interpreter'
  | 'strategy'
  | 'constitutional'
  | 'intent_lock'
  | 'compilation'
  | 'prompt_lint'
  | 'cache';

export type OptimizeOutcome = 'success' | 'error' | 'aborted';

export interface OptimizeTraceCompleteSummary {
  outcome: OptimizeOutcome;
  promptLength: number;
  outputLength: number;
  lockedSpanCount: number;
  targetModel: string | null;
  mode: 'video';
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
  mode: 'video';
  promptLength: number;
  outputLength: number;
  lockedSpanCount: number;
  hasContext: boolean;
  hasBrainstormContext: boolean;
  hasShotPlan: boolean;
  useConstitutionalAI: boolean;
  stages: OptimizeEventStages;
}

export type LlmCallOutcome = 'success' | 'error';

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
