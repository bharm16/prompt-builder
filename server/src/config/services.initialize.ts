import type { DIContainer } from '@infrastructure/DIContainer';
import { logger } from '@infrastructure/Logger';
import { admin, getFirestore } from '@infrastructure/firebaseAdmin';
import type { Bucket } from '@google-cloud/storage';
import type { LLMClient } from '@clients/LLMClient';
import { warmupGliner } from '@llm/span-labeling/nlp/NlpSpanService';
import { warmupDepthEstimationOnStartup, setDepthEstimationModuleConfig } from '@services/convergence/depth';
import type { ServiceConfig } from './services/service-config.types.ts';
import type { VideoJobWorker } from '@services/video-generation/jobs/VideoJobWorker';
import type { VideoJobSweeper } from '@services/video-generation/jobs/VideoJobSweeper';
import type { VideoAssetRetentionService } from '@services/video-generation/storage/VideoAssetRetentionService';
import type { CapabilitiesProbeService } from '@services/capabilities/CapabilitiesProbeService';
import type { CreditRefundSweeper } from '@services/credits/CreditRefundSweeper';
import type { CreditReconciliationWorker } from '@services/credits/CreditReconciliationWorker';
import type { DlqReprocessorWorker } from '@services/video-generation/jobs/DlqReprocessorWorker';
import { getRuntimeFlags } from './runtime-flags';

interface HealthCheckResult {
  healthy: boolean;
  error?: string;
  responseTime?: number;
}

interface LLMClientValidationConfig {
  client: LLMClient;
  serviceName: string;
  successMessage: string;
  unhealthyMessage: string;
  failureMessage: string;
  allowUnhealthy?: boolean;
  disableUnhealthyMessage?: string;
  keepUnhealthyMessage?: string;
}

