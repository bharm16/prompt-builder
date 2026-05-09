// ============================================================================
// Canonical model catalog
//
// Single source of truth for everything we know about each canonical prompt
// model: numeric capabilities (used by the recommender), detection patterns
// (used by ModelDetectionService to identify a target model from prompt text),
// and human-readable strengths/weaknesses (used by guidance generation).
//
// Keyed on `CanonicalPromptModelId` from `./videoModels`. Includes Runway
// (recommendation-only — no generation adapter wired in `VIDEO_MODELS`).
// Pure data + types: no Node, no I/O.
// ============================================================================

import type { CanonicalPromptModelId } from "./videoModels";

// ----------------------------------------------------------------------------
// Capability shape (numeric, used by ModelScoringService)
// ----------------------------------------------------------------------------

export const SPEED_TIERS = ["fast", "medium", "slow"] as const;
export type SpeedTier = (typeof SPEED_TIERS)[number];

export const COST_TIERS = ["low", "medium", "high"] as const;
export type CostTier = (typeof COST_TIERS)[number];

export const QUALITY_TIERS = ["preview", "standard", "premium"] as const;
export type QualityTier = (typeof QUALITY_TIERS)[number];

/**
 * Numeric capability profile for a model.
 *
 * Each non-tier field is a [0, 1] score reflecting how well a model handles
 * that requirement. ModelScoringService multiplies these by per-prompt
 * weights to produce the overall recommendation score.
 *
 * `t2vBoost` / `i2vBoost` are mode-specific multipliers (default ~1.0).
 */
export interface ModelCapabilities {
  physics: number;
  particleSystems: number;
  fluidDynamics: number;
  facialPerformance: number;
  bodyLanguage: number;
  characterActing: number;
  cinematicLighting: number;
  atmospherics: number;
  environmentDetail: number;
  architecturalAccuracy: number;
  motionComplexity: number;
  cameraControl: number;
  stylization: number;
  photorealism: number;
  morphing: number;
  transitions: number;
  i2vBoost?: number;
  t2vBoost?: number;
  speedTier: SpeedTier;
  costTier: CostTier;
  qualityTier: QualityTier;
}

// ----------------------------------------------------------------------------
// Detection patterns (used by ModelDetectionService)
// ----------------------------------------------------------------------------

export interface ModelDetectionPatterns {
  /** Substring matches against normalized prompt text. */
  keywords: readonly string[];
  /** Phrasing typical of prompts targeting this model. */
  technicalMarkers: readonly string[];
  /** High-confidence regex match (worth more in scoring). */
  indicators: RegExp;
  /** Strengths surfaced as guidance text. */
  strengths: ModelStrengths;
  /** Optional optimal-parameter hints surfaced in formatted context. */
  optimalParams?: ModelOptimalParams;
}

export interface ModelStrengths {
  primary: readonly string[];
  secondary: readonly string[];
  weaknesses: readonly string[];
}

export interface ModelOptimalParams {
  duration: string;
  motion: string;
  camera: string;
  lighting: string;
  style: string;
}

// ----------------------------------------------------------------------------
// Catalog entry
// ----------------------------------------------------------------------------

export interface ModelCatalogEntry {
  capabilities: ModelCapabilities;
  detectionPatterns: ModelDetectionPatterns;
  /**
   * Aliases consumers may surface this model under. `videoModels.ts`
   * `PROMPT_MODEL_ALIASES` is still authoritative for resolution; this list
   * documents the aliases each entry covers for traceability.
   */
  aliases: readonly string[];
}

// ----------------------------------------------------------------------------
// Catalog
// ----------------------------------------------------------------------------

