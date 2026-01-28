import type { VideoPromptIR } from '../../../types';
import type { RewriteConstraints } from '../../../strategies/types';

export interface PromptBuildContext {
  ir: VideoPromptIR;
  modelId: string;
  constraints: RewriteConstraints;
}

export type StrategyOutput =
  | { format: 'text' }
  | { format: 'structured'; schema: Record<string, unknown> };

export interface ModelPromptStrategy {
  modelId: string;
  output: StrategyOutput;
  buildPrompt: (context: PromptBuildContext) => string;
}