async function validateLLMClient(
  container: DIContainer,
  config: LLMClientValidationConfig
): Promise<void> {
  try {
    const health = (await config.client.healthCheck()) as HealthCheckResult;

    if (!health.healthy) {
      logger.warn(config.unhealthyMessage, {
        error: health.error,
      });

      if (!config.allowUnhealthy) {
        if (config.disableUnhealthyMessage) {
          logger.warn(config.disableUnhealthyMessage);
        }
        container.registerValue(config.serviceName, null);
      } else if (config.keepUnhealthyMessage) {
        logger.warn(config.keepUnhealthyMessage);
      }

      return;
    }

    logger.info(config.successMessage, {
      responseTime: health.responseTime,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.warn(config.failureMessage, {
      error: errorMessage,
    });

    if (!config.allowUnhealthy) {
      if (config.disableUnhealthyMessage) {
        logger.warn(config.disableUnhealthyMessage);
      }
      container.registerValue(config.serviceName, null);
    } else if (config.keepUnhealthyMessage) {
      logger.warn(config.keepUnhealthyMessage);
    }
  }
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

    await validateLLMClient(container, {
      client: claudeClient,
      serviceName: 'claudeClient',
      successMessage: '✅ OpenAI API key validated successfully',
      unhealthyMessage: '⚠️  OpenAI API key validation failed - OpenAI adapter disabled',
      failureMessage: '⚠️  Failed to validate OpenAI API key - OpenAI adapter disabled',
    });
  } else {
    logger.warn('OpenAI client not configured; relying on other providers');
  }

  // Resolve and validate Groq client (OPTIONAL)
  const groqClient = container.resolve<LLMClient | null>('groqClient');
  if (groqClient) {
    logger.info('Groq client initialized for two-stage optimization');

    await validateLLMClient(container, {
      client: groqClient,
      serviceName: 'groqClient',
      successMessage: '✅ Groq API key validated successfully',
      unhealthyMessage: '⚠️  Groq API key validation failed - two-stage optimization disabled',
      failureMessage: '⚠️  Failed to validate Groq API key - two-stage optimization disabled',
    });
  }

  // Resolve and validate Qwen client (OPTIONAL)
  const qwenClient = container.resolve<LLMClient | null>('qwenClient');
  if (qwenClient) {
    logger.info('Qwen client initialized for adapter-based routing');

    await validateLLMClient(container, {
      client: qwenClient,
      serviceName: 'qwenClient',
      successMessage: '✅ Qwen API key validated successfully',
      unhealthyMessage: '⚠️  Qwen API key validation failed - adapter disabled',
      failureMessage: '⚠️  Failed to validate Qwen API key - adapter disabled',
    });
  }

  // Resolve and validate Gemini client (OPTIONAL)
  const geminiClient = container.resolve<LLMClient | null>('geminiClient');
  if (geminiClient) {
    logger.info('Gemini client initialized for adapter-based routing');
    const allowUnhealthyGemini = runtimeFlags.allowUnhealthyGemini;

    await validateLLMClient(container, {
      client: geminiClient,
      serviceName: 'geminiClient',
      successMessage: '✅ Gemini API key validated successfully',
      unhealthyMessage: '⚠️  Gemini API key validation failed',
      failureMessage: '⚠️  Failed to validate Gemini API key',
      allowUnhealthy: allowUnhealthyGemini,
      disableUnhealthyMessage: '⚠️  Gemini adapter disabled (health check failed)',
      keepUnhealthyMessage: 'Keeping Gemini adapter enabled despite failed health check',
    });
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
    runtimeFlags.processRole === 'api' &&
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
    const reason = promptOutputOnly
      ? 'PROMPT_OUTPUT_ONLY'
      : runtimeFlags.processRole !== 'api'
        ? `PROCESS_ROLE=${runtimeFlags.processRole}`
        : 'prewarm disabled or GLiNER disabled';
    logger.info('ℹ️ GLiNER warmup skipped', { reason });
  }

  // Configure depth estimation module before warmup
  const config = container.resolve<ServiceConfig>('config');
  const depthConfig = config.convergence.depth;
  setDepthEstimationModuleConfig({
    warmupRetryTimeoutMs: depthConfig.warmupRetryTimeoutMs,
    falWarmupEnabled: depthConfig.falWarmupEnabled,
    falWarmupIntervalMs: depthConfig.falWarmupIntervalMs,
    falWarmupImageUrl: depthConfig.falWarmupImageUrl || 'https://storage.googleapis.com/generativeai-downloads/images/cat.jpg',
    warmupOnStartup: depthConfig.warmupOnStartup,
    warmupTimeoutMs: depthConfig.warmupTimeoutMs,
    promptOutputOnly: config.features.promptOutputOnly,
  });

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

  if (!isTestEnv && !promptOutputOnly && runtimeFlags.processRole === 'api') {
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
    const reason = promptOutputOnly
      ? 'PROMPT_OUTPUT_ONLY'
      : runtimeFlags.processRole !== 'api'
        ? `PROCESS_ROLE=${runtimeFlags.processRole}`
        : 'test environment';
    logger.info('ℹ️ Depth warmup skipped', { reason });
  }

  const isWorkerRole = runtimeFlags.processRole === 'worker';

  if (!isTestEnv && !promptOutputOnly && isWorkerRole) {
    const creditRefundSweeper = container.resolve<CreditRefundSweeper | null>('creditRefundSweeper');
    if (creditRefundSweeper) {
      creditRefundSweeper.start();
      logger.info('✅ Credit refund sweeper started');
    }

    const creditReconciliationWorker =
      container.resolve<CreditReconciliationWorker | null>('creditReconciliationWorker');
    if (creditReconciliationWorker) {
      creditReconciliationWorker.start();
      logger.info('✅ Credit reconciliation worker started');
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

    const dlqReprocessorWorker = container.resolve<DlqReprocessorWorker | null>('dlqReprocessorWorker');
    if (dlqReprocessorWorker) {
      dlqReprocessorWorker.start();
      logger.info('✅ DLQ reprocessor worker started');
    }
  } else if (!isTestEnv && !promptOutputOnly && !isWorkerRole) {
    logger.info('ℹ️ Video background services skipped (PROCESS_ROLE=api)');
  } else if (promptOutputOnly) {
    logger.info('ℹ️ Video background services skipped (PROMPT_OUTPUT_ONLY)');
  }

  return container;
}
