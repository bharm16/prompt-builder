// server/llm/roleClassifier.ts
// LLM role classification orchestrator.

import { logger } from '@infrastructure/Logger';
import { TAXONOMY } from '#shared/taxonomy.js';
import type { InputSpan, LabeledSpan, AIService } from './types.js';
import { SYSTEM_PROMPT } from './roleClassifierPrompt.js';
import { getCachedLabels, hashKey, setCachedLabels } from './roleClassifierCache.js';
import { safeParseJSON } from './roleClassifierParser.js';
import { ROLE_SET, validate } from './roleClassifierValidator.js';

export { ROLE_SET, hashKey, validate };

/**
 * Classify spans with roles using LLM
 */
export async function roleClassify(
  spans: InputSpan[],
  templateVersion: string,
  aiService: AIService
): Promise<LabeledSpan[]> {
  if (!aiService) {
    throw new Error('aiService is required');
  }

  const key = hashKey(spans, templateVersion);
  const cached = getCachedLabels(key);
  if (cached) return cached;

  const userPayload = JSON.stringify({
    spans,
    templateVersion,
  });

  try {
    const response = await aiService.execute('role_classification', {
      systemPrompt: SYSTEM_PROMPT,
      userMessage: userPayload,
      // temperature and maxTokens are configured in modelConfig.js
    });

    const raw = response.text || response.content?.[0]?.text || '';
    const parsed = safeParseJSON(raw);
    const labeled = validate(spans, parsed?.spans ?? []);
    setCachedLabels(key, labeled);
    return labeled;
  } catch (error) {
    const err = error as Error;
    const log = logger.child({ service: 'roleClassifier' });
    log.warn('roleClassify fallback to deterministic labels', {
      operation: 'roleClassify',
      error: err?.message,
    });
    return spans.map((span) => ({
      ...span,
      role: TAXONOMY.SUBJECT.id,
      confidence: 0,
    }));
  }
}
