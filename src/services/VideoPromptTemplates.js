/**
 * Video prompt template for AI video generation
 * Targets: Sora, Veo3, RunwayML, Kling, Luma
 * Length: 100-150 words
 */

/**
 * Generate optimized video prompt
 * @param {string} userPrompt - User's video concept
 * @returns {string} Formatted prompt template
 */
export function generateVideoPrompt(userPrompt) {
  return `Transform this into a production-ready AI video prompt (100-150 words).

User's concept: "${userPrompt}"

Write ONE paragraph following this structure:

[SHOT TYPE] [SUBJECT doing ACTION] in/at [SETTING], [CAMERA BEHAVIOR], [LIGHTING], [STYLE/MOOD]

REQUIRED ELEMENTS (in order of importance):
1. Shot type: wide shot, medium shot, close-up, extreme close-up
2. Subject: who/what with 2-3 distinctive visual details
3. Action: one clear, specific action (avoid multiple actions)
4. Setting: where this takes place, time of day if relevant
5. Camera: movement (dolly, crane, handheld, static) and angle
6. Lighting: source, direction, quality (e.g., "soft window light from left")
7. Style: film reference or aesthetic (e.g., "cinematic, shot on 35mm")

WRITING RULES:
✓ Keep total output 100-150 words (AI models follow short prompts better)
✓ Use film language: dolly, crane, rack focus, shallow DOF, 35mm, f/1.8, etc.
✓ One main action per clip (multiple actions reduce quality)
✓ Put most important element FIRST (order = priority in AI processing)
✓ Describe what camera sees, not emotions or feelings
✓ Specific over generic: "weathered oak table" not "nice table"
✓ For 4-8 second clips, keep action simple and clear

AVOID:
✗ Prompts over 150 words
✗ Multiple simultaneous actions
✗ Emotional adjectives without visual grounding
✗ Instructive language ("don't show", "avoid", "no")
✗ Complex narratives (use multiple clips instead)

EXAMPLE STRUCTURE:
"Close-up of weathered hands turning pages of leather-bound book on oak desk, camera slowly dollies back to reveal Lincoln in candlelit study, soft amber glow from three candles on left creating 3:1 contrast, 50mm lens with shallow depth of field, cinematic style shot on 35mm, 1860s period details visible in background."

After the main prompt, add:

**TECHNICAL SPECS**
Duration: 5-8s (recommended for best instruction-following) | Aspect Ratio: 16:9 or 2.39:1 | Frame Rate: 24fps | Style: [one-word aesthetic reference]

**ALTERNATIVE APPROACHES** (2 variations, 40-50 words each)
Provide two brief alternatives that explore:
- Different camera angle or movement
- Different lighting setup
- Different moment in the same scene

Keep alternatives concise and maintain the same technical precision as the main prompt.

OUTPUT FORMAT:
Begin directly with the description paragraph. No preamble, no "Here is your prompt", no explanations.`;
}

// Export default for backwards compatibility
export default { generateVideoPrompt };
