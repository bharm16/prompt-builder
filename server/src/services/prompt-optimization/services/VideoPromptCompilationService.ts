import { logger } from "@infrastructure/Logger";
import type { ILogger } from "@interfaces/ILogger";
import { resolvePromptModelId } from "@services/video-models/ModelRegistry";
import type {
  CompilationState,
  CompileContext,
  CompilePromptResponse,
  CompileSource,
  OptimizationMode,
  StructuredOptimizationArtifact,
} from "../types";
import type { VideoPromptService } from "../../video-prompt-analysis/VideoPromptService";
import type { PromptContext } from "../../video-prompt-analysis/strategies/types";

interface StructuredArtifactCacheLike {
  getStructuredArtifact(
    key: string,
  ): Promise<StructuredOptimizationArtifact | null>;
}

interface CompileParams {
  operation: string;
  mode: OptimizationMode;
  targetModel?: string;
  source: CompileSource;
  context?: CompileContext | null;
  fallbackPrompt?: string;
  artifactKey?: string;
}

interface CompileResult {
  prompt: string;
  metadata: Record<string, unknown> | null;
  compilation: CompilationState;
  artifactKey?: string;
}

interface ResolvedCompileSource {
  sourceKind: CompileSource["kind"];
  compileInput: string;
  trustedArtifact: StructuredOptimizationArtifact | null;
  artifactKey?: string;
  usedFallback: boolean;
  reason?: string;
  genericPrompt?: string;
}

export class VideoPromptCompilationService {
  private readonly videoPromptService: VideoPromptService;
  private readonly log: ILogger;
  private readonly structuredArtifactCache: StructuredArtifactCacheLike | null;

  constructor(
    videoPromptService: VideoPromptService,
    structuredArtifactCache: StructuredArtifactCacheLike | null = null,
  ) {
    this.videoPromptService = videoPromptService;
    this.structuredArtifactCache = structuredArtifactCache;
    this.log = logger.child({ service: "VideoPromptCompilationService" });
  }

