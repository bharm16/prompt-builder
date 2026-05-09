import { normalizeText } from "@services/video-prompt-analysis/utils/textHelpers";
import {
  MODEL_CATALOG,
  type ModelOptimalParams,
  type ModelStrengths,
} from "@shared/modelCatalog";
import {
  CANONICAL_PROMPT_MODEL_IDS,
  type CanonicalPromptModelId,
  resolveCanonicalPromptModelId,
} from "@shared/videoModels";

/**
 * Detects the target AI video model from prompt text.
 *
 * Backed by the canonical `MODEL_CATALOG` in `shared/modelCatalog.ts`.
 * Detection patterns (keywords, technical markers, regex indicators) for
 * every supported model live there as a single source of truth — this
 * service is now a thin scorer over those patterns.
 *
 * Returns `CanonicalPromptModelId` (or `null` when no model is confidently
 * detected). Legacy aliases (e.g. `runway`, `kling-26`, `veo-4`) reaching
 * the strengths/optimal-params accessors are normalized via
 * `resolveCanonicalPromptModelId`.
 */

/** Compatibility re-export — older callers import this name. */
export type ModelCapabilities = ModelStrengths;
export type { ModelOptimalParams } from "@shared/modelCatalog";

/** Minimum total pattern score required before we commit to a detection. */
const MIN_DETECTION_SCORE = 2;

export class ModelDetectionService {
  /**
   * Detect which AI video model the prompt is targeting.
   * Returns `null` when no model crosses the confidence threshold.
   */
  detectTargetModel(
    fullPrompt: string | null | undefined,
  ): CanonicalPromptModelId | null {
    if (typeof fullPrompt !== "string" || fullPrompt.trim().length === 0) {
      return null;
    }

    const normalized = normalizeText(fullPrompt);
    let bestId: CanonicalPromptModelId | null = null;
    let bestScore = 0;

    for (const id of CANONICAL_PROMPT_MODEL_IDS) {
      const patterns = MODEL_CATALOG[id].detectionPatterns;
      const score = this.scoreModel(normalized, patterns);
      if (score > bestScore) {
        bestScore = score;
        bestId = id;
      }
    }

    return bestScore >= MIN_DETECTION_SCORE ? bestId : null;
  }

  private scoreModel(
    normalizedText: string,
    patterns: (typeof MODEL_CATALOG)[CanonicalPromptModelId]["detectionPatterns"],
  ): number {
    let score = 0;

    // Regex indicator (strong signal)
    if (patterns.indicators.test(normalizedText)) {
      score += 5;
    }

    // Keywords (medium signal)
    for (const keyword of patterns.keywords) {
      if (normalizedText.includes(keyword)) {
        score += 2;
      }
    }

    // Technical markers (weak signal)
    for (const marker of patterns.technicalMarkers) {
      if (normalizedText.includes(marker)) {
        score += 1;
      }
    }

    return score;
  }

  /**
   * Get model strengths (primary, secondary, weaknesses).
   * Accepts canonical ids and legacy aliases via PROMPT_MODEL_ALIASES.
   */
  getModelCapabilities(
    model: string | null | undefined,
  ): ModelCapabilities | null {
    const canonical = resolveCanonicalPromptModelId(model ?? null);
    if (!canonical) return null;
    return MODEL_CATALOG[canonical].detectionPatterns.strengths;
  }

  /**
   * Get model optimal parameters. Returns `null` when the catalog entry has
   * no `optimalParams` defined (or the model is unknown).
   */
  getModelOptimalParams(
    model: string | null | undefined,
  ): ModelOptimalParams | null {
    const canonical = resolveCanonicalPromptModelId(model ?? null);
    if (!canonical) return null;
    return MODEL_CATALOG[canonical].detectionPatterns.optimalParams ?? null;
  }

  /**
   * Get model-specific guidance for a category. The bullet-list of category
   * tips here is intentionally conservative — these are high-confidence
   * couplings worth surfacing in the optimization prompt.
   */
  getModelSpecificGuidance(
    model: string | null | undefined,
    category: string | null | undefined,
  ): string[] {
    if (!model || !category) return [];

    const canonical = resolveCanonicalPromptModelId(model);
    if (!canonical) return [];

    const normalizedCategory = category.toLowerCase();
    const guidance: string[] = [];

    if (canonical === "sora-2") {
      if (
        normalizedCategory.includes("motion") ||
        normalizedCategory.includes("action")
      ) {
        guidance.push(
          "Describe continuous, realistic motion with physical accuracy",
        );
        guidance.push(
          "Mention how objects interact with environment and physics",
        );
        guidance.push(
          "Specify natural movement patterns (walking, flowing, falling)",
        );
      }
      if (normalizedCategory.includes("camera")) {
        guidance.push(
          "Use smooth, realistic camera movements (dolly, crane, pan)",
        );
        guidance.push("Avoid rapid cuts or jarring transitions");
      }
    }

    if (canonical === "veo-3") {
      if (normalizedCategory.includes("lighting")) {
        guidance.push("Emphasize atmospheric and cinematic lighting quality");
        guidance.push("Specify light direction, quality, and mood impact");
        guidance.push(
          "Use technical terms: key light, rim light, 3-point setup",
        );
      }
      if (
        normalizedCategory.includes("mood") ||
        normalizedCategory.includes("atmosphere")
      ) {
        guidance.push("Leverage Veo's strength in atmospheric effects");
        guidance.push("Describe environmental mood and feeling");
      }
    }

    if (canonical === "runway-gen45") {
      if (normalizedCategory.includes("style")) {
        guidance.push("Embrace stylized, artistic approaches");
        guidance.push("Reference art styles, filters, or visual treatments");
        guidance.push("Consider non-realistic color grading and effects");
      }
    }

    if (canonical === "kling-2.1") {
      if (
        normalizedCategory.includes("subject") ||
        normalizedCategory.includes("character")
      ) {
        guidance.push("Focus on facial expressions and character emotion");
        guidance.push("Describe specific facial features and expressions");
        guidance.push("Mention eye contact, subtle gestures, reactions");
      }
    }

    if (canonical === "luma-ray3") {
      if (
        normalizedCategory.includes("style") ||
        normalizedCategory.includes("visual")
      ) {
        guidance.push("Embrace surreal and abstract concepts");
        guidance.push("Use dreamlike, morphing, or fluid descriptions");
        guidance.push("Don't worry about physical realism");
      }
    }

    return guidance;
  }

  /**
   * Format model context for prompt inclusion.
   */
  formatModelContext(model: string | null | undefined): string {
    if (!model) return "";

    const canonical = resolveCanonicalPromptModelId(model);
    if (!canonical) return "";

    const entry = MODEL_CATALOG[canonical].detectionPatterns;
    const params = entry.optimalParams;
    const capabilities = entry.strengths;
    if (!params) return "";

    const modelName = canonical;
    let context = `\n**TARGET MODEL: ${modelName}**\n`;
    context += `Primary Strengths: ${capabilities.primary.join(", ")}\n`;
    context += `Optimize for: ${params.motion}, ${params.camera}, ${params.lighting}\n`;
    context += `Weakness to avoid: ${capabilities.weaknesses.join(", ")}\n`;

    return context;
  }
}
