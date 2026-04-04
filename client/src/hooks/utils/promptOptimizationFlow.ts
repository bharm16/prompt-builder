import { logger } from "../../services/LoggingService";
import type { Toast } from "../types";
import type { LockedSpan } from "@/features/prompt-optimizer/types";
import type { I2VOptimizationResult } from "@/features/prompt-optimizer/types/i2v";
import type { CapabilityValues } from "@shared/capabilities";

export interface PromptOptimizerActions {
  setOptimizedPrompt: (prompt: string) => void;
  setDisplayedPrompt: (prompt: string) => void;
  setGenericOptimizedPrompt: (prompt: string | null) => void;
  setArtifactKey: (artifactKey: string | null) => void;
  setQualityScore: (score: number | null) => void;
  setPreviewPrompt: (prompt: string | null) => void;
  setPreviewAspectRatio: (ratio: string | null) => void;
  bumpOptimizationResultVersion: () => void;
  rollback: () => void;
}

export interface OptimizationOutcome {
  optimized: string;
  score: number;
}

type AnalyzeAndOptimize = (options: {
  prompt: string;
  targetModel?: string;
  context?: unknown | null;
  brainstormContext?: unknown | null;
  skipCache?: boolean;
  lockedSpans?: LockedSpan[];
  startImage?: string;
  sourcePrompt?: string;
  constraintMode?: "strict" | "flexible" | "transform";
  signal?: AbortSignal;
}) => Promise<{
  prompt: string;
  optimizedPrompt?: string;
  inputMode?: "t2v" | "i2v";
  artifactKey?: string;
  metadata?: Record<string, unknown>;
  i2v?: I2VOptimizationResult;
}>;

export interface RunOptimizationOptions {
  promptToOptimize: string;
  selectedMode: string;
  selectedModel?: string;
  context: unknown | null;
  brainstormContext: unknown | null;
  generationParams?: CapabilityValues;
  startImage?: string;
  sourcePrompt?: string;
  constraintMode?: "strict" | "flexible" | "transform";
  abortController: AbortController;
  skipCache?: boolean;
  lockedSpans?: LockedSpan[];
  actions: PromptOptimizerActions;
  toast: Toast;
  log: ReturnType<typeof logger.child>;
  analyzeAndOptimize: AnalyzeAndOptimize;
  calculateQualityScore: (inputPrompt: string, outputPrompt: string) => number;
}

export async function runOptimization({
  promptToOptimize,
  selectedMode,
  selectedModel,
  context,
  brainstormContext,
  generationParams,
  startImage,
  sourcePrompt,
  constraintMode,
  abortController,
  skipCache,
  lockedSpans,
  actions,
  toast,
  log,
  analyzeAndOptimize,
  calculateQualityScore,
}: RunOptimizationOptions): Promise<OptimizationOutcome | null> {
  log.debug("Starting optimization", {
    operation: "optimize",
    stage: "json",
    mode: selectedMode,
  });

  const response = await analyzeAndOptimize({
    prompt: promptToOptimize,
    context,
    brainstormContext,
    signal: abortController.signal,
    ...(selectedModel ? { targetModel: selectedModel } : {}),
    ...(generationParams ? { generationParams } : {}),
    ...(skipCache ? { skipCache } : {}),
    ...(lockedSpans && lockedSpans.length > 0 ? { lockedSpans } : {}),
    ...(startImage ? { startImage } : {}),
    ...(sourcePrompt ? { sourcePrompt } : {}),
    ...(constraintMode ? { constraintMode } : {}),
  });

  const optimized = response.prompt || response.optimizedPrompt || "";
  const score = calculateQualityScore(promptToOptimize, optimized);

  actions.setOptimizedPrompt(optimized);
  actions.setDisplayedPrompt(optimized);
  actions.setQualityScore(score);
  if (
    response.metadata?.genericPrompt &&
    typeof response.metadata.genericPrompt === "string"
  ) {
    actions.setGenericOptimizedPrompt(response.metadata.genericPrompt);
  }
  actions.setArtifactKey(
    typeof response.artifactKey === "string"
      ? response.artifactKey
      : typeof response.metadata?.artifactKey === "string"
        ? response.metadata.artifactKey
        : null,
  );
  if (
    response.metadata?.previewPrompt &&
    typeof response.metadata.previewPrompt === "string"
  ) {
    actions.setPreviewPrompt(response.metadata.previewPrompt);
  }
  if (
    typeof response.metadata?.aspectRatio === "string" &&
    response.metadata.aspectRatio.trim()
  ) {
    actions.setPreviewAspectRatio(response.metadata.aspectRatio.trim());
  }
  actions.bumpOptimizationResultVersion();

  if (score >= 80) {
    toast.success(`Excellent prompt! Quality score: ${score}%`);
  } else if (score >= 60) {
    toast.info(`Good prompt! Quality score: ${score}%`);
  } else {
    toast.warning(`Prompt could be improved. Score: ${score}%`);
  }

  if (
    response.i2v &&
    Array.isArray(response.i2v.conflicts) &&
    response.i2v.conflicts.length > 0
  ) {
    const conflictCount = response.i2v.conflicts.length;
    const mode = response.i2v.appliedMode;
    if (mode === "flexible") {
      toast.warning(
        `${conflictCount} visual conflict${conflictCount === 1 ? "" : "s"} detected. Results may vary.`,
      );
    } else if (mode === "strict") {
      toast.info(
        `${conflictCount} conflicting visual description${conflictCount === 1 ? "" : "s"} removed.`,
      );
    }
  }

  const duration = logger.endTimer("optimize");
  log.info("Optimization completed", {
    operation: "optimize",
    duration,
    score,
    outputLength: optimized?.length || 0,
  });

  return { optimized, score };
}
