/**
 * Generate an optimized, production-ready video prompt for AI video generation models.
 * This template is designed for models like Sora, Veo, RunwayML, Kling, and Luma.
 * It enforces a structured, cinematic approach to maximize prompt adherence and output quality.
 *
 * @param {string} userConcept - The user's core creative idea for the video clip.
 * @returns {string} A formatted and optimized prompt ready for an AI video generation API.
 */
export function generateUniversalVideoPrompt(userConcept) {
  return `
Transform the following user concept into a production-ready AI video prompt (100-150 words).

User's concept: "${userConcept}"

---

**PROMPT:**

Write ONE descriptive paragraph that introduces elements in this exact order: shot type → primary subject with 2-3 defining details → one specific action → precise setting and time → camera movement and angle → lighting source/direction/quality → aesthetic reference (film stock, genre, or artist).

---

**GUIDING PRINCIPLES (in order of importance):**
1.  **Shot Type:** Start with the framing (e.g., wide shot, medium shot, close-up, extreme close-up). This establishes the entire scene's composition first.
2.  **Subject:** Clearly define the main subject. Include 2-3 specific, visible details (e.g., "a woman in a red trench coat with blonde hair") to ensure consistency and avoid generic outputs.
3.  **Action:** Describe ONE clear, specific, and physically plausible action. Multiple actions in one prompt severely degrade quality due to the architectural constraints of video models.
4.  **Setting:** Ground the action in a specific location and time (e.g., "a neon-lit Tokyo alley at midnight," "a serene beach at golden hour").
5.  **Camera:** Detail the camera's behavior. Specify both movement (e.g., static, slow dolly in, handheld tracking) and angle (e.g., low angle, high angle, eye-level).
6.  **Lighting:** Describe the light to control the mood. Specify its source (e.g., "soft window light"), direction (e.g., "from the left"), and quality (e.g., "creating deep shadows").
7.  **Style:** Provide a specific aesthetic reference. Avoid generic terms like "cinematic." Instead, use film stock ("shot on 35mm film"), genre ("film noir aesthetic"), or an artist/director reference ("in the style of Wes Anderson").

---

**WRITING RULES:**
✓ Total prompt length should be 100-150 words. Models follow concise, dense prompts more reliably.
✓ Use professional cinematic and photographic language (e.g., dolly, crane, rack focus, shallow DOF, f/1.8, Rembrandt lighting).
✓ The order of elements in the prompt paragraph dictates their priority in the AI's processing. Place the most important element FIRST.
✓ Describe only what the camera can SEE. Translate emotions and concepts into visible actions and environmental details.
✓ Be specific over generic: "a weathered oak desk" is superior to "a nice desk."

**AVOID:**
✗ Prompts longer than 150 words.
✗ Describing multiple simultaneous actions or a sequence of events. (Use multiple clips for a narrative.)
✗ Using ungrounded emotional adjectives (e.g., "a sad man").
✗ Using negative or instructive language (e.g., "don't show," "avoid," "no people"). Describe what you *want* to see instead.

---

**EXAMPLE STRUCTURED PROMPT:**
"Close-up of weathered, wrinkled hands slowly turning the pages of a large, leather-bound book on a dark oak desk. The camera slowly dollies back to reveal an elderly historian in a candlelit study. The scene is lit by a single, warm candle on the left, creating dramatic, low-key lighting with a high contrast ratio. The style is moody and atmospheric, shot on 35mm film with a shallow depth of field, f/1.8, creating significant bokeh in the background."

---

After the main prompt paragraph, add the following technical and creative specifications:

**TECHNICAL SPECS**
- **Duration:** 4-8s (Optimal for instruction-following and quality)
- **Aspect Ratio:** 16:9 (Landscape), 9:16 (Vertical), or 2.39:1 (Cinematic)
- **Frame Rate:** 24fps (Filmic) or 30fps (Standard Video)
- **Audio:** Declare the audio treatment (e.g., mute, natural ambience, or cinematic score) so the render engine does not guess.

**ALTERNATIVE APPROACHES (2 variations, 40-50 words each)**
Provide two brief, alternative prompts that explore different creative choices for the same core concept. This facilitates A/B testing and rapid iteration.
- **Variation 1 (Different Camera):** Explore a different camera angle or movement while restating the core subject identifiers. Keep it to one sentence, 40-50 words.
- **Variation 2 (Different Lighting/Mood):** Explore a different lighting setup or mood while restating the core subject identifiers. Keep it to one sentence, 40-50 words.

---

**OUTPUT FORMAT:**
Begin directly with the main prompt paragraph. Do not include any preamble, explanations, or conversational text.
`;
}

// Export default for backwards compatibility
export default { generateUniversalVideoPrompt };

// Also export with old name for backwards compatibility
export const generateVideoPrompt = generateUniversalVideoPrompt;

