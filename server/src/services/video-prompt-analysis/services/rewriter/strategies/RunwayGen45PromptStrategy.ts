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
5. ART DIRECTION: Include specific visual aesthetics — color palette (warm amber tones, desaturated cool blues), film stock (shot on 16mm Kodak, Fujifilm Pro 400H grain), and visual treatment (soft halation, crushed blacks). Runway excels at stylized visuals.
6. VISUAL SPECIFICITY: Describe material textures (weathered leather, polished chrome), color temperatures, and surface qualities. Avoid abstract emotional language.
7. Avoid using "morphing" or "blur" unless explicitly requested.
8. Integrate the MANDATORY CONSTRAINTS naturally into the flow of the description, do not just append them.

Output ONLY the optimized prompt.`,
};
