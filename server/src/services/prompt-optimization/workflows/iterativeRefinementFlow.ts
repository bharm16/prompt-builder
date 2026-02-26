import OptimizationConfig from '@config/OptimizationConfig';
import { throwIfAborted } from './abort';
import type { IterativeRefinementFlowArgs } from './types';

export const runIterativeRefinementFlow = async ({
  prompt,
  mode,
  context,
  brainstormContext,
  lockedSpans,
  generationParams,
  shotPlan,
  useConstitutionalAI,
  signal,
  onMetadata,
  log,
  strategyFactory,
  qualityAssessment,
  applyConstitutionalAI,
}: IterativeRefinementFlowArgs): Promise<string> => {
  const startTime = performance.now();
  const operation = 'optimizeIteratively';

  log.debug('Starting operation.', {
    operation,
    mode,
    promptLength: prompt.length,
  });

  const maxIterations = OptimizationConfig.iterativeRefinement.maxIterations;
  const targetScore = OptimizationConfig.quality.targetScore;
  const improvementThreshold = OptimizationConfig.iterativeRefinement.improvementThreshold;

  let currentPrompt = prompt;
  let bestPrompt = prompt;
  let bestScore = 0;
  let lastMetadata: Record<string, unknown> | null = null;
  const collectMetadata = (metadata: Record<string, unknown>): void => {
    lastMetadata = metadata;
  };

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    throwIfAborted(signal);
    log.debug('Iteration starting', {
      operation,
      iteration,
      currentScore: bestScore,
    });

    const strategy = strategyFactory.getStrategy(mode);
    const domainContent = strategy.generateDomainContent
      ? await strategy.generateDomainContent(currentPrompt, context, shotPlan)
      : null;
    const optimized = await strategy.optimize({
      prompt: currentPrompt,
      context,
      brainstormContext,
      generationParams,
      domainContent: domainContent as string | null,
      shotPlan,
      ...(lockedSpans && lockedSpans.length > 0 ? { lockedSpans } : {}),
      onMetadata: collectMetadata,
      ...(signal ? { signal } : {}),
    });

    const finalOptimized = useConstitutionalAI
      ? await applyConstitutionalAI(optimized, mode, signal)
      : optimized;

    const assessment = await qualityAssessment.assessQuality(finalOptimized, mode);

    if (assessment.score > bestScore) {
      bestScore = assessment.score;
      bestPrompt = finalOptimized;
      log.debug('Iteration improved quality', {
        operation,
        iteration,
        score: bestScore,
      });
    }

    if (assessment.score >= targetScore) {
      log.info('Target quality reached', {
        operation,
        iteration,
        score: bestScore,
        duration: Math.round(performance.now() - startTime),
      });
      break;
    }

    if (iteration > 0 && (assessment.score - bestScore) < improvementThreshold) {
      log.debug('Marginal improvement, stopping', {
        operation,
        iteration,
      });
      break;
    }

    currentPrompt = finalOptimized;
  }

  log.info('Operation completed.', {
    operation,
    finalScore: bestScore,
    iterations: maxIterations,
    duration: Math.round(performance.now() - startTime),
  });

  if (onMetadata && lastMetadata) {
    onMetadata(lastMetadata);
  }

  return bestPrompt;
};
