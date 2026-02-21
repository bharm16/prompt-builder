import type { DIContainer } from '@infrastructure/DIContainer';
import { logger } from '@infrastructure/Logger';
import { admin, getFirestore } from '@infrastructure/firebaseAdmin';
import type { Bucket } from '@google-cloud/storage';
import type { LLMClient } from '@clients/LLMClient';
import { warmupGliner } from '@llm/span-labeling/nlp/NlpSpanService';
import { warmupDepthEstimationOnStartup } from '@services/convergence/depth';
import type { VideoJobWorker } from '@services/video-generation/jobs/VideoJobWorker';
import type { VideoJobSweeper } from '@services/video-generation/jobs/VideoJobSweeper';
import type { VideoAssetRetentionService } from '@services/video-generation/storage/VideoAssetRetentionService';
import type { CapabilitiesProbeService } from '@services/capabilities/CapabilitiesProbeService';
import type { CreditRefundSweeper } from '@services/credits/CreditRefundSweeper';
import { getRuntimeFlags } from './runtime-flags';

interface HealthCheckResult {
  healthy: boolean;
  error?: string;
  responseTime?: number;
}

async function runInfrastructureStartupChecks(container: DIContainer): Promise<void> {
  const auth = admin.auth();
  await auth.listUsers(1);

  const firestore = getFirestore();
  await firestore.listCollections();

  const bucket = container.resolve<Bucket>('gcsBucket');
  const [exists] = await bucket.exists();
  if (!exists) {
    throw new Error(`Configured GCS bucket does not exist: ${bucket.name}`);
  }
}

/**
 * Initialize and validate all services
 * Performs health checks on critical services
 *
 * @throws {Error} If critical services fail health checks
 */
