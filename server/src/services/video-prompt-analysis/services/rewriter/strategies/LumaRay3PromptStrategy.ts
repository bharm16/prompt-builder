import type { ModelPromptStrategy } from './types';
import { buildBaseHeader } from './promptStrategyUtils';

export const lumaRay3PromptStrategy: ModelPromptStrategy = {
  modelId: 'luma-ray3',
  output: { format: 'text' },
  buildPrompt: (context) => `${buildBaseHeader(context)}
INSTRUCTIONS for Luma Ray-3:
1. Use the strict structure: [Camera Shot/Angle], [Subject Description], [Action], [Lighting], [Mood/Atmosphere].
2. Ensure "Lighting" is a distinct, descriptive element (e.g., "soft morning light", "volumetric fog").
3. Describe motion with causal chains ("A does X, causing Y").
4. Incorporate 'environment' details into the Mood/Atmosphere section.
5. Integrate MANDATORY CONSTRAINTS (like HDR triggers) naturally into the Lighting or Style sections.
6. Avoid "loop" or "seamless" unless requested.

Output ONLY the optimized prompt.`,
};
