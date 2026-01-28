import type { AIService, OptimizationMode } from '../types';

/**
 * Service for detecting the optimal optimization mode for a prompt
 */
export class ModeDetectionService {
  constructor(_aiService: AIService) {
    void _aiService;
  }

  /**
   * Detect optimal mode for the given prompt
   */
  async detectMode(prompt: string): Promise<OptimizationMode> {
    void prompt;
    return 'video';
  }
}

export default ModeDetectionService;
