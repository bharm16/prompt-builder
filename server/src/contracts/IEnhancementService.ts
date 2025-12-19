/**
 * Interface for prompt enhancement services
 * Abstracts the contract for generating suggestions and enhancements
 */

import type { EnhancementResult } from '../types/services.ts';
import type { SuggestionRequest } from '../types/requests.ts';

export interface IEnhancementService {
  /**
   * Generate enhancement suggestions for a prompt
   */
  generateSuggestions(params: SuggestionRequest): Promise<EnhancementResult>;

  /**
   * Validate enhancement compatibility
   */
  validateCompatibility(params: Record<string, unknown>): Promise<{ compatible: boolean; feedback?: string; [key: string]: unknown }>;
}

