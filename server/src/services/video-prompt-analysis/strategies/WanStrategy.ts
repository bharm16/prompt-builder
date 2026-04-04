/**
 * WanStrategy - Prompt optimization for Wan 2.2 (Replicate)
 *
 * Implements optimization for Wan's architecture hosted on Replicate.
 * Follows best practices:
 * - Structured narrative: Subject -> Environment -> Camera -> Lighting
 * - Aspect ratio mapping to resolution strings
 * - Replicate-specific API payload generation
 *
 * @module WanStrategy
 */

import {
  BaseStrategy,
  type NormalizeResult,
  type TransformResult,
  type AugmentResult,
} from "./BaseStrategy";
import { getPromptModelConstraints } from "@shared/videoModels";
import type {
  PromptOptimizationResult,
  PromptContext,
  RewriteConstraints,
  VideoPromptIR,
} from "./types";

/**
 * Default negative prompt to avoid common artifacts
 */
const DEFAULT_NEGATIVE_PROMPT =
  "morphing, distorted, disfigured, text, watermark, low quality, blurry, static, extra limbs, fused fingers";

/**
 * Replicate supported aspect ratio mapping
 */
const ASPECT_RATIO_MAP: Record<string, string> = {
  "16:9": "1280*720",
  "9:16": "720*1280",
  "1:1": "1024*1024",
  "4:3": "1024*768",
  "3:4": "768*1024",
};

const CAMERA_MOVEMENT_TOKENS = [
  "dolly",
  "tracking shot",
  "crane shot",
  "orbit",
  "handheld",
  "steadycam",
  "whip pan",
  "tilt",
  "pan",
  "zoom",
] as const;

const TECHNICAL_SPEC_TOKENS = [
  "24fps",
  "30fps",
  "60fps",
  "4k",
  "8k",
  "uhd",
  "resolution",
  "aspect ratio",
  "frame rate",
  "depth of field",
] as const;

const MODEL_CONSTRAINTS = getPromptModelConstraints("wan-2.2")!;

interface WanApiPayload {
  prompt: string;
  negative_prompt: string;
  size: string;
  num_frames: number;
  frames_per_second: number;
  prompt_extend: boolean;
}

/**
 * WanStrategy optimizes prompts for Wan 2.2 series on Replicate
 */
export class WanStrategy extends BaseStrategy {
  readonly modelId = "wan-2.2";
  readonly modelName = "Wan 2.2";

  getModelConstraints() {
    return MODEL_CONSTRAINTS;
  }

  /**
   * Validate input against Wan-specific constraints
   */
  protected async doValidate(
    input: string,
    context?: PromptContext,
  ): Promise<void> {
    // Check for aspect ratio constraints if provided
    if (context?.constraints?.formRequirement) {
      const aspectRatio = context.constraints.formRequirement;
      if (!ASPECT_RATIO_MAP[aspectRatio]) {
        this.addWarning(
          `Aspect ratio "${aspectRatio}" is not directly supported; supported ratios are ${Object.keys(ASPECT_RATIO_MAP).join(", ")}`,
        );
      }
    }

    // Check for very long prompts
    const wordCount = input.split(/\s+/).length;
    if (wordCount > MODEL_CONSTRAINTS.wordLimits.max) {
      this.addWarning(
        `Prompt exceeds ${MODEL_CONSTRAINTS.wordLimits.max} words; Wan performs best with concise single-action prompts`,
      );
    }
  }

  /**
   * Normalize input with whitespace cleanup
   */
  protected doNormalize(
    input: string,
    _context?: PromptContext,
  ): NormalizeResult {
    const text = this.cleanWhitespace(input);
    return {
      text,
      changes: [],
      strippedTokens: [],
    };
  }