export async function initializeServices(container: DIContainer): Promise<DIContainer> {
  logger.info('Initializing services...');
  const runtimeFlags = getRuntimeFlags();
  const isTestEnv = process.env.NODE_ENV === 'test' || process.env.VITEST || process.env.VITEST_WORKER_ID;

  if (!isTestEnv) {
    try {
      await runInfrastructureStartupChecks(container);
      logger.info('✅ Infrastructure startup checks passed', {
        checks: ['firebase-auth', 'firestore', 'gcs-bucket'],
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Infrastructure startup checks failed', error as Error, {
        error: errorMessage,
      });
      throw new Error(`Infrastructure startup checks failed: ${errorMessage}`);
    }
  }

  // Resolve OpenAI client and validate (optional)
  const claudeClient = container.resolve<LLMClient | null>('claudeClient');

  if (claudeClient) {
    logger.info('Validating OpenAI API key...');

    try {
      const openAIHealth = await claudeClient.healthCheck() as HealthCheckResult;

      if (!openAIHealth.healthy) {
        logger.warn(
          '⚠️  OpenAI API key validation failed - OpenAI adapter disabled',
          { error: openAIHealth.error }
        );
        container.registerValue('claudeClient', null);
      } else {
        logger.info('✅ OpenAI API key validated successfully', {
          responseTime: openAIHealth.responseTime,
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.warn(
        '⚠️  Failed to validate OpenAI API key - OpenAI adapter disabled',
        { error: errorMessage }
      );
      container.registerValue('claudeClient', null);
    }
  } else {
    logger.warn('OpenAI client not configured; relying on other providers');
  }

  // Resolve and validate Groq client (OPTIONAL)
  const groqClient = container.resolve<LLMClient | null>('groqClient');
  if (groqClient) {
    logger.info('Groq client initialized for two-stage optimization');

    try {
      const groqHealth = await groqClient.healthCheck() as HealthCheckResult;

      if (!groqHealth.healthy) {
        logger.warn(
          '⚠️  Groq API key validation failed - two-stage optimization disabled',
          {
            error: groqHealth.error,
          }
        );
        // Override with null to disable
        container.registerValue('groqClient', null);
      } else {
        logger.info('✅ Groq API key validated successfully', {
          responseTime: groqHealth.responseTime,
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.warn(
        '⚠️  Failed to validate Groq API key - two-stage optimization disabled',
        {
          error: errorMessage,
        }
      );
      container.registerValue('groqClient', null);
    }
  }

  // Resolve and validate Qwen client (OPTIONAL)
  const qwenClient = container.resolve<LLMClient | null>('qwenClient');
  if (qwenClient) {
    logger.info('Qwen client initialized for adapter-based routing');

    try {
      const qwenHealth = await qwenClient.healthCheck() as HealthCheckResult;

      if (!qwenHealth.healthy) {
        logger.warn(
          '⚠️  Qwen API key validation failed - adapter disabled',
          {
            error: qwenHealth.error,
          }
        );
        container.registerValue('qwenClient', null);
      } else {
        logger.info('✅ Qwen API key validated successfully', {
          responseTime: qwenHealth.responseTime,
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.warn(
        '⚠️  Failed to validate Qwen API key - adapter disabled',
        {
          error: errorMessage,
        }
      );
      container.registerValue('qwenClient', null);
    }
  }

  // Resolve and validate Gemini client (OPTIONAL)
  const geminiClient = container.resolve<LLMClient | null>('geminiClient');
  if (geminiClient) {
    logger.info('Gemini client initialized for adapter-based routing');
    const allowUnhealthyGemini = runtimeFlags.allowUnhealthyGemini;

    try {
      const geminiHealth = await geminiClient.healthCheck() as HealthCheckResult;

      if (!geminiHealth.healthy) {
        logger.warn(
          '⚠️  Gemini API key validation failed',
          {
            error: geminiHealth.error,
          }
        );
        if (!allowUnhealthyGemini) {
          logger.warn('⚠️  Gemini adapter disabled (health check failed)');
          container.registerValue('geminiClient', null);
        } else {
          logger.warn('Keeping Gemini adapter enabled despite failed health check');
        }
      } else {
        logger.info('✅ Gemini API key validated successfully', {
          responseTime: geminiHealth.responseTime,
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.warn(
        '⚠️  Failed to validate Gemini API key',
        {
          error: errorMessage,
        }
      );
      if (!allowUnhealthyGemini) {
        logger.warn('⚠️  Gemini adapter disabled (health check failed)');
        container.registerValue('geminiClient', null);
      } else {
        logger.warn('Keeping Gemini adapter enabled despite failed health check');
      }
    }
  }

  // Pre-resolve all services to ensure they can be instantiated
  // This catches configuration errors early
  const serviceNames = [
    'promptOptimizationService',
    'enhancementService',
    'sceneDetectionService',
    'promptCoherenceService',
    'videoConceptService',
    'spanLabelingCacheService',
  ];

  for (const serviceName of serviceNames) {
    try {
      container.resolve(serviceName);
      logger.info('Service initialized', { serviceName });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(
        'Service initialization failed',
        error instanceof Error ? error : new Error(String(error)),
        { serviceName }
      );
      throw new Error(`Service initialization failed for ${serviceName}: ${errorMessage}`);
    }
  }

  const capabilitiesProbe = container.resolve<CapabilitiesProbeService | null>('capabilitiesProbeService');
  if (capabilitiesProbe) {
    try {
      capabilitiesProbe.start();
    } catch (error) {
      logger.warn('Capabilities probe failed to start', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info('All services initialized and validated successfully');
  const { promptOutputOnly } = runtimeFlags;

  // Only warmup GLiNER if neuro-symbolic pipeline is enabled and prewarm is requested
  const { NEURO_SYMBOLIC } = await import('@llm/span-labeling/config/SpanLabelingConfig');
  const shouldWarmGliner = !promptOutputOnly &&
    NEURO_SYMBOLIC.ENABLED &&
    NEURO_SYMBOLIC.GLINER?.ENABLED &&
    NEURO_SYMBOLIC.GLINER.PREWARM_ON_STARTUP;
  if (shouldWarmGliner) {
    try {
      const glinerResult = await warmupGliner();
      if (glinerResult.success) {
        logger.info('✅ GLiNER model warmed up for semantic extraction');
      } else {
        logger.warn('⚠️ GLiNER warmup skipped', {
          reason: glinerResult.message || 'Unknown reason',
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn('⚠️ GLiNER warmup failed', { error: errorMessage });
    }
  } else {
    const reason = promptOutputOnly ? 'PROMPT_OUTPUT_ONLY' : 'prewarm disabled or GLiNER disabled';
    logger.info('ℹ️ GLiNER warmup skipped', { reason });
  }

  const logDepthWarmupResult = (
    depthWarmup: Awaited<ReturnType<typeof warmupDepthEstimationOnStartup>>
  ) => {
    if (depthWarmup.success) {
      logger.info('✅ Depth estimation warmed up', {
        provider: depthWarmup.provider,
        durationMs: depthWarmup.durationMs,
      });
    } else if (depthWarmup.skipped) {
      logger.info('ℹ️ Depth warmup skipped', {
        reason: depthWarmup.message || 'Unknown reason',
      });
    } else {
      logger.warn('⚠️ Depth warmup failed', {
        provider: depthWarmup.provider,
        reason: depthWarmup.message || 'Unknown reason',
      });
    }
  };

  if (!isTestEnv && !promptOutputOnly) {
    // Start depth warmup in background - do not await
    // This allows server to become healthy/ready while fal.ai spins up
    warmupDepthEstimationOnStartup()
      .then(depthWarmup => {
        logDepthWarmupResult(depthWarmup);
      })
      .catch((error) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.warn('⚠️ Depth warmup failed', { error: errorMessage });
      });
  } else {
    const reason = promptOutputOnly ? 'PROMPT_OUTPUT_ONLY' : 'test environment';
    logger.info('ℹ️ Depth warmup skipped', { reason });
  }

  if (!isTestEnv && !promptOutputOnly) {
    const creditRefundSweeper = container.resolve<CreditRefundSweeper | null>('creditRefundSweeper');
    if (creditRefundSweeper) {
      creditRefundSweeper.start();
      logger.info('✅ Credit refund sweeper started');
    }

    const videoAssetRetentionService =
      container.resolve<VideoAssetRetentionService | null>('videoAssetRetentionService');
    if (videoAssetRetentionService) {
      videoAssetRetentionService.start();
      logger.info('✅ Video asset retention service started');
    }

    const videoJobSweeper = container.resolve<VideoJobSweeper | null>('videoJobSweeper');
    if (videoJobSweeper) {
      videoJobSweeper.start();
      logger.info('✅ Video job sweeper started');
    }

    const videoJobWorker = container.resolve<VideoJobWorker | null>('videoJobWorker');
    const workerDisabled = runtimeFlags.videoWorkerDisabled;
    if (videoJobWorker && !workerDisabled) {
      videoJobWorker.start();
      logger.info('✅ Video job worker started');
    } else if (videoJobWorker && workerDisabled) {
      logger.warn('Video job worker disabled via VIDEO_JOB_WORKER_DISABLED');
    }
  } else if (promptOutputOnly) {
    logger.info('ℹ️ Video background services skipped (PROMPT_OUTPUT_ONLY)');
  }

  return container;
}
