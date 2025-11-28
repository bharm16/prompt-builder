/**
 * Enhancement Examples Configuration
 * 
 * Single source of truth for few-shot examples used in prompt generation.
 * These examples demonstrate the expected transformation patterns for each design method.
 * 
 * IMPORTANT: These examples are wrapped in XML tags and explicitly marked as "do not copy"
 * to prevent the model from simply copying them. A safety filter in SuggestionGenerationService
 * also programmatically removes any leaked examples from the output.
 */

export interface EnhancementExample {
  text: string;
  explanation: string;
  visual_reasoning?: string;
  category: string;
}

/**
 * Examples for Visual Decomposition (Design 2)
 * Demonstrates converting abstract descriptors into concrete visual details
 */
export const VISUAL_EXAMPLES: EnhancementExample[] = [
  {
    text: "towering obsidian golem in harsh rim lighting",
    explanation: "Focus on texture and lighting to create fear",
    visual_reasoning: "Converts abstract 'scary' into specific materials (obsidian), scale (towering), and lighting technique (rim lighting) that create visual tension",
    category: "subject"
  },
  {
    text: "blurred streak of crimson chrome",
    explanation: "Emphasize speed through motion blur and color streaks",
    visual_reasoning: "Transforms abstract 'fast car' into camera-visible motion blur effect and specific color/material combination",
    category: "subject"
  },
  {
    text: "weathered oak planks with deep grain shadows",
    explanation: "Convert abstract texture into specific material and lighting details",
    visual_reasoning: "Decomposes 'rough texture' into identifiable wood type, weathering state, and shadow patterns that define the surface",
    category: "subject"
  }
];

/**
 * Examples for Orthogonal Attribute Injector (Design 1)
 * Demonstrates varying technical attributes while maintaining the same slot
 */
export const TECHNICAL_EXAMPLES: EnhancementExample[] = [
  {
    text: "low-angle dolly zoom with vertigo effect",
    explanation: "Create disorientation and psychological tension",
    visual_reasoning: "Varies camera angle (low-angle), movement type (dolly zoom), and psychological effect (vertigo) as orthogonal technical attributes",
    category: "camera"
  },
  {
    text: "shallow depth of field with rack focus transition",
    explanation: "Control focus plane to guide viewer attention",
    visual_reasoning: "Varies focus technique (shallow DOF) and dynamic focus change (rack focus) as distinct technical camera attributes",
    category: "camera"
  },
  {
    text: "volumetric lighting with god rays piercing clouds",
    explanation: "Create atmospheric depth through light scattering",
    visual_reasoning: "Varies lighting type (volumetric) and specific visual phenomenon (god rays) as orthogonal lighting attributes",
    category: "lighting"
  }
];

/**
 * Examples for Narrative Editor (Design 3)
 * Demonstrates grammar-constrained action replacements
 */
export const NARRATIVE_EXAMPLES: EnhancementExample[] = [
  {
    text: "sprinting furiously across the cracked asphalt",
    explanation: "Single continuous action with intensity modifier",
    visual_reasoning: "Replaces generic 'running' with specific action verb (sprinting), intensity (furiously), and surface detail (cracked asphalt) while maintaining grammatical structure",
    category: "action"
  },
  {
    text: "gazing intently at the horizon",
    explanation: "Camera-visible physical behavior with focus",
    visual_reasoning: "Converts abstract 'looking' into specific gaze type (gazing), intensity (intently), and directional focus (horizon) as a single continuous action",
    category: "action"
  },
  {
    text: "leaning heavily against the weathered doorframe",
    explanation: "Static pose with physical detail",
    visual_reasoning: "Transforms generic 'standing' into specific pose (leaning), weight distribution (heavily), and environmental interaction (doorframe) as a single state",
    category: "action"
  }
];

/**
 * Get all example texts for safety filtering
 * Used to detect and remove leaked examples from AI output
 */
export function getAllExampleTexts(): Set<string> {
  const allExamples = [...VISUAL_EXAMPLES, ...TECHNICAL_EXAMPLES, ...NARRATIVE_EXAMPLES];
  return new Set(allExamples.map(ex => ex.text.toLowerCase()));
}