  /**
   * Final adjustments after LLM rewrite
   * Reconstructs prompt to enforce: Subject -> Environment -> Camera -> Lighting
   */
  protected doTransform(
    llmPrompt: string | Record<string, unknown>,
    ir: VideoPromptIR,
    _context?: PromptContext,
  ): TransformResult {
    const changes: string[] = [];
    const llmText =
      typeof llmPrompt === "string" ? llmPrompt : JSON.stringify(llmPrompt);
    const isLlmRewriteAvailable =
      llmText.trim().length > 0 && llmText.trim() !== ir.raw?.trim();

    let prompt: string;
    if (isLlmRewriteAvailable) {
      prompt = this.cleanWhitespace(llmText);
      changes.push("Used LLM rewrite as primary Wan output");
    } else {
      // Fallback: deterministic slot assembly when LLM rewrite is unavailable
      const extractionSource = ir.raw || llmText;
      const subject = ir.subjects[0]?.text?.trim() || "";
      const actionHint = ir.actions[0]?.trim() || "";
      const action =
        this.extractActionPhrase(extractionSource, actionHint) || actionHint;
      const setting = ir.environment.setting?.trim() || "";
      const lighting = ir.environment.lighting[0]?.trim() || "";

      if (subject && action) {
        const parts = [`${subject} ${action}`];
        if (setting) {
          parts.push(`in ${setting}`);
        }
        if (lighting) {
          parts.push(`lit by ${lighting}`);
        }
        prompt = parts.join(", ");
        changes.push("Rendered concise Wan prompt from IR (LLM fallback)");
      } else {
        prompt = this.cleanWhitespace(extractionSource);
      }
    }

    prompt = this.cleanWhitespace(prompt)
      .replace(/\.\./g, ".")
      .replace(/\s\./g, ".");

    return {
      prompt,
      changes,
      negativePrompt: DEFAULT_NEGATIVE_PROMPT,
    };
  }

  /**
   * Augment result with Wan-specific quality triggers
   */
  protected doAugment(
    result: PromptOptimizationResult,
    _context?: PromptContext,
  ): AugmentResult {
    const changes: string[] = [];
    const triggersInjected: string[] = [];

    let prompt =
      typeof result.prompt === "string"
        ? result.prompt
        : JSON.stringify(result.prompt);
    prompt = this.cleanWhitespace(prompt);

    return {
      prompt,
      changes,
      triggersInjected,
      negativePrompt: result.negativePrompt || DEFAULT_NEGATIVE_PROMPT,
    };
  }

  protected override getRewriteConstraints(
    _ir: VideoPromptIR,
    _context?: PromptContext,
  ): RewriteConstraints {
    return {
      suggested: ["single subject", "one continuous action"],
      avoid: [...CAMERA_MOVEMENT_TOKENS, ...TECHNICAL_SPEC_TOKENS],
    };
  }

  /**
   * Generates the API payload for Replicate
   *
   * @param prompt - The optimized prompt string
   * @param context - The context containing constraints like aspect ratio
   * @returns The payload object for the Replicate API
   */
  public getApiPayload(prompt: string, context?: PromptContext): WanApiPayload {
    const aspectRatio = context?.constraints?.formRequirement || "16:9";
    const size = ASPECT_RATIO_MAP[aspectRatio] || "1280*720"; // Default to 16:9 (720p)

    return {
      prompt,
      negative_prompt: DEFAULT_NEGATIVE_PROMPT,
      size,
      num_frames: 81,
      frames_per_second: 16,
      prompt_extend: true,
    };
  }

  private extractActionPhrase(text: string, hint: string): string | null {
    const cleaned = this.cleanWhitespace(text);
    const candidates = [
      hint,
      "driving",
      "running",
      "walking",
      "jumping",
      "dancing",
      "sitting",
      "standing",
    ].filter((value): value is string =>
      Boolean(value && value.trim().length > 0),
    );

    const leadSentence = cleaned.split(/[.!?]/)[0] ?? "";
    const leadMatch = this.matchActionCandidate(leadSentence, candidates);
    if (leadMatch) {
      return leadMatch;
    }

    const fullMatch = this.matchActionCandidate(cleaned, candidates);
    if (fullMatch) {
      return fullMatch;
    }

    return null;
  }

  private matchActionCandidate(
    text: string,
    candidates: string[],
  ): string | null {
    for (const candidate of candidates) {
      const pattern = new RegExp(
        `\\b${this.escapeRegex(candidate)}\\b(?:\\s+(?:[a-z0-9'-]+)){0,4}`,
        "i",
      );
      const match = text.match(pattern);
      if (!match?.[0]) {
        continue;
      }

      const phrase = this.trimTrailingConnectors(match[0]);
      if (phrase.length > 0) {
        return phrase;
      }
    }
    return null;
  }

  private trimTrailingConnectors(value: string): string {
    const trailing = new Set([
      "in",
      "on",
      "at",
      "with",
      "near",
      "beside",
      "past",
      "through",
      "across",
      "to",
      "from",
      "into",
      "onto",
      "a",
      "an",
      "the",
    ]);
    const words = value.trim().split(/\s+/).filter(Boolean);
    while (words.length > 1) {
      const last = words[words.length - 1]?.toLowerCase() ?? "";
      if (!trailing.has(last)) {
        break;
      }
      words.pop();
    }
    return words.join(" ");
  }
}
