import type { ModelPromptStrategy } from './types';
import { buildBaseHeader } from './promptStrategyUtils';

export const defaultPromptStrategy: ModelPromptStrategy = {
  modelId: 'default',
  output: { format: 'text' },
  buildPrompt: (context) =>
    `${buildBaseHeader(context)} Optimize this prompt for high-quality video generation.`,
};
