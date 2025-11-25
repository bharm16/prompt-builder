/**
 * Interface for prompt optimization services
 * Abstracts the contract for optimizing user prompts
 */

import type { OptimizationResult, ValidationResult } from '../types/services.js';

export interface IPromptOptimizationService {
  /**
   * Optimize a prompt for better results
   */
  optimizePrompt(prompt: string, options?: Record<string, unknown>): Promise<OptimizationResult>;

  /**
   * Validate that a prompt meets quality standards
   */
  validatePrompt(prompt: string): Promise<ValidationResult>;
}

