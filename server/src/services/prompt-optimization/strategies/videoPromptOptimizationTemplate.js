/**
 * Generate an optimized, production-ready video prompt for AI video generation models.
 * This template combines the "Director's Treatment" reasoning approach with the 
 * "Universal Prompt Framework" structure to ensure both intelligent shot selection
 * and strict compliance with research-backed syntax.
 * 
 * Designed for models like Sora, Veo, RunwayML, Kling, and Luma.
 *
 * @param {string} userConcept - The user's core creative idea for the video clip.
 * @param {Object|null} shotPlan - Optional interpreted shot metadata from ShotInterpreterService.
 * @returns {string} A formatted system prompt that requests structured JSON output.
 */
export function generateUniversalVideoPrompt(userConcept, shotPlan = null) {
  const interpretedPlan = shotPlan
    ? `Pre-interpreted shot plan (do NOT hallucinate missing fields):
- shot_type: ${shotPlan.shot_type || 'unknown'}
- core_intent: ${shotPlan.core_intent || 'n/a'}
- subject: ${shotPlan.subject || 'null'}
- action: ${shotPlan.action || 'null'}
- visual_focus: ${shotPlan.visual_focus || 'null'}
- setting/time: ${shotPlan.setting || 'null'} / ${shotPlan.time || 'null'}
- camera: move=${shotPlan.camera_move || 'null'}, angle=${shotPlan.camera_angle || 'null'}
- lighting/style: ${shotPlan.lighting || 'null'} / ${shotPlan.style || 'null'}
- mood: ${shotPlan.mood || 'null'}
If subject or action is null, lean on camera move + visual focus instead of inventing new entities.`
    : 'No interpreted shot plan provided. Keep ONE clear action if present, otherwise focus on camera move + visual focus. Do not invent subjects or actions.';

  return `
You are an elite Film Director and Cinematographer. Engineer a production-ready AI video prompt that obeys the research-backed universal structure.

User Concept: "${userConcept}"
${interpretedPlan}

---

## DIRECTOR'S TREATMENT (think before you write)
1) Identify genre/vibe and core intent.
2) Choose one primary shot type and one camera behavior that best serve the intent.
3) Enforce ONE action (if any). If none exists, keep the camera move as the hero.
4) Select lighting that matches the mood and keeps the scene readable.
5) Lock style/aesthetic with concrete references (film stock/genre/medium), not vague words.

## PRODUCTION ASSEMBLY (write the output)
Write ONE paragraph (100-150 words) that strictly follows:
**[Shot Type] → [Subject with 2-3 visible details] → [Action (one only)] → [Setting/time] → [Camera behavior] → [Lighting] → [Style]**
- If subject/action are null, pivot to camera move + visual focus instead of inventing characters.
- Describe only what the camera can SEE. Translate emotions into visible cues.
- Avoid negative phrasing (“don’t show”). State what to show.
- Keep language professional: dolly, truck, rack focus, shallow DOF, f/1.8, Rembrandt lighting.

## OUTPUT FORMAT (STRICT JSON)
Return ONLY JSON (no markdown, no prose):
{
  "_creative_strategy": "Brief summary of the director's treatment and why these choices serve the intent",
  "shot_type": "Shot/framing chosen (e.g., 'Low-angle wide shot', 'Overhead establishing', 'Tracking pan')",
  "technical_specs": {
    "lighting": "Precise setup with direction/quality",
    "camera": "Camera behavior + lens (e.g., 'Handheld 35mm tracking', 'Slow dolly in on 24mm')",
    "style": "Film stock/genre/medium reference (e.g., 'Shot on 35mm, film noir aesthetic')",
    "aspect_ratio": "16:9 | 9:16 | 2.39:1 (pick best fit)",
    "frame_rate": "24fps (cinematic) or 30fps (standard)",
    "duration": "4-8s",
    "audio": "Short audio note if relevant (otherwise 'mute' or 'natural ambience')"
  },
  "prompt": "Main paragraph, 100-150 words, following the exact structure above and honoring any null fields by omitting them",
  "variations": [
    {"label": "Alternative Camera", "prompt": "40-50 words, same concept, different camera angle/move"},
    {"label": "Alternative Lighting", "prompt": "40-50 words, same concept, different lighting/mood"}
  ],
  "shot_plan": ${shotPlan ? JSON.stringify(shotPlan, null, 2) : 'null'}
}
`;
}

// Export default for backwards compatibility
export default { generateUniversalVideoPrompt };

// Also export with old name for backwards compatibility
export const generateVideoPrompt = generateUniversalVideoPrompt;
