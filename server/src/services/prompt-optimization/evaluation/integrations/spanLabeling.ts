import type { AIModelService } from '@services/ai-model/AIModelService';
import type { LLMSpan } from '@llm/span-labeling/types';
import { labelSpans } from '@llm/span-labeling/SpanLabelingService';

export async function labelOptimizedSpans(
  ai: AIModelService,
  optimized: string
): Promise<LLMSpan[]> {
  const spanResult = await labelSpans(
    { text: optimized, maxSpans: 80, minConfidence: 0.4, templateVersion: 'v3.0' },
    ai
  );

  return spanResult.spans || [];
}
