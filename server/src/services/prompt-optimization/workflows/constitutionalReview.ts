import { ConstitutionalAI } from '@utils/ConstitutionalAI';
import OptimizationConfig from '@config/OptimizationConfig';
import { throwIfAborted } from './abort';
import type { ConstitutionalReviewFlowArgs } from './types';

export const runConstitutionalReviewFlow = async ({
  prompt,
  mode,
  signal,
  log,
  ai,
}: ConstitutionalReviewFlowArgs): Promise<string> => {
  const startTime = performance.now();
  const operation = 'applyConstitutionalAI';

  log.debug('Starting operation.', {
    operation,
    mode,
    promptLength: prompt.length,
  });

  try {
    throwIfAborted(signal);

    const sampleRate = OptimizationConfig.constitutionalAI?.sampleRate ?? 1;
    if (sampleRate < 1 && Math.random() > Math.max(0, Math.min(1, sampleRate))) {
      log.debug('Operation skipped (sampled out).', {
        operation,
        sampleRate,
      });
      return prompt;
    }

    const claudeClient = {
      complete: async (reviewPrompt: string, options?: { maxTokens?: number }) => {
        const response = await ai.execute('optimize_quality_assessment', {
          systemPrompt: reviewPrompt,
          maxTokens: options?.maxTokens ?? 2048,
          temperature: 0.2,
          ...(signal ? { signal } : {}),
        });
        const content = response.content?.map((item) => ({ text: item.text ?? '' }));
        return {
          text: response.text,
          ...(content ? { content } : {}),
        };
      },
    };

    const reviewResult = await ConstitutionalAI.applyConstitutionalReview(
      claudeClient,
      prompt,
      prompt
    );

    if (reviewResult.revised) {
      log.info('Constitutional AI suggested revisions', {
        operation,
        issueCount: reviewResult.critique?.issues?.length || 0,
        duration: Math.round(performance.now() - startTime),
      });
      return reviewResult.output;
    }

    log.debug('Operation completed; no revisions needed.', {
      operation,
      duration: Math.round(performance.now() - startTime),
    });

    return prompt;
  } catch (error) {
    log.error('Operation failed.', error as Error, {
      operation,
      duration: Math.round(performance.now() - startTime),
    });
    return prompt;
  }
};
