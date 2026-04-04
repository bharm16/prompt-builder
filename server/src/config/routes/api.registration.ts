/**
 * Core API Route Registration
 *
 * Registers the main /api routes, LLM endpoints, role classification,
 * and suggestions evaluation. All routes require auth.
 */

import type { Application } from "express";
import type { DIContainer } from "@infrastructure/DIContainer";
import { apiAuthMiddleware } from "@middleware/apiAuth";
import { createBatchMiddleware } from "@middleware/requestBatching";
import { createRouteTimeout } from "@middleware/routeTimeout";
import { createAPIRoutes } from "@routes/api.routes";
import { createRoleClassifyRoute } from "@routes/roleClassifyRoute";
import { createLabelSpansRoute } from "@routes/labelSpansRoute";
import { createSuggestionsRoute } from "@routes/suggestions";
import { createMediaProxyRoutes } from "@routes/storage/mediaProxy.routes";
import type { StorageRoutesService } from "@routes/storage.routes";
import type { LLMJudgeService } from "@services/quality-feedback/services/LLMJudgeService";
import type { ContinuitySessionService } from "@services/continuity/ContinuitySessionService";
import type { ModelIntelligenceService } from "@services/model-intelligence/ModelIntelligenceService";
import type { VideoConceptServiceContract } from "@routes/video/types";
import type { ConsistentVideoService } from "@services/video-generation/ConsistentVideoService";
import type { UserCreditService } from "@services/credits/UserCreditService";
import { STORAGE_CONFIG } from "@services/storage/config/storageConfig";
import { resolveOptionalService } from "./resolve-utils.ts";
import type { RuntimeFlags } from "../runtime-flags";

export function registerApiRoutes(
  app: Application,
  container: DIContainer,
  runtimeFlags: RuntimeFlags,
): void {
  const { promptOutputOnly } = runtimeFlags;
  const userCreditService = container.resolve("userCreditService");

  const videoGenerationService = promptOutputOnly
    ? null
    : resolveOptionalService<unknown>(
        container,
        "videoGenerationService",
        "preview",
      );

  const continuitySessionService =
    resolveOptionalService<ContinuitySessionService | null>(
      container,
      "continuitySessionService",
      "continuity",
    );
  const modelIntelligenceService =
    resolveOptionalService<ModelIntelligenceService | null>(
      container,
      "modelIntelligenceService",
      "model-intelligence",
    );
  const consistentVideoService: ConsistentVideoService | null =
    promptOutputOnly || !videoGenerationService
      ? null
      : resolveOptionalService<ConsistentVideoService | null>(
          container,
          "consistentVideoService",
          "consistent-generation",
        );
  const videoConceptService: VideoConceptServiceContract | null =
    promptOutputOnly
      ? null
      : resolveOptionalService<VideoConceptServiceContract | null>(
          container,
          "videoConceptService",
          "video-concept",
        );

  // Media proxy — no auth required (signed URL is the authorization).
  // Must be registered before the auth middleware on /api.
  const mediaProxyRoutes = createMediaProxyRoutes(STORAGE_CONFIG.bucketName);
  app.use("/api/storage", mediaProxyRoutes);

  // Main API routes
  const apiRoutes = createAPIRoutes({
    promptOptimizationService: container.resolve("promptOptimizationService"),
    enhancementService: container.resolve("enhancementService"),
    sceneDetectionService: container.resolve("sceneDetectionService"),
    promptCoherenceService: container.resolve("promptCoherenceService"),
    storageService: container.resolve<StorageRoutesService>("storageService"),
    videoConceptService,
    assetService: container.resolve("assetService"),
    ...(consistentVideoService ? { consistentVideoService } : {}),
    userCreditService:
      container.resolve<UserCreditService>("userCreditService"),
    referenceImageService: container.resolve("referenceImageRepository"),
    imageObservationService: container.resolve("imageObservationService"),
    continuitySessionService,
    sessionService: container.resolve("sessionService"),
    modelIntelligenceService,
    modelIntelligenceMetrics: container.resolve("metricsService"),
  });

  app.use(
    "/api",
    apiAuthMiddleware,
    createRouteTimeout(30_000, {
      shouldApply: (req) => {
        const path = req.path;
        const isPreviewRoute =
          path === "/preview" || path.startsWith("/preview/");
        const isOptimizeRoute = path.startsWith("/optimize");
        return !(isPreviewRoute || isOptimizeRoute);
      },
    }),
    apiRoutes,
  );

  // LLM endpoints
  const labelSpansRoute = createLabelSpansRoute(
    container.resolve("aiService"),
    container.resolve("spanLabelingCacheService"),
  );
  app.use("/llm/label-spans", apiAuthMiddleware, labelSpansRoute);

  app.post(
    "/llm/label-spans-batch",
    apiAuthMiddleware,
    createBatchMiddleware(
      container.resolve("aiService"),
      container.resolve("metricsService"),
    ),
  );

  // Role classification
  const roleClassifyRoute = createRoleClassifyRoute(
    container.resolve("aiService"),
  );
  app.use("/api/role-classify", apiAuthMiddleware, roleClassifyRoute);

  // Suggestions evaluation (LLM-as-a-Judge)
  const suggestionsRoute = createSuggestionsRoute({
    llmJudgeService: container.resolve<LLMJudgeService>("llmJudgeService"),
  });
  app.use("/api/suggestions", apiAuthMiddleware, suggestionsRoute);
}