  async compile({
    operation,
    mode,
    targetModel,
    source,
    context = null,
    fallbackPrompt,
    artifactKey,
  }: CompileParams): Promise<CompileResult> {
    const resolvedSource = await this.resolveSource(source, fallbackPrompt);
    const resolvedTargetModel = this.resolveTargetModel(targetModel);
    const artifactRef =
      artifactKey ??
      (source.kind === "artifactKey"
        ? source.artifactKey
        : resolvedSource.artifactKey);

    if (mode !== "video") {
      return this.buildResult({
        prompt: resolvedSource.compileInput,
        compilation: {
          status: "compile-skipped",
          usedFallback: resolvedSource.usedFallback,
          reason: "Compilation skipped for non-video mode.",
          sourceKind: resolvedSource.sourceKind,
          structuredArtifactReused: false,
          analyzerBypassed: false,
          compiledFor: null,
        },
        ...(resolvedSource.genericPrompt
          ? { genericPrompt: resolvedSource.genericPrompt }
          : {}),
        ...(artifactRef ? { artifactKey: artifactRef } : {}),
      });
    }

    if (!resolvedTargetModel) {
      return this.buildResult({
        prompt: resolvedSource.compileInput,
        compilation: {
          status: "compile-skipped",
          usedFallback: resolvedSource.usedFallback,
          reason: "No target model provided for compilation.",
          sourceKind: resolvedSource.sourceKind,
          structuredArtifactReused: false,
          analyzerBypassed: false,
          compiledFor: null,
        },
        ...(resolvedSource.genericPrompt
          ? { genericPrompt: resolvedSource.genericPrompt }
          : {}),
        ...(artifactRef ? { artifactKey: artifactRef } : {}),
      });
    }

    if (!resolvedSource.compileInput.trim()) {
      return this.buildResult({
        prompt: "",
        compilation: {
          status: "compile-skipped",
          usedFallback: true,
          reason:
            resolvedSource.reason ??
            "Structured artifact was unavailable and no raw prompt fallback was provided.",
          sourceKind: resolvedSource.sourceKind,
          structuredArtifactReused: false,
          analyzerBypassed: false,
          compiledFor: resolvedTargetModel,
        },
        ...(artifactRef ? { artifactKey: artifactRef } : {}),
      });
    }

    this.log.info("Compiling prompt for target model", {
      operation,
      targetModel: resolvedTargetModel,
      sourceKind: resolvedSource.sourceKind,
      structuredArtifactReused: Boolean(resolvedSource.trustedArtifact),
    });

    try {
      const compilationResult = await this.videoPromptService.optimizeForModel(
        resolvedSource.compileInput,
        resolvedTargetModel,
        this.buildPromptContext(
          resolvedSource.compileInput,
          context,
          resolvedSource.trustedArtifact,
        ),
      );

      const compiledPrompt = this.serializePrompt(compilationResult.prompt);
      const phaseCount = compilationResult.metadata?.phases?.length ?? 0;
      const warnings = compilationResult.metadata?.warnings ?? [];
      const failureWarning = warnings.find((warning) =>
        warning.startsWith("Optimization failed:"),
      );
      const status: CompilationState["status"] = failureWarning
        ? "generic-fallback"
        : phaseCount > 0
          ? "compiled"
          : "compile-skipped";
      const reason =
        failureWarning ??
        resolvedSource.reason ??
        (status === "compile-skipped"
          ? "Model-specific compilation was skipped; original prompt returned."
          : undefined);

      return this.buildResult({
        prompt: compiledPrompt,
        compilation: {
          status,
          usedFallback: resolvedSource.usedFallback || status !== "compiled",
          ...(reason ? { reason } : {}),
          sourceKind: resolvedSource.sourceKind,
          structuredArtifactReused: Boolean(resolvedSource.trustedArtifact),
          analyzerBypassed: Boolean(resolvedSource.trustedArtifact),
          compiledFor: resolvedTargetModel,
        },
        compilationMeta: compilationResult.metadata as unknown as Record<
          string,
          unknown
        >,
        ...(resolvedSource.genericPrompt
          ? { genericPrompt: resolvedSource.genericPrompt }
          : {}),
        ...(artifactRef ? { artifactKey: artifactRef } : {}),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.log.error(
        "Model compilation failed, reverting to generic optimization",
        error as Error,
        {
          operation,
          targetModel: resolvedTargetModel,
        },
      );

      const fallbackPrompt =
        resolvedSource.genericPrompt ?? resolvedSource.compileInput;
      return this.buildResult({
        prompt: fallbackPrompt,
        compilation: {
          status: "generic-fallback",
          usedFallback: true,
          reason: `Compilation threw before completion: ${message}`,
          sourceKind: resolvedSource.sourceKind,
          structuredArtifactReused: false,
          analyzerBypassed: false,
          compiledFor: resolvedTargetModel,
        },
        genericPrompt: fallbackPrompt,
        ...(artifactRef ? { artifactKey: artifactRef } : {}),
      });
    }
  }

  async compileOptimizedPrompt({
    operation,
    optimizedPrompt,
    targetModel,
    mode,
    sourcePrompt,
    structuredArtifact,
  }: {
    operation: string;
    optimizedPrompt?: string;
    targetModel?: string;
    mode: OptimizationMode;
    sourcePrompt?: string;
    structuredArtifact?: StructuredOptimizationArtifact | null;
  }): Promise<CompileResult> {
    return this.compile({
      operation,
      mode,
      ...(targetModel ? { targetModel } : {}),
      source: structuredArtifact
        ? { kind: "artifact", artifact: structuredArtifact }
        : { kind: "prompt", prompt: optimizedPrompt ?? sourcePrompt ?? "" },
      fallbackPrompt: optimizedPrompt ?? sourcePrompt ?? "",
    });
  }

  async compilePrompt(
    prompt: string,
    targetModel: string,
    options: {
      artifactKey?: string;
      context?: CompileContext | null;
    } = {},
  ): Promise<CompilePromptResponse> {
    const result = await this.compile({
      operation: "compilePrompt",
      mode: "video",
      targetModel,
      source: options.artifactKey
        ? { kind: "artifactKey", artifactKey: options.artifactKey }
        : { kind: "prompt", prompt },
      context: options.context ?? null,
      fallbackPrompt: prompt,
      ...(options.artifactKey ? { artifactKey: options.artifactKey } : {}),
    });

    const resolvedTargetModel =
      this.resolveTargetModel(targetModel) ?? targetModel.trim();
    return {
      compiledPrompt: result.prompt,
      metadata: result.metadata,
      targetModel: resolvedTargetModel,
      ...(result.artifactKey ? { artifactKey: result.artifactKey } : {}),
      compilation: result.compilation,
    };
  }

  private async resolveSource(
    source: CompileSource,
    fallbackPrompt?: string,
  ): Promise<ResolvedCompileSource> {
    switch (source.kind) {
      case "artifact": {
        const trustedArtifact = this.isTrustedArtifact(source.artifact)
          ? source.artifact
          : null;
        if (trustedArtifact) {
          return {
            sourceKind: "artifact",
            compileInput: trustedArtifact.sourcePrompt,
            trustedArtifact,
            usedFallback: false,
          };
        }

        return {
          sourceKind: "prompt",
          compileInput: source.artifact.sourcePrompt,
          trustedArtifact: null,
          usedFallback: true,
          reason:
            "Structured artifact failed trust checks; compiling from raw source prompt.",
          genericPrompt: source.artifact.sourcePrompt,
        };
      }
      case "artifactKey": {
        const structuredArtifact = this.structuredArtifactCache
          ? await this.structuredArtifactCache.getStructuredArtifact(
              source.artifactKey,
            )
          : null;
        const trustedArtifact =
          structuredArtifact && this.isTrustedArtifact(structuredArtifact)
            ? structuredArtifact
            : null;

        if (trustedArtifact) {
          return {
            sourceKind: "artifactKey",
            compileInput: trustedArtifact.sourcePrompt,
            trustedArtifact,
            artifactKey: source.artifactKey,
            usedFallback: false,
          };
        }

        if (structuredArtifact?.sourcePrompt) {
          return {
            sourceKind: "prompt",
            compileInput: structuredArtifact.sourcePrompt,
            trustedArtifact: null,
            artifactKey: source.artifactKey,
            usedFallback: true,
            reason:
              "Structured artifact failed trust checks; compiling from raw source prompt.",
            genericPrompt: fallbackPrompt ?? structuredArtifact.sourcePrompt,
          };
        }

        if (fallbackPrompt && fallbackPrompt.trim()) {
          return {
            sourceKind: "prompt",
            compileInput: fallbackPrompt.trim(),
            trustedArtifact: null,
            artifactKey: source.artifactKey,
            usedFallback: true,
            reason:
              "Structured artifact not found; falling back to raw prompt compile.",
            genericPrompt: fallbackPrompt.trim(),
          };
        }

        return {
          sourceKind: "artifactKey",
          compileInput: "",
          trustedArtifact: null,
          artifactKey: source.artifactKey,
          usedFallback: true,
          reason:
            "Structured artifact not found and no raw prompt fallback was provided.",
        };
      }
      case "prompt":
      default:
        return {
          sourceKind: "prompt",
          compileInput: source.prompt.trim(),
          trustedArtifact: null,
          usedFallback: false,
          genericPrompt: source.prompt.trim(),
        };
    }
  }

  private buildPromptContext(
    prompt: string,
    context: CompileContext | null,
    trustedArtifact: StructuredOptimizationArtifact | null,
  ): PromptContext {
    return {
      userIntent:
        context?.originalPrompt?.trim() ||
        context?.originalUserPrompt?.trim() ||
        prompt,
      sourcePrompt:
        trustedArtifact?.sourcePrompt ||
        context?.originalPrompt?.trim() ||
        context?.originalUserPrompt?.trim() ||
        prompt,
      ...(context?.constraints
        ? { constraints: context.constraints as never }
        : {}),
      ...(context?.apiParams ? { apiParams: context.apiParams } : {}),
      ...(context?.assets ? { assets: context.assets as never } : {}),
      ...(trustedArtifact
        ? { precomputedStructuredPrompt: trustedArtifact.structuredPrompt }
        : {}),
    };
  }

  private buildResult(params: {
    prompt: string;
    compilation: CompilationState;
    compilationMeta?: Record<string, unknown> | null;
    genericPrompt?: string;
    artifactKey?: string;
  }): CompileResult {
    const metadata: Record<string, unknown> = {
      ...(params.compilation.compiledFor
        ? {
            compiledFor: params.compilation.compiledFor,
            normalizedModelId: params.compilation.compiledFor,
          }
        : {}),
      ...(params.compilationMeta
        ? { compilationMeta: params.compilationMeta }
        : {}),
      ...(params.genericPrompt ? { genericPrompt: params.genericPrompt } : {}),
      ...(params.artifactKey ? { artifactKey: params.artifactKey } : {}),
      structuredArtifactReused: params.compilation.structuredArtifactReused,
      compilation: params.compilation,
    };

    return {
      prompt: params.prompt,
      metadata,
      compilation: params.compilation,
      ...(params.artifactKey ? { artifactKey: params.artifactKey } : {}),
    };
  }

  private resolveTargetModel(targetModel: string | undefined): string | null {
    const explicitModel =
      targetModel && targetModel.trim() !== "" ? targetModel : undefined;
    if (!explicitModel) {
      return null;
    }
    return resolvePromptModelId(explicitModel) ?? explicitModel;
  }

  private isTrustedArtifact(
    artifact: StructuredOptimizationArtifact | null | undefined,
  ): artifact is StructuredOptimizationArtifact {
    return Boolean(artifact && !artifact.fallbackUsed && artifact.lintPassed);
  }

  private serializePrompt(prompt: string | Record<string, unknown>): string {
    return typeof prompt === "string"
      ? prompt
      : JSON.stringify(prompt, null, 2);
  }
}
