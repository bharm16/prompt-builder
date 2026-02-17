import type { LLMJudgeService } from '@services/quality-feedback/services/LLMJudgeService';

export interface SuggestionsRouteServices {
  llmJudgeService: LLMJudgeService;
}

export interface SuggestionsServices {
  llmJudge: LLMJudgeService;
}

export function createSuggestionsServices(
  services: SuggestionsRouteServices
): SuggestionsServices {
  return {
    llmJudge: services.llmJudgeService,
  };
}
