import { LLMJudgeService } from '@services/quality-feedback/services/LLMJudgeService';
import type { AIModelService } from '@services/ai-model/AIModelService';

export interface SuggestionsServices {
  llmJudge: LLMJudgeService;
}

export function createSuggestionsServices(
  aiService: AIModelService
): SuggestionsServices {
  return {
    llmJudge: new LLMJudgeService(aiService),
  };
}
