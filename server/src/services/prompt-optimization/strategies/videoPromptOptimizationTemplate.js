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
  // Define the vocabulary inline to ensure the model has access to the full "Technical Dictionary"
  const VOCABULARY = {
    cameraMovements: [
      "Pan", "Tilt", "Roll", "Dolly", "Truck", "Pedestal", "Arc Move", "Push In", "Pull Back", 
      "Zoom", "Crash Zoom", "Dolly Zoom", "Whip Pan", "Rack Focus", "Steadicam", "Handheld", 
      "Shoulder Mount", "Body Mount", "Snorricam", "Gimbal", "Jib", "Crane", "Technocrane", 
      "Slider", "Dolly Track", "Cable Cam", "Motion Control", "Drone", "FPV Drone", "Car Mount", 
      "Process Trailer", "Stabilized Head", "Remote Head", "Time-Lapse Move", "Hyperlapse"
    ],
    shotTypes: [
      "Extreme Close-Up", "Close-Up", "Medium Close-Up", "Medium Shot", "Medium Long Shot",
      "Cowboy Shot", "Full Shot", "Wide Shot", "Extreme Wide Shot", "Establishing Shot",
      "Master Shot", "Clean Single", "Dirty Single", "Two-Shot", "Three-Shot", "Group Shot",
      "Over-the-Shoulder Shot", "Point-of-View Shot", "Objective Shot", "Insert Shot",
      "Cutaway Shot", "Reaction Shot", "Eye-Level Shot", "Low-Angle Shot", "High-Angle Shot",
      "Bird's-Eye View", "Worm's-Eye View", "Dutch Angle", "Profile Shot", "Fisheye Shot",
      "Macro Shot", "Wide-Angle Shot", "Telephoto Shot", "Telephoto Compression", "Deep Focus",
      "Shallow Focus", "Split Diopter Shot", "Tilt-Shift Shot", "360-Degree Shot"
    ]
  };

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

## TECHNICAL DICTIONARY (Use these specific terms)
You have access to the following cinematic vocabulary. DO NOT DEFAULT to "Eye-Level" or "Medium Shot" unless it specifically serves the intent.

- **Camera Moves**: ${VOCABULARY.cameraMovements.join(', ')}

- **Shot Types/Angles**: ${VOCABULARY.shotTypes.join(', ')}

## DIRECTOR'S TREATMENT (think before you write)
1) Identify genre/vibe and core intent.
2) **Select a Shot Type/Angle** from the Technical Dictionary that amplifies the emotion (e.g., Low-Angle for power, High-Angle for vulnerability, Dutch Angle for unease, Bird's-Eye for scale).
3) **Determine Focus & Frame Rate**:
   - **Depth of Field**: Use "Deep Focus (f/11-f/16)" for Wide/Establishing shots (we need to see the world). Use "Shallow Focus (f/1.8-f/2.8)" ONLY for Close-ups/Portraits.
   - **Frame Rate**: Use 60fps for high-speed action/sports. Use 24fps for narrative/cinema. Use 30fps for broadcast/documentary.
4) Choose a **Camera Behavior** from the Dictionary that matches the energy (e.g., Handheld for chaos, Steadicam for flow, Crash Zoom for shock).
5) Enforce ONE action (if any). If none exists, keep the camera move as the hero.
6) Select lighting that matches the mood and keeps the scene readable.
7) Lock style/aesthetic with concrete references (film stock/genre/medium), not vague words.

8) **Consistency Check**: Review the generated prompt. Does the camera behavior, lighting, and style logically support the subject and action? For example, if the subject mentions "white gloves," the camera should not be focused exclusively on the "feet." Resolve any contradictions.

## PRODUCTION ASSEMBLY (write the output)
Write ONE paragraph (STRICT 100-150 words) that strictly follows:
**[Shot Type] → [Subject with 2-3 visible details] → [Action (ONE ONLY)] → [Setting/time] → [Camera behavior] → [Lighting] → [Style]**
- If subject or action is null, OMIT it. Do not invent a subject/action; lean on camera move + visual focus instead.
- HARD RULE: ONE ACTION ONLY. If multiple actions appear, rewrite to one.
- Describe only what the camera can SEE. Translate mood/emotion into visible cues (lighting, pose, texture, environment).
- ABSOLUTELY NO negative phrasing (“don’t show/avoid/no people”). State what to show instead.
- Keep language professional: dolly, truck, rack focus, shallow DOF, f/1.8, Rembrandt lighting, etc.
- If any required component is missing from concept and shotPlan, leave it out rather than hallucinating.

## OUTPUT FORMAT (STRICT JSON)
Return ONLY JSON (no markdown, no prose):
{
  "_creative_strategy": "Brief summary of why you chose this specific Angle, DOF, and FPS to serve the intent",
  "shot_type": "Shot/framing chosen (Must use term from Technical Dictionary, e.g., 'Low-Angle Shot', 'Dutch Angle', 'Bird's-Eye View')",
  "technical_specs": {
    "lighting": "Precise setup with source, direction, quality, and color temp",
    "camera": "Camera behavior + angle + lens + aperture. (Examples: 'Wide shot on 16mm with deep focus f/11' OR 'Close-up on 85mm with shallow focus f/1.8'). MATCH APERTURE TO SHOT TYPE.",
    "style": "Film stock/genre/medium reference (e.g., 'Shot on 35mm, film noir aesthetic', 'Pencil storyboard panel')",
    "aspect_ratio": "16:9 | 9:16 | 2.39:1 (pick best fit)",
    "frame_rate": "24fps | 30fps | 60fps (Choose 60fps for smooth action, 24fps for cinematic feel)",
    "duration": "4-8s",
    "audio": "Short audio note if relevant (otherwise 'mute' or 'natural ambience')"
  },
  "prompt": "Main paragraph, 100-150 words, following the exact structure above and honoring any null fields by omitting them",
  "variations": [
    {"label": "Alternative Angle", "prompt": "40-50 words using a radically different angle from the Dictionary (e.g., if main is Low-Angle, try Bird's-Eye)"},
    {"label": "Alternative Lighting", "prompt": "40-50 words, same concept, different lighting/mood; keep core identifiers"}
  ],
  "shot_plan": ${shotPlan ? JSON.stringify(shotPlan, null, 2) : 'null'}
}
`;
}

// Export default for backwards compatibility
export default { generateUniversalVideoPrompt };

// Also export with old name for backwards compatibility
export const generateVideoPrompt = generateUniversalVideoPrompt;
