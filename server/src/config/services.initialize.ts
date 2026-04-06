import type { DIContainer } from "@infrastructure/DIContainer";
import { logger } from "@infrastructure/Logger";
import { getAuth, getFirestore } from "@infrastructure/firebaseAdmin";
import type { Bucket } from "@google-cloud/storage";
import type { LLMClient } from "@clients/LLMClient";
import type { ServiceConfig } from "./services/service-config.types.ts";
import type { CapabilitiesProbeService } from "@services/capabilities/CapabilitiesProbeService";
import { getRuntimeFlags } from "./runtime-flags";

// ────────────────────────────────────────────────────────────────
// Shared helpers
// ────────────────────────────────────────────────────────────────

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
  config: LLMClientValidationConfig,
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

export const STARTUP_CHECK_TIMEOUT_MS = 20_000;

function withTimeout<T>(label: string, fn: () => Promise<T>): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<never>((_, reject) => {
      const timer = setTimeout(
        () =>
          reject(
            new Error(
              `Infrastructure check '${label}' timed out after ${STARTUP_CHECK_TIMEOUT_MS}ms`,
            ),
          ),
        STARTUP_CHECK_TIMEOUT_MS,
      );
      timer.unref();
    }),
  ]);
}

// ────────────────────────────────────────────────────────────────
// Phase 1: Common initialization (both roles)
// ────────────────────────────────────────────────────────────────

