import type { ModelPromptStrategy } from './types';
import { buildBaseHeader } from './promptStrategyUtils';

export const kling26PromptStrategy: ModelPromptStrategy = {
  modelId: 'kling-26',
  output: { format: 'text' },
  buildPrompt: (context) => `${buildBaseHeader(context)}
INSTRUCTIONS for Kling 2.6:
1. Use the structure: [Subject], [Subject Description], [Movement/Action], [Scene/Context], [Camera/Lighting].
2. Use strong, active verbs for motion (e.g., "sprinting", "gliding").
3. detailed physical appearance for subjects.
4. Specify camera movement clearly (e.g., "Wide aerial shot", "Low-angle tracking shot").
5. Keep the description clear and precise; avoid ambiguous or abstract terms.
6. Do NOT use screenplay format. Use standard descriptive prose.

Output ONLY the optimized prompt.`,
};
