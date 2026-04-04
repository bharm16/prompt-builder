import { logger } from "@infrastructure/Logger";
import { resolvePromptModelId } from "@services/video-models/ModelRegistry";
import type { ModelConstraints } from "@services/video-prompt-analysis/strategies";
import { getPromptModelConstraints } from "@shared/videoModels";

const FORBIDDEN_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  {
    pattern: /\*\*TECHNICAL SPECS\*\*/i,
    message: "Contains technical specs markdown section.",
  },
  {
    pattern: /\*\*ALTERNATIVE APPROACHES\*\*/i,
    message: "Contains alternative approaches markdown section.",
  },
  { pattern: /^\s*#{1,6}\s+/m, message: "Contains markdown heading syntax." },
  {
    pattern: /\bVariation\s+\d+\b/i,
    message: "Contains template variation artifact.",
  },
];

function countWords(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function sanitizeMarkdownArtifacts(prompt: string): string {
  let cleaned = prompt.trim();
  const markers = [
    /\r?\n\s*\*\*\s*technical specs\s*\*\*/i,
    /\r?\n\s*\*\*\s*alternative approaches\s*\*\*/i,
    /\r?\n\s*technical specs\s*[:\n]/i,
    /\r?\n\s*alternative approaches\s*[:\n]/i,
  ];

  let cutIndex = -1;
  for (const marker of markers) {
    const match = marker.exec(cleaned);
    if (match && (cutIndex === -1 || match.index < cutIndex)) {
      cutIndex = match.index;
    }
  }

  if (cutIndex >= 0) {
    cleaned = cleaned.slice(0, cutIndex).trim();
  }

  return cleaned
    .replace(/^\s*\*\*\s*prompt\s*:\s*\*\*/i, "")
    .replace(/^\s*prompt\s*:\s*/i, "")
    .replace(/\b(in\s+(?:a|an|the)\s+car)\s+\1\b/gi, "$1")
    .trim();
}

export interface PromptLintResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  wordCount: number;
}

export interface PromptLintEnforcementResult {
  prompt: string;
  lint: PromptLintResult;
  repaired: boolean;
}

interface PromptLintGateServiceOptions {
  getModelConstraints?: (modelId: string) => ModelConstraints | undefined;
}

export class PromptLintGateService {
  private readonly getModelConstraints: (
    modelId: string,
  ) => ModelConstraints | undefined;
  private readonly log = logger.child({ service: "PromptLintGateService" });

  constructor(options: PromptLintGateServiceOptions = {}) {
    this.getModelConstraints =
      options.getModelConstraints ??
      ((modelId: string) => getPromptModelConstraints(modelId));
  }

  private resolveLimits(
    modelId?: string | null,
  ): ModelConstraints["wordLimits"] | undefined {
    if (!modelId) {
      return undefined;
    }

    const normalizedModelId = resolvePromptModelId(modelId) ?? modelId;
    return this.getModelConstraints(normalizedModelId)?.wordLimits;
  }

  evaluate(prompt: string, modelId?: string | null): PromptLintResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const wordCount = countWords(prompt);

    for (const rule of FORBIDDEN_PATTERNS) {
      if (rule.pattern.test(prompt)) {
        errors.push(rule.message);
      }
    }

    const limits = this.resolveLimits(modelId);
    if (limits) {
      if (wordCount > limits.max) {
        errors.push(
          `Prompt too long for ${modelId} (${wordCount} words > ${limits.max}).`,
        );
      } else if (wordCount < limits.min) {
        warnings.push(
          `Prompt short for ${modelId} (${wordCount} words < ${limits.min}).`,
        );
      }
    }

    return {
      ok: errors.length === 0,
      errors,
      warnings,
      wordCount,
    };
  }

  enforce(params: {
    prompt: string;
    modelId?: string | null;
  }): PromptLintEnforcementResult {
    const originalPrompt = params.prompt.trim();
    let candidate = sanitizeMarkdownArtifacts(originalPrompt);

    const lint = this.evaluate(candidate, params.modelId);
    const hasNonLengthErrors = lint.errors.some(
      (error) => !error.startsWith("Prompt too long for "),
    );
    const hasOnlyLengthError = lint.errors.length > 0 && !hasNonLengthErrors;

    if (params.modelId && hasOnlyLengthError) {
      this.log.error(
        "Model-specific prompt exceeded word budget; returning unchanged prompt",
        undefined,
        {
          modelId: resolvePromptModelId(params.modelId) ?? params.modelId,
          wordCount: lint.wordCount,
          errors: lint.errors,
        },
      );
      return {
        prompt: candidate,
        lint,
        repaired: candidate !== originalPrompt,
      };
    }

    if (!lint.ok) {
      throw new Error(`Prompt lint gate failed: ${lint.errors.join(" ")}`);
    }

    return {
      prompt: candidate,
      lint,
      repaired: candidate !== originalPrompt,
    };
  }
}
