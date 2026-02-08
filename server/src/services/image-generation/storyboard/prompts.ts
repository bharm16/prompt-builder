const FALLBACK_DELTAS = [
  'Reframe to a slightly wider establishing shot of the same scene.',
  'Reframe to a medium shot centered on the main subject.',
  'Reframe to a close-up on the main subject.',
  'Reframe to an over-the-shoulder view of the main subject.',
  'Reframe back to a wider shot to re-establish the scene.',
];

export const buildSystemPrompt = (deltaCount: number): string => `You are a storyboard frame planner.

You will receive a base image prompt. Return exactly ${deltaCount} edit instructions for subsequent frames in a temporal sequence.

OUTPUT FORMAT:
- Return ONLY valid JSON in the exact shape: {"deltas":["...","...","..."]}.
- The "deltas" array must contain exactly ${deltaCount} strings.

DELTA RULES:
- Treat the frames as a consecutive timeline (Base -> Frame 1 -> Frame 2 -> Frame 3).
- **Progress the Action:** If the prompt describes movement (running, fighting, eating), advance that action naturally (e.g., "The runner's leading foot hits the ground", "The sword swings forward", "The character takes a bite").
- **Camera Movement:** If the scene is static, use camera moves to create a sequence (e.g., "Camera pushes in closer", "Angle shifts to a low view").
- **Visual Focus:** Describe the specific visual change for that moment.
- **Continuity:** Strictly preserve character identity, wardrobe, setting, and style.
- **Format:** Write distinct, standalone visual descriptions. Avoid meta-text like "Frame 2:" or "Then...".`;

export const buildRepairSystemPrompt = (deltaCount: number): string =>
  `${buildSystemPrompt(deltaCount)}

REPAIR MODE:
- The previous response was invalid JSON or did not match the schema.
- Return ONLY valid JSON with the exact schema and array length.`;

export const buildEditPrompt = (basePrompt: string, delta: string): string =>
  `${basePrompt}. ${delta}`;

export const buildFallbackDeltas = (expectedCount: number): string[] => {
  if (expectedCount <= 0) {
    return [];
  }
  const deltas: string[] = [];
  for (let index = 0; index < expectedCount; index += 1) {
    deltas.push(FALLBACK_DELTAS[index % FALLBACK_DELTAS.length] ?? FALLBACK_DELTAS[0]!);
  }
  return deltas;
};
