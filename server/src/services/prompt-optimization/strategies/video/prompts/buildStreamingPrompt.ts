import { wrapUserData } from '@utils/provider/PromptBuilder';
import { SECURITY_REMINDER } from '@utils/SecurityPrompts';
import type { CapabilityValues } from '@shared/capabilities';
import type { ShotPlan } from '@services/prompt-optimization/types';

export function buildStreamingPrompt(options: {
  prompt: string;
  shotPlan: ShotPlan | null;
  lockedSpans: Array<{ text: string; leftCtx?: string | null; rightCtx?: string | null; category?: string | null }>;
  generationParams?: CapabilityValues | null;
  originalUserPrompt?: string | null;
}): { systemPrompt: string; userMessage: string } {
  const constraintLines: string[] = [];
  if (options.generationParams) {
    const params = options.generationParams;
    if (params.aspect_ratio) constraintLines.push(`- Aspect Ratio: ${params.aspect_ratio}`);
    if (params.duration_s) constraintLines.push(`- Duration: ${params.duration_s}s`);
    if (params.fps) constraintLines.push(`- Frame Rate: ${params.fps}fps`);
    if (params.resolution) constraintLines.push(`- Resolution: ${params.resolution}`);
    if (typeof params.audio === 'boolean') constraintLines.push(`- Audio: ${params.audio ? 'Enabled' : 'Muted'}`);
  }

  const lockedSpanInstructions =
    options.lockedSpans && options.lockedSpans.length > 0
      ? `
LOCKED SPANS:
- Include EVERY locked span text verbatim in the final prompt.
- Do NOT paraphrase or drop locked spans.
- You may reposition them, but preserve their meaning and any provided context.`
      : '';

  const constraintBlock = constraintLines.length > 0
    ? `\nUSER CONSTRAINTS:\n${constraintLines.join('\n')}`
    : '';

  const systemPrompt = `${SECURITY_REMINDER}
You are an elite Film Director and Cinematographer. Optimize the user's video prompt for clarity, visual specificity, and technical coherence.
Primary success metric: improved prompt writing quality (cinematic specificity, constraint adherence, intent preservation, model compliance). Performance is secondary; acceptable to add bounded extra passes only when quality gates fail.

Requirements:
- **INTEGRATED NARRATIVE:** Weave all creative specifications (Camera Angle, Movement, Lighting, Style) naturally into the main description.
- **NO HARD SPECS:** Do NOT mention hardware-level technical values in the narrative (e.g., do not say "9:16", "16:9", "24fps", "8-seconds", or "4k"). These are handled by the system parameters. 
  - *Correct:* "A vertical close-up..." 
  - *Incorrect:* "A 9:16 close-up..."
- ONE continuous action only (if none exists, focus on camera movement and visual focus).
- Describe only what the camera can SEE. No audience language or abstract emotions without visible cues.
- Do not add camera brands or model names unless explicitly provided.
- Avoid negative phrasing. State what to show instead.
- If <original_user_prompt> is provided, treat it as source of truth; use <user_concept> as a draft candidate and restore any lost constraints.${lockedSpanInstructions}${constraintBlock}

Output ONLY the final optimized prompt text (no JSON, no markdown code blocks).

FORMAT:
<main paragraph (incorporating camera, lighting, and style naturally)>

**ALTERNATIVE APPROACHES**
- **Variation 1 (label):** ...
- **Variation 2 (label):** ...
(Include ALTERNATIVE APPROACHES only if you have meaningful alternatives.)`;

  const lockedPayload = options.lockedSpans.map((span) => ({
    text: span.text,
    leftCtx: span.leftCtx ?? null,
    rightCtx: span.rightCtx ?? null,
    category: span.category ?? null,
  }));

  const userFields: Record<string, string> = {
    user_concept: options.prompt,
    interpreted_plan: options.shotPlan ? JSON.stringify(options.shotPlan, null, 2) : '',
    locked_spans: lockedPayload.length > 0 ? JSON.stringify(lockedPayload, null, 2) : '',
  };
  if (options.originalUserPrompt) {
    userFields.original_user_prompt = options.originalUserPrompt;
  }

  const userMessage = wrapUserData(userFields);

  return { systemPrompt, userMessage };
}