export const MODEL_CATALOG: Record<CanonicalPromptModelId, ModelCatalogEntry> =
  {
    "runway-gen45": {
      capabilities: {
        // Recommendation-only model. Numbers seeded from MODEL_STRENGTHS data
        // (artistic/stylized strengths, motion fluidity from A2D, weak on
        // photorealism/morphing per documented weaknesses).
        physics: 0.55,
        particleSystems: 0.55,
        fluidDynamics: 0.6,
        facialPerformance: 0.65,
        bodyLanguage: 0.62,
        characterActing: 0.6,
        cinematicLighting: 0.78,
        atmospherics: 0.7,
        environmentDetail: 0.7,
        architecturalAccuracy: 0.7,
        motionComplexity: 0.82,
        cameraControl: 0.85,
        stylization: 0.85,
        photorealism: 0.62,
        morphing: 0.5,
        transitions: 0.55,
        t2vBoost: 1,
        i2vBoost: 0.95,
        speedTier: "medium",
        costTier: "medium",
        qualityTier: "standard",
      },
      detectionPatterns: {
        keywords: [
          "runway",
          "runwayml",
          "gen-4.5",
          "gen4.5",
          "gen 4.5",
          "runway gen 4.5",
          "whisper thunder",
        ],
        technicalMarkers: [
          "csae",
          "a2d",
          "continuous shot",
          "fluid motion",
          "stylized",
          "artistic",
        ],
        indicators:
          /\b(gen[_\s-]?4\.?5|runway\s*gen\s*4\.?5|runway(?:ml)?|whisper\s*thunder)\b/i,
        strengths: {
          primary: [
            "A2D architecture",
            "CSAE protocol",
            "Continuous shots",
            "Fluid motion",
          ],
          secondary: [
            "Cinematographic triggers",
            "Consistent geometry",
            "Camera motion mapping",
          ],
          weaknesses: [
            "Emotional/abstract terms",
            "Morphing effects",
            "Blur effects",
          ],
        },
        optimalParams: {
          duration: "5-20 seconds",
          motion: "Single continuous shot, fluid motion",
          camera: "CSAE protocol (Camera first)",
          lighting: "Cinematographic, shallow depth of field",
          style: "A2D optimized, consistent geometry",
        },
      },
      aliases: ["runway", "runway-gen45", "gen-4.5"],
    },

    "luma-ray3": {
      capabilities: {
        physics: 0.6,
        particleSystems: 0.58,
        fluidDynamics: 0.55,
        facialPerformance: 0.65,
        bodyLanguage: 0.62,
        characterActing: 0.6,
        cinematicLighting: 0.75,
        atmospherics: 0.78,
        environmentDetail: 0.7,
        architecturalAccuracy: 0.65,
        motionComplexity: 0.7,
        cameraControl: 0.72,
        stylization: 0.88,
        photorealism: 0.68,
        morphing: 0.95,
        transitions: 0.92,
        t2vBoost: 0.95,
        i2vBoost: 1.1,
        speedTier: "fast",
        costTier: "medium",
        qualityTier: "standard",
      },
      detectionPatterns: {
        keywords: [
          "luma",
          "luma dream",
          "dream machine",
          "ray-3",
          "ray3",
          "ray 3",
          "luma ray",
          "luma ray-3",
        ],
        technicalMarkers: [
          "causal chain",
          "hdr",
          "keyframes",
          "surreal",
          "abstract",
          "morphing",
          "dreamlike",
        ],
        indicators:
          /\b(ray[_\s-]?3|luma(?:\s*ray[_\s-]?3?)?|dream\s*machine)\b/i,
        strengths: {
          primary: [
            "Causal chain expansion",
            "HDR pipeline",
            "Keyframe interpolation",
            "Motion triggers",
          ],
          secondary: ["16-bit color", "ACES colorspace", "Slow motion"],
          weaknesses: [
            "Loop/seamless when API loop enabled",
            "Redundant resolution tokens",
          ],
        },
        optimalParams: {
          duration: "5-15 seconds",
          motion: "Causal chain, cause-effect sequences",
          camera: "Keyframe interpolation",
          lighting: "HDR, 16-bit color, ACES",
          style: "High dynamic range",
        },
      },
      aliases: ["luma", "luma-ray3"],
    },

    "kling-2.1": {
      capabilities: {
        physics: 0.65,
        particleSystems: 0.55,
        fluidDynamics: 0.58,
        facialPerformance: 0.92,
        bodyLanguage: 0.88,
        characterActing: 0.9,
        cinematicLighting: 0.7,
        atmospherics: 0.65,
        environmentDetail: 0.7,
        architecturalAccuracy: 0.65,
        motionComplexity: 0.8,
        cameraControl: 0.75,
        stylization: 0.65,
        photorealism: 0.78,
        morphing: 0.55,
        transitions: 0.5,
        t2vBoost: 1,
        i2vBoost: 0.95,
        speedTier: "medium",
        costTier: "medium",
        qualityTier: "standard",
      },
      detectionPatterns: {
        keywords: [
          "kling",
          "kuaishou",
          "kling 2.1",
          "kling 2.6",
          "kling2.1",
          "kling2.6",
        ],
        technicalMarkers: [
          "character",
          "facial",
          "expression",
          "animation",
          "screenplay",
          "dialogue",
          "memflow",
          "synced lips",
        ],
        indicators: /\b(kling(?:[_\s-]?(?:2\.?[16]|v?2[_\s-]?1))?|kuaishou)\b/i,
        strengths: {
          primary: [
            "Audio-visual sync",
            "Screenplay formatting",
            "Dialogue scenes",
            "MemFlow context",
          ],
          secondary: ["Synced lips", "Natural speech", "High fidelity audio"],
          weaknesses: [
            "Generic sound terms",
            "Visual tokens in audio sections",
          ],
        },
        optimalParams: {
          duration: "5-30 seconds",
          motion: "Character-focused, dialogue sync",
          camera: "Close to medium for dialogue",
          lighting: "Clear for lip-sync",
          style: "Screenplay format, audio-visual",
        },
      },
      aliases: ["kling", "kling-2.1", "kling-26", "kling-v2-1-master"],
    },

    "sora-2": {
      capabilities: {
        physics: 0.95,
        particleSystems: 0.9,
        fluidDynamics: 0.92,
        facialPerformance: 0.7,
        bodyLanguage: 0.75,
        characterActing: 0.68,
        cinematicLighting: 0.8,
        atmospherics: 0.85,
        environmentDetail: 0.9,
        architecturalAccuracy: 0.88,
        motionComplexity: 0.85,
        cameraControl: 0.82,
        stylization: 0.6,
        photorealism: 0.88,
        morphing: 0.5,
        transitions: 0.55,
        t2vBoost: 1,
        i2vBoost: 0.9,
        speedTier: "slow",
        costTier: "high",
        qualityTier: "premium",
      },
      detectionPatterns: {
        keywords: [
          "sora",
          "sora 2",
          "sora2",
          "openai sora 2",
          "openai video",
          "openai gen",
        ],
        technicalMarkers: [
          "realistic motion",
          "physics simulation",
          "long-form",
          "newtonian physics",
          "momentum conservation",
          "temporal sequence",
        ],
        indicators:
          /\b(sora(?:[_\s-]?2)?|openai\s*(?:sora|video)|continuous\s*action|realistic\s*physics)\b/i,
        strengths: {
          primary: [
            "Physics grounding",
            "Temporal segmentation",
            "Newtonian physics",
            "Momentum conservation",
          ],
          secondary: [
            "Cameo identity tokens",
            "Aspect ratio validation",
            "JSON response format",
          ],
          weaknesses: [
            "Public figure names",
            "Unauthorized celebrity references",
          ],
        },
        optimalParams: {
          duration: "10-60 seconds",
          motion: "Physics-grounded, Newtonian",
          camera: "Temporal sequences",
          lighting: "Physically accurate",
          style: "Physics simulation, momentum conservation",
        },
      },
      aliases: ["sora", "sora-2", "sora-2-pro"],
    },

    "veo-3": {
      capabilities: {
        physics: 0.7,
        particleSystems: 0.65,
        fluidDynamics: 0.68,
        facialPerformance: 0.75,
        bodyLanguage: 0.72,
        characterActing: 0.7,
        cinematicLighting: 0.95,
        atmospherics: 0.92,
        environmentDetail: 0.85,
        architecturalAccuracy: 0.8,
        motionComplexity: 0.75,
        cameraControl: 0.78,
        stylization: 0.8,
        photorealism: 0.85,
        morphing: 0.6,
        transitions: 0.65,
        t2vBoost: 1,
        i2vBoost: 0.95,
        speedTier: "medium",
        costTier: "medium",
        qualityTier: "premium",
      },
      detectionPatterns: {
        keywords: [
          "veo",
          "veo3",
          "veo 3",
          "veo-3",
          "veo 4",
          "veo4",
          "google veo",
          "google veo 4",
          "vertex",
        ],
        technicalMarkers: [
          "atmospheric",
          "cinematic lighting",
          "mood",
          "json schema",
          "style_preset",
          "flow editing",
        ],
        indicators:
          /\b(veo[\s-]*[34](?:\.\d)?|google\s*veo|vertex\s*ai|atmospheric\s*lighting)\b/i,
        strengths: {
          primary: [
            "JSON schema serialization",
            "Gemini integration",
            "Flow editing",
            "Style presets",
          ],
          secondary: [
            "Brand context injection",
            "Structured prompts",
            "Edit mode support",
          ],
          weaknesses: ["Markdown formatting", "Conversational filler"],
        },
        optimalParams: {
          duration: "5-30 seconds",
          motion: "Structured JSON control",
          camera: "Schema-defined movements",
          lighting: "Environment-specified",
          style: "JSON schema, style presets",
        },
      },
      aliases: ["veo", "veo-3", "veo-4", "google/veo-3"],
    },

    "wan-2.2": {
      capabilities: {
        physics: 0.55,
        particleSystems: 0.5,
        fluidDynamics: 0.48,
        facialPerformance: 0.58,
        bodyLanguage: 0.55,
        characterActing: 0.52,
        cinematicLighting: 0.6,
        atmospherics: 0.58,
        environmentDetail: 0.58,
        architecturalAccuracy: 0.55,
        motionComplexity: 0.55,
        cameraControl: 0.52,
        stylization: 0.6,
        photorealism: 0.55,
        morphing: 0.5,
        transitions: 0.48,
        t2vBoost: 1,
        i2vBoost: 1,
        speedTier: "fast",
        costTier: "low",
        qualityTier: "preview",
      },
      detectionPatterns: {
        keywords: [
          "wan 2.1",
          "wan 2.2",
          "wan 2.5",
          "wan2.1",
          "wan2.2",
          "wan2.5",
          "wan t2v",
          "alibaba wan",
        ],
        technicalMarkers: [
          "moe",
          "bilingual",
          "1080p 30fps",
          "mixture of experts",
        ],
        indicators:
          /\b(wan[_\s-]?[2]\.?[125]|alibaba\s*wan|moe\s*architecture)\b/i,
        strengths: {
          primary: [
            "Mixture-of-Experts (MoE) efficiency",
            "1080p 30fps native",
            "Bilingual prompt adherence",
            "Variable aspect ratios",
          ],
          secondary: [
            "Cinematic motion",
            "Complex scene understanding",
            "Prompt-to-video alignment",
          ],
          weaknesses: [
            "English-only without translations",
            "Low-resolution legacy triggers",
          ],
        },
        optimalParams: {
          duration: "5-20 seconds",
          motion: "MoE-optimized cinematic motion",
          camera: "Variable aspect ratio support",
          lighting: "Highly detailed, 1080p native",
          style: "Bilingual narrative, high fidelity",
        },
      },
      aliases: ["wan", "wan-2.2", "wan-2.5", "draft", "pro"],
    },
  };

/**
 * Convenience accessor — returns the capability profile for a canonical
 * model id. Returns `null` for unknown ids (callers should null-check).
 */
export function getModelCapabilities(
  modelId: CanonicalPromptModelId,
): ModelCapabilities | null {
  return MODEL_CATALOG[modelId]?.capabilities ?? null;
}

/**
 * Convenience accessor — returns the detection patterns for a canonical
 * model id, or `null` for unknown ids.
 */
export function getModelDetectionPatterns(
  modelId: CanonicalPromptModelId,
): ModelDetectionPatterns | null {
  return MODEL_CATALOG[modelId]?.detectionPatterns ?? null;
}
