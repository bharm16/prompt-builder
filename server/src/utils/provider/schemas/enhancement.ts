import { detectAndGetCapabilities } from "@utils/provider/ProviderDetector";
import {
  buildCapabilityOptions,
  type JSONSchema,
  type SchemaOptions,
} from "./types";

/**
 * Enhancement Suggestion Schema Factory
 */
export function getEnhancementSchema(options: SchemaOptions = {}): JSONSchema {
  const { capabilities } = detectAndGetCapabilities(
    buildCapabilityOptions(options, "enhance_suggestions"),
  );

  if (capabilities.strictJsonSchema) {
    return getOpenAIEnhancementSchema(options.isPlaceholder ?? false);
  }

  return getGroqEnhancementSchema(options.isPlaceholder ?? false);
}

/**
 * OpenAI Enhancement Schema
 *
 * Features:
 * - strict: true for grammar-constrained decoding
 * - additionalProperties: false required for strict mode
 * - Rich descriptions guide semantic output
 * - Category enum enforces valid taxonomy IDs
 */
function getOpenAIEnhancementSchema(isPlaceholder: boolean): JSONSchema {
  const required = ["text", "explanation"];
  if (isPlaceholder) {
    required.push("category");
  }

  return {
    name: "enhancement_suggestions",
    strict: true,
    type: "object",
    required: ["scene_summary", "suggestions"],
    additionalProperties: false,
    properties: {
      scene_summary: {
        type: "string",
        description:
          "ONE sentence identifying the scene's setting, tone, and constraints visible in the full prompt (e.g., 'aerial drone shot over urban skyline at sunset — suggestions must be airborne; ground-based movements are invalid'). Emit BEFORE the suggestions array. The constraints stated here apply to every suggestion that follows.",
      },
      suggestions: {
        type: "array",
        items: {
          type: "object",
          required,
          additionalProperties: false,
          properties: {
            text: {
              type: "string",
              description:
                "Replacement phrase (2-20 words). Must fit grammatically in surrounding context. No leading/trailing punctuation unless part of the phrase.",
            },
            category: {
              type: "string",
              description:
                "Taxonomy category for the suggestion. Valid values: subject, action, camera, lighting, style, technical, shot, environment, audio, mood.",
              enum: [
                "subject",
                "action",
                "camera",
                "lighting",
                "style",
                "technical",
                "shot",
                "environment",
                "audio",
                "mood",
              ],
            },
            explanation: {
              type: "string",
              description:
                "Brief explanation of visual effect or why this replacement works (under 15 words).",
            },
            slot: {
              type: "string",
              description:
                "Optional: Specific slot within category (e.g., subject.appearance, camera.movement).",
            },
            visual_focus: {
              type: "string",
              description:
                "Optional: What the camera should focus on with this suggestion.",
            },
          },
        },
      },
    },
  };
}

/**
 * Groq/Llama Enhancement Schema
 *
 * Features:
 * - Object wrapper for json_object mode compatibility
 *   (Groq's json_object mode requires top-level object, not array)
 * - Simpler structure for 8B model
 * - No strict mode (validation-based)
 * - Minimal descriptions to save tokens
 * - More flexible category (string, not enum)
 */
function getGroqEnhancementSchema(isPlaceholder: boolean): JSONSchema {
  const required = ["text", "explanation"];
  if (isPlaceholder) {
    required.push("category");
  }

  // scene_summary is declared in `properties` (so the prompt's instruction
  // is reinforced by schema-documented shape) but NOT in `required`: Groq's
  // json_object mode does not honor required-arrays the way OpenAI strict
  // mode does, and Qwen drops the field on ~30% of responses. Requiring it
  // here rejects valid suggestion arrays. The prompt drives emission; the
  // engine tolerates absence (sceneSummary=null).
  return {
    type: "object",
    required: ["suggestions"],
    properties: {
      scene_summary: { type: "string" },
      suggestions: {
        type: "array",
        items: {
          type: "object",
          required,
          properties: {
            text: { type: "string" },
            category: { type: "string" },
            explanation: { type: "string" },
            slot: { type: "string" },
            visual_focus: { type: "string" },
          },
        },
      },
    },
  };
}
