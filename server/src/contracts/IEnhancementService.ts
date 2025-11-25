/**
 * Interface for prompt enhancement services
 * Abstracts the contract for generating suggestions and enhancements
 */

import type { EnhancementResult } from '../types/services.js';
import type { SuggestionRequest } from '../types/requests.js';

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

