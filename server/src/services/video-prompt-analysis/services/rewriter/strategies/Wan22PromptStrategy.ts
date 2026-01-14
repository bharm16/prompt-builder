import type { ModelPromptStrategy } from './types';
import { buildBaseHeader } from './promptStrategyUtils';

export const wan22PromptStrategy: ModelPromptStrategy = {
  modelId: 'wan-2.2',
  output: { format: 'text' },
  buildPrompt: (context) => `${buildBaseHeader(context)}
INSTRUCTIONS for Wan 2.2:
1. Use the structure: Subject + Scene + Motion.
2. Be clear and sufficiently detailed (the "Golden Rule" for Wan).
3. Describe the subject's appearance and action precisely.
4. Define the environment and background elements.
5. Specify camera movement (e.g., "camera follows", "smooth pan") and lighting.
6. Target high-definition quality naturally (e.g., "captured in high definition").
7. Do NOT use bilingual output; use English only.

Output ONLY the optimized prompt.`,
};
