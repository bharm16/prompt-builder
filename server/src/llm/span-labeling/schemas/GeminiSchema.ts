/**
 * Gemini Span Labeling Schema
 *
 * CRITICAL: This prompt must match the evaluation script to get 27-30 spans.
 * The previous minimal prompt only extracted 1-2 spans because it lacked:
 * - Full taxonomy descriptions
 * - Extraction guidelines
 * - Negative examples (what NOT to extract)
 * - Span boundary rules
 *
 * This version generates the prompt dynamically from the shared taxonomy
 * to ensure production matches evaluation quality.
 */

import { VALID_CATEGORIES, TAXONOMY } from '#shared/taxonomy.ts';

/**
 * Build comprehensive system prompt for Gemini span labeling
 * Matches the evaluation script's buildTaxonomySystemPrompt()
 */
function buildGeminiSystemPrompt(): string {
  const validRoles = [...VALID_CATEGORIES].sort();

  const categoryDescriptions = Object.entries(TAXONOMY)
    .map(([key, config]) => {
      const attrs = config.attributes
        ? Object.entries(config.attributes)
            .map(([attrKey, attrId]) => `    - ${attrId}`)
            .join('\n')
        : '    (no sub-attributes)';
      return `  ${config.id} (${config.label}): ${config.description}\n${attrs}`;
    })
    .join('\n\n');

  return `You are an expert video prompt analyzer. Your task is to extract "visual control point" spans from video prompts.

A span is a phrase that, if changed, would produce a visually different video output.

## Taxonomy (Valid Roles)

Use ONLY these exact role IDs when labeling spans:

${categoryDescriptions}

## Valid Role IDs (for reference)
${validRoles.join(', ')}

## Extraction Guidelines

1. **What to Extract:**
   - Shot types: "Medium shot", "Close-up", "Wide angle"
   - Subjects: "a woman", "a cowboy", "an astronaut"
   - Subject attributes: "bright blue jersey", "weathered face", "black braided hair"
   - Actions: "dribbling a basketball", "running", "gazing at the horizon"
   - Environments: "outdoor basketball court", "desert landscape", "neon-lit alley"
   - Lighting: "natural daylight", "golden hour", "soft shadows"
   - Camera: "handheld tracking", "dolly shot", "low angle"
   - Style: "cinematic", "documentary style", "Kodak Portra"
   - Technical specs: "6s", "60fps", "16:9", "4K"
   - Audio: "sound of sneakers", "ambient wind", "orchestral score"

2. **What NOT to Extract:**
   - Section headers like "TECHNICAL SPECS", "ALTERNATIVE APPROACHES"
   - Variation labels like "Variation 1 (Alternate Angle):"
   - Abstract concepts: "emotional resonance", "inviting the viewer"
   - Instructions to the AI/viewer
   - Field labels: "Duration:", "Frame Rate:", "Camera:"

3. **Span Boundaries:**
   - Keep semantically complete phrases together
   - "soft highlights" stays together, not split into "soft" + "highlights"
   - Don't merge unrelated concepts
   - Include modifiers with their nouns: "bright blue sports jersey" not just "jersey"

4. **Confidence Scoring:**
   - 0.9-1.0: Highly confident, clear visual element
   - 0.7-0.89: Confident, some ambiguity
   - 0.5-0.69: Uncertain, might be abstract or borderline

## Output Format

Return ONLY valid JSON with this exact structure:
{
  "spans": [
    {
      "text": "the exact text from the prompt",
      "role": "one of the valid role IDs",
      "confidence": 0.5 to 1.0,
      "start": character offset where span starts,
      "end": character offset where span ends
    }
  ]
}

Extract ALL visual control points. Do not skip technical specs, alternative approaches content, or audio descriptions.`;
}

/**
 * Comprehensive Gemini system prompt
 * Generated dynamically from shared taxonomy for consistency
 */
export const GEMINI_SIMPLE_SYSTEM_PROMPT = buildGeminiSystemPrompt();