async function initializeCommon(container: DIContainer): Promise<void> {
  const isTestEnv =
    process.env.NODE_ENV === "test" ||
    process.env.VITEST ||
    process.env.VITEST_WORKER_ID;
  const runtimeFlags = getRuntimeFlags();

  // Infrastructure startup checks (skip in test) — run in parallel
  if (!isTestEnv) {
    try {
      await Promise.all([
        withTimeout("firebase-auth", async () => {
          const auth = getAuth();
          await auth.listUsers(1);
        }),
        withTimeout("firestore", async () => {
          const firestore = getFirestore();
          await firestore.listCollections();
        }),
        withTimeout("gcs-bucket", async () => {
          const bucket = container.resolve<Bucket>("gcsBucket");
          const [exists] = await bucket.exists();
          if (!exists) {
            throw new Error(
              `Configured GCS bucket does not exist: ${bucket.name}`,
            );
          }
        }),
      ]);

      logger.info("✅ Infrastructure startup checks passed", {
        checks: ["firebase-auth", "firestore", "gcs-bucket"],
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Infrastructure startup checks failed", error as Error, {
        error: errorMessage,
      });
      throw new Error(`Infrastructure startup checks failed: ${errorMessage}`);
    }
  }

  // Validate LLM clients — run in parallel
  const openAIClient = container.resolve<LLMClient | null>("openAIClient");
  const groqClient = container.resolve<LLMClient | null>("groqClient");
  const qwenClient = container.resolve<LLMClient | null>("qwenClient");
  const geminiClient = container.resolve<LLMClient | null>("geminiClient");

  const llmValidations: Promise<void>[] = [];

  if (openAIClient) {
    logger.info("Validating OpenAI API key...");
    llmValidations.push(
      validateLLMClient(container, {
        client: openAIClient,
        serviceName: "openAIClient",
        successMessage: "✅ OpenAI API key validated successfully",
        unhealthyMessage:
          "⚠️  OpenAI API key validation failed - OpenAI adapter disabled",
        failureMessage:
          "⚠️  Failed to validate OpenAI API key - OpenAI adapter disabled",
      }),
    );
  } else {
    logger.warn("OpenAI client not configured; relying on other providers");
  }

  if (groqClient) {
    logger.info("Groq client initialized for adapter-based routing");
    llmValidations.push(
      validateLLMClient(container, {
        client: groqClient,
        serviceName: "groqClient",
        successMessage: "✅ Groq API key validated successfully",
        unhealthyMessage:
          "⚠️  Groq API key validation failed - Groq adapter disabled",
        failureMessage:
          "⚠️  Failed to validate Groq API key - Groq adapter disabled",
      }),
    );
  }

  if (qwenClient) {
    logger.info("Qwen client initialized for adapter-based routing");
    llmValidations.push(
      validateLLMClient(container, {
        client: qwenClient,
        serviceName: "qwenClient",
        successMessage: "✅ Qwen API key validated successfully",
        unhealthyMessage: "⚠️  Qwen API key validation failed - adapter disabled",
        failureMessage: "⚠️  Failed to validate Qwen API key - adapter disabled",
      }),
    );
  }

  if (geminiClient) {
    logger.info("Gemini client initialized for adapter-based routing");
    const allowUnhealthyGemini = runtimeFlags.allowUnhealthyGemini;
    llmValidations.push(
      validateLLMClient(container, {
        client: geminiClient,
        serviceName: "geminiClient",
        successMessage: "✅ Gemini API key validated successfully",
        unhealthyMessage: "⚠️  Gemini API key validation failed",
        failureMessage: "⚠️  Failed to validate Gemini API key",
        allowUnhealthy: allowUnhealthyGemini,
        disableUnhealthyMessage:
          "⚠️  Gemini adapter disabled (health check failed)",
        keepUnhealthyMessage:
          "Keeping Gemini adapter enabled despite failed health check",
      }),
    );
  }

  await Promise.all(llmValidations);

  // Pre-resolve critical services to catch configuration errors early
  const serviceNames = [
    "promptOptimizationService",
    "enhancementService",
    "sceneDetectionService",
    "promptCoherenceService",
    "videoConceptService",
    "spanLabelingCacheService",
  ];

  for (const serviceName of serviceNames) {
    try {
      container.resolve(serviceName);
      logger.info("Service initialized", { serviceName });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(
        "Service initialization failed",
        error instanceof Error ? error : new Error(String(error)),
        { serviceName },
      );
      throw new Error(
        `Service initialization failed for ${serviceName}: ${errorMessage}`,
      );
    }
  }

  // Pre-warm LLM provider connections in the background (non-blocking)
  const llmClientsToWarm = [
    openAIClient,
    groqClient,
    qwenClient,
    geminiClient,
  ].filter((c): c is LLMClient => c !== null);
  if (llmClientsToWarm.length > 0 && !isTestEnv) {
    Promise.allSettled(
      llmClientsToWarm.map((client) =>
        client.healthCheck().catch(() => {
          /* best-effort warmup */
        }),
      ),
    ).then((results) => {
      const warmed = results.filter((r) => r.status === "fulfilled").length;
      logger.info("LLM connection pre-warming complete", {
        warmed,
        total: llmClientsToWarm.length,
      });
    });
  }

  const capabilitiesProbe = container.resolve<CapabilitiesProbeService | null>(
    "capabilitiesProbeService",
  );
  if (capabilitiesProbe) {
    try {
      capabilitiesProbe.start();
    } catch (error) {
      logger.warn("Capabilities probe failed to start", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info("All services initialized and validated successfully");
}

// ────────────────────────────────────────────────────────────────
// Phase 2a: API-role initialization
// ────────────────────────────────────────────────────────────────

async function initializeApiServices(container: DIContainer): Promise<void> {
  const isTestEnv =
    process.env.NODE_ENV === "test" ||
    process.env.VITEST ||
    process.env.VITEST_WORKER_ID;
  const runtimeFlags = getRuntimeFlags();
  const { promptOutputOnly } = runtimeFlags;

  // GLiNER warmup (API role only)
  const { warmupGliner } = await import(
    "@llm/span-labeling/nlp/NlpSpanService"
  );
  const { NEURO_SYMBOLIC } = await import(
    "@llm/span-labeling/config/SpanLabelingConfig"
  );
  const shouldWarmGliner =
    !promptOutputOnly &&
    NEURO_SYMBOLIC.ENABLED &&
    NEURO_SYMBOLIC.GLINER?.ENABLED &&
    NEURO_SYMBOLIC.GLINER.PREWARM_ON_STARTUP;

  if (shouldWarmGliner) {
    try {
      const glinerResult = await warmupGliner();
      if (glinerResult.success) {
        logger.info("✅ GLiNER model warmed up for semantic extraction");
      } else {
        logger.warn("⚠️ GLiNER warmup skipped", {
          reason: glinerResult.message || "Unknown reason",
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.warn("⚠️ GLiNER warmup failed", { error: errorMessage });
    }
  } else {
    const reason = promptOutputOnly
      ? "PROMPT_OUTPUT_ONLY"
      : "prewarm disabled or GLiNER disabled";
    logger.info("ℹ️ GLiNER warmup skipped", { reason });
  }

  // Depth estimation warmup (API role only, non-blocking)
  const { warmupDepthEstimationOnStartup, setDepthEstimationModuleConfig } =
    await import("@services/convergence/depth");
  const config = container.resolve<ServiceConfig>("config");
  const depthConfig = config.convergence.depth;
  setDepthEstimationModuleConfig({
    warmupRetryTimeoutMs: depthConfig.warmupRetryTimeoutMs,
    falWarmupEnabled: depthConfig.falWarmupEnabled,
    falWarmupIntervalMs: depthConfig.falWarmupIntervalMs,
    falWarmupImageUrl:
      depthConfig.falWarmupImageUrl ||
      "https://storage.googleapis.com/generativeai-downloads/images/cat.jpg",
    warmupOnStartup: depthConfig.warmupOnStartup,
    warmupTimeoutMs: depthConfig.warmupTimeoutMs,
    promptOutputOnly: config.features.promptOutputOnly,
  });

  if (!isTestEnv && !promptOutputOnly) {
    warmupDepthEstimationOnStartup()
      .then((depthWarmup) => {
        if (depthWarmup.success) {
          logger.info("✅ Depth estimation warmed up", {
            provider: depthWarmup.provider,
            durationMs: depthWarmup.durationMs,
          });
        } else if (depthWarmup.skipped) {
          logger.info("ℹ️ Depth warmup skipped", {
            reason: depthWarmup.message || "Unknown reason",
          });
        } else {
          logger.warn("⚠️ Depth warmup failed", {
            provider: depthWarmup.provider,
            reason: depthWarmup.message || "Unknown reason",
          });
        }
      })
      .catch((error) => {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger.warn("⚠️ Depth warmup failed", { error: errorMessage });
      });
  } else {
    const reason = promptOutputOnly ? "PROMPT_OUTPUT_ONLY" : "test environment";
    logger.info("ℹ️ Depth warmup skipped", { reason });
  }
}

// ────────────────────────────────────────────────────────────────
// Phase 2b: Worker-role initialization
// ────────────────────────────────────────────────────────────────

async function initializeWorkerServices(container: DIContainer): Promise<void> {
  const runtimeFlags = getRuntimeFlags();
  const { promptOutputOnly } = runtimeFlags;

  // Depth estimation module config is needed by worker role too
  const { setDepthEstimationModuleConfig } = await import(
    "@services/convergence/depth"
  );
  const config = container.resolve<ServiceConfig>("config");
  const depthConfig = config.convergence.depth;
  setDepthEstimationModuleConfig({
    warmupRetryTimeoutMs: depthConfig.warmupRetryTimeoutMs,
    falWarmupEnabled: depthConfig.falWarmupEnabled,
    falWarmupIntervalMs: depthConfig.falWarmupIntervalMs,
    falWarmupImageUrl:
      depthConfig.falWarmupImageUrl ||
      "https://storage.googleapis.com/generativeai-downloads/images/cat.jpg",
    warmupOnStartup: depthConfig.warmupOnStartup,
    warmupTimeoutMs: depthConfig.warmupTimeoutMs,
    promptOutputOnly: config.features.promptOutputOnly,
  });

  if (promptOutputOnly) {
    logger.info("ℹ️ Video background services skipped (PROMPT_OUTPUT_ONLY)");
    return;
  }

  // Dynamic imports to keep worker-specific types lazy
  const { CreditRefundSweeper } = await import(
    "@services/credits/CreditRefundSweeper"
  );
  const { CreditReconciliationWorker } = await import(
    "@services/credits/CreditReconciliationWorker"
  );
  const { VideoAssetRetentionService } = await import(
    "@services/video-generation/storage/VideoAssetRetentionService"
  );
  const { VideoJobSweeper } = await import(
    "@services/video-generation/jobs/VideoJobSweeper"
  );
  const { VideoJobWorker } = await import(
    "@services/video-generation/jobs/VideoJobWorker"
  );
  const { DlqReprocessorWorker } = await import(
    "@services/video-generation/jobs/DlqReprocessorWorker"
  );
  const { VideoJobReconciler } = await import(
    "@services/video-generation/jobs/VideoJobReconciler"
  );
  const { ProviderCircuitManager } = await import(
    "@services/video-generation/jobs/ProviderCircuitManager"
  );
  const { WebhookReconciliationWorker } = await import(
    "@services/payment/WebhookReconciliationWorker"
  );
  const { BillingProfileRepairWorker } = await import(
    "@services/payment/BillingProfileRepairWorker"
  );

  // Suppress unused-variable lint — these imports are used for instanceof below
  void CreditRefundSweeper;
  void CreditReconciliationWorker;
  void VideoAssetRetentionService;
  void VideoJobSweeper;
  void VideoJobWorker;
  void DlqReprocessorWorker;
  void VideoJobReconciler;
  void ProviderCircuitManager;
  void WebhookReconciliationWorker;
  void BillingProfileRepairWorker;

  type Startable = { start(): void };

  const startIfResolved = (
    serviceName: string,
    label: string,
  ): Startable | null => {
    const service = container.resolve<Startable | null>(serviceName);
    if (service) {
      service.start();
      logger.info(`✅ ${label} started`);
    }
    return service;
  };

  startIfResolved("creditRefundSweeper", "Credit refund sweeper");
  startIfResolved("creditReconciliationWorker", "Credit reconciliation worker");
  startIfResolved(
    "videoAssetRetentionService",
    "Video asset retention service",
  );
  startIfResolved("videoJobSweeper", "Video job sweeper");

  const videoJobWorker = container.resolve<Startable | null>("videoJobWorker");
  const workerDisabled = runtimeFlags.videoWorkerDisabled;
  if (videoJobWorker && !workerDisabled) {
    videoJobWorker.start();
    logger.info("✅ Video job worker started");
  } else if (videoJobWorker && workerDisabled) {
    logger.warn("Video job worker disabled via VIDEO_JOB_WORKER_DISABLED");
  }

  const dlqReprocessorWorker = startIfResolved(
    "dlqReprocessorWorker",
    "DLQ reprocessor worker",
  ) as (Startable & { resetPollInterval(): void }) | null;
  startIfResolved("videoJobReconciler", "Video job reconciler");
  startIfResolved(
    "webhookReconciliationWorker",
    "Webhook reconciliation worker",
  );
  startIfResolved(
    "billingProfileRepairWorker",
    "Billing profile repair worker",
  );

  // Wire circuit breaker recovery to reset worker poll intervals
  const providerCircuitManager = container.resolve<{
    onRecovery(cb: (provider: string) => void): void;
  } | null>("providerCircuitManager");
  if (providerCircuitManager && (videoJobWorker || dlqReprocessorWorker)) {
    providerCircuitManager.onRecovery((provider) => {
      logger.info(
        "Provider circuit recovery detected, resetting worker poll intervals",
        { provider },
      );
      (
        videoJobWorker as Startable & { resetPollInterval?(): void }
      )?.resetPollInterval?.();
      dlqReprocessorWorker?.resetPollInterval();
    });
  }
}

// ────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────

/**
 * Initialize and validate all services.
 *
 * Runs common initialization first, then role-specific setup
 * based on the PROCESS_ROLE environment variable.
 */
export async function initializeServices(
  container: DIContainer,
): Promise<DIContainer> {
  logger.info("Initializing services...");
  const runtimeFlags = getRuntimeFlags();
  const isTestEnv =
    process.env.NODE_ENV === "test" ||
    process.env.VITEST ||
    process.env.VITEST_WORKER_ID;

  // Phase 1: common initialization (both roles)
  await initializeCommon(container);

  // Phase 2: role-specific initialization
  if (!isTestEnv) {
    if (runtimeFlags.processRole === "api") {
      await initializeApiServices(container);
    } else if (runtimeFlags.processRole === "worker") {
      await initializeWorkerServices(container);
    }
  } else {
    // In test, configure depth module but skip warmups and workers
    const { setDepthEstimationModuleConfig } = await import(
      "@services/convergence/depth"
    );
    const config = container.resolve<ServiceConfig>("config");
    const depthConfig = config.convergence.depth;
    setDepthEstimationModuleConfig({
      warmupRetryTimeoutMs: depthConfig.warmupRetryTimeoutMs,
      falWarmupEnabled: depthConfig.falWarmupEnabled,
      falWarmupIntervalMs: depthConfig.falWarmupIntervalMs,
      falWarmupImageUrl:
        depthConfig.falWarmupImageUrl ||
        "https://storage.googleapis.com/generativeai-downloads/images/cat.jpg",
      warmupOnStartup: depthConfig.warmupOnStartup,
      warmupTimeoutMs: depthConfig.warmupTimeoutMs,
      promptOutputOnly: config.features.promptOutputOnly,
    });
  }

  return container;
}
