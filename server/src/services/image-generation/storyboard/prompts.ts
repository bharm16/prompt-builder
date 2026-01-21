const CONTINUITY_HEADER =
  'Continuity: preserve the same character identity, wardrobe, scene, lighting, and style. Apply only the change described.';

const FALLBACK_DELTAS = [
  'Reframe to a slightly wider establishing shot of the same scene.',
  'Reframe to a medium shot centered on the main subject.',
  'Reframe to a close-up on the main subject.',
  'Reframe to an over-the-shoulder view of the main subject.',
  'Reframe back to a wider shot to re-establish the scene.',
];

export const buildSystemPrompt = (deltaCount: number): string => `You are a storyboard frame planner.

You will receive a base image prompt. Return exactly ${deltaCount} edit instructions for subsequent frames.

OUTPUT FORMAT:
- Return ONLY valid JSON in the exact shape: {"deltas":["...","...","..."]}.
- The "deltas" array must contain exactly ${deltaCount} strings.

DELTA RULES:
- Each delta is a single still-image edit instruction for img2img.
- Make small, visual changes only.
- Preserve character identity, wardrobe, scene, lighting, and style.
- Maintain continuity and do not introduce new characters or locations.
- Favor a camera progression (wide -> medium -> close -> wide or over-the-shoulder) unless the prompt implies otherwise.
- Avoid temporal language like "then", "sequence", "montage", or "frame 2".
- Each delta must stand alone as a still-image instruction.`;

export const buildRepairSystemPrompt = (deltaCount: number): string =>
  `${buildSystemPrompt(deltaCount)}

REPAIR MODE:
- The previous response was invalid JSON or did not match the schema.
- Return ONLY valid JSON with the exact schema and array length.`;

export const buildEditPrompt = (basePrompt: string, delta: string): string =>
  `${CONTINUITY_HEADER}\nBase prompt: ${basePrompt}\nEdit instruction: ${delta}`;

export const buildFallbackDeltas = (expectedCount: number): string[] => {
  if (expectedCount <= 0) {
    return [];
  }
  const deltas: string[] = [];
  for (let index = 0; index < expectedCount; index += 1) {
    deltas.push(FALLBACK_DELTAS[index % FALLBACK_DELTAS.length]);
  }
  return deltas;
};
