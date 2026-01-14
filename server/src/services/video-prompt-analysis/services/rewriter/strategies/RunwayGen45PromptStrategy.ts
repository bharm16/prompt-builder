import type { ModelPromptStrategy } from './types';
import { buildBaseHeader } from './promptStrategyUtils';

export const runwayGen45PromptStrategy: ModelPromptStrategy = {
  modelId: 'runway-gen45',
  output: { format: 'text' },
  buildPrompt: (context) => `${buildBaseHeader(context)}
INSTRUCTIONS for Runway Gen-4.5 (A2D):
1. Use the strict structure: [Camera Movement]: [Establishing Scene]. [Additional Details].
2. Start with the camera movement (e.g., "Zoom in:", "Truck left:", "Static:").
3. Follow with the Subject and Action in a clear, continuous narrative.
4. Synthesize 'environment' and 'lighting' into the scene description.
5. Incorporate technical specifications naturally into the description (e.g., "shot on 35mm film", "cinematic lighting").
6. Avoid using "morphing" or "blur" unless explicitly requested.
7. Integrate the MANDATORY CONSTRAINTS naturally into the flow of the description, do not just append them.

Output ONLY the optimized prompt.`,
};
