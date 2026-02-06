import { logger } from '@infrastructure/Logger';
import type { ILogger } from '@interfaces/ILogger';
import OptimizationConfig from '@config/OptimizationConfig';
import type { OptimizationMode, QualityAssessment } from '../types';
import { VideoPromptService } from '../../video-prompt-analysis/VideoPromptService';
import { QualityAssessmentService } from './QualityAssessmentService';
import { resolvePromptModelId } from '@services/video-models/ModelRegistry';

interface CompileOptimizedPromptParams {
  operation: string;
  optimizedPrompt: string;
  targetModel?: string;
  mode: OptimizationMode;
  qualityAssessment: QualityAssessment;
}

export class VideoPromptCompilationService {
  private readonly videoPromptService: VideoPromptService;
  private readonly qualityAssessment: QualityAssessmentService;
  private readonly log: ILogger;

  constructor(videoPromptService: VideoPromptService, qualityAssessment: QualityAssessmentService) {
    this.videoPromptService = videoPromptService;
    this.qualityAssessment = qualityAssessment;
    this.log = logger.child({ service: 'VideoPromptCompilationService' });
  }

  private resolveTargetModel(
    targetModel: string | undefined
  ): string | null {
    const explicitModel = targetModel && targetModel.trim() !== '' ? targetModel : undefined;
    if (!explicitModel) {
      // Auto/default optimization must remain model-agnostic.
      return null;
    }
    return resolvePromptModelId(explicitModel) ?? explicitModel;
  }

  async compileOptimizedPrompt({
    operation,
    optimizedPrompt,
    targetModel,
    mode,
    qualityAssessment,
  }: CompileOptimizedPromptParams): Promise<{ prompt: string; metadata: Record<string, unknown> | null }> {
    if (mode !== 'video') {
      return { prompt: optimizedPrompt, metadata: null };
    }

    const resolvedTargetModel = this.resolveTargetModel(targetModel);
    if (!resolvedTargetModel) {
      return { prompt: optimizedPrompt, metadata: null };
    }

    this.log.info('Compiling prompt for target model', {
      operation,
      targetModel: resolvedTargetModel,
      genericLength: optimizedPrompt.length,
    });

    try {
      const compilationResult = await this.videoPromptService.optimizeForModel(
        optimizedPrompt,
        resolvedTargetModel
      );

      const compiledPrompt =
        typeof compilationResult.prompt === 'string'
          ? compilationResult.prompt
          : JSON.stringify(compilationResult.prompt, null, 2);
      const compiledIsStructured = typeof compilationResult.prompt !== 'string';

      const changeCount = Array.isArray(compilationResult.metadata?.phases)
        ? compilationResult.metadata.phases.flatMap((phase) =>
            Array.isArray(phase.changes) ? phase.changes : []
          ).length
        : 0;

      this.log.info('Prompt compiled successfully', {
        operation,
        targetModel: resolvedTargetModel,
        compiledLength: compiledPrompt.length,
        changes: changeCount,
      });

      const genericScore = qualityAssessment?.score ?? 0;
      let compiledScore: number | null = null;
      let keepCompiled = true;

      if (!compiledIsStructured) {
        const compiledAssessment = await this.qualityAssessment.assessQuality(compiledPrompt, mode);
        compiledScore = compiledAssessment.score;
        const dropThreshold = OptimizationConfig.iterativeRefinement.improvementThreshold;
        const minScore = OptimizationConfig.quality.minAcceptableScore;

        keepCompiled = compiledScore >= minScore && compiledScore + dropThreshold >= genericScore;

        if (!keepCompiled) {
          this.log.warn('Compiled prompt failed quality gate; returning generic prompt', {
            operation,
            targetModel: resolvedTargetModel,
            genericScore,
            compiledScore,
          });
        }
      }

      const metadata: Record<string, unknown> = {
        compiledFor: resolvedTargetModel,
        compilationMeta: compilationResult.metadata,
        compilationQuality: {
          genericScore,
          compiledScore,
          keptCompiled: keepCompiled,
          structuredOutput: compiledIsStructured,
        },
        ...(keepCompiled ? {} : { compilationWarning: 'compiled_quality_drop' }),
      };

      return {
        prompt: keepCompiled ? compiledPrompt : optimizedPrompt,
        metadata,
      };
    } catch (error) {
      this.log.error('Model compilation failed, reverting to generic optimization', error as Error, {
        operation,
        targetModel: resolvedTargetModel,
      });
      return { prompt: optimizedPrompt, metadata: null };
    }
  }

  async compilePrompt(prompt: string, targetModel: string): Promise<{
    compiledPrompt: string;
    metadata: Record<string, unknown> | null;
    targetModel: string;
  }> {
    const operation = 'compilePrompt';

    let resolvedTargetModel = targetModel.trim();
    if (!resolvedTargetModel) {
      throw new Error('Target model is required for compilation');
    }

    resolvedTargetModel = resolvePromptModelId(resolvedTargetModel) ?? resolvedTargetModel;

    this.log.info('Compiling prompt for target model', {
      operation,
      targetModel: resolvedTargetModel,
      promptLength: prompt.length,
    });

    const compilationResult = await this.videoPromptService.optimizeForModel(
      prompt,
      resolvedTargetModel
    );

    const compiledPrompt =
      typeof compilationResult.prompt === 'string'
        ? compilationResult.prompt
        : JSON.stringify(compilationResult.prompt, null, 2);

    return {
      compiledPrompt,
      metadata: {
        compiledFor: resolvedTargetModel,
        genericPrompt: prompt,
        compilationMeta: compilationResult.metadata,
      },
      targetModel: resolvedTargetModel,
    };
  }
}
