import type { ModelPromptStrategy } from './types';
import { buildBaseHeader } from './promptStrategyUtils';

export const sora2PromptStrategy: ModelPromptStrategy = {
  modelId: 'sora-2',
  output: { format: 'text' },
  buildPrompt: (context) => `${buildBaseHeader(context)}
INSTRUCTIONS for Sora:
1. Use a descriptive "World-building" style, drawing heavily from the 'environment' and 'meta' fields in the IR.
2. Create long, rich, multi-sentence descriptions.
3. Detail background layers, atmospheric effects, and complex interactions between multiple subjects as defined in the IR.
4. Describe the "feel" through rich, evocative adjectives, mapping 'meta.mood' and 'meta.style' to descriptive prose.
5. Use 'technical' specs to ground the scene's scale and duration.

Output ONLY the optimized prompt.`,
};
