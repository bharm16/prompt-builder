import type { PromptOptimizationService } from '@services/prompt-optimization/PromptOptimizationService';

export type PromptOptimizationServiceContract = Pick<
  PromptOptimizationService,
  'optimize' | 'optimizeTwoStage' | 'compilePrompt'
>;

export interface OptimizeServices {
  promptOptimizationService: PromptOptimizationServiceContract;
}
