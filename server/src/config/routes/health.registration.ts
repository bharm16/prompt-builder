/**
 * Health Route Registration
 *
 * Registers health/readiness endpoints and OpenAPI dev routes.
 * No auth required.
 */

import type { Application } from 'express';
import type { DIContainer } from '@infrastructure/DIContainer';
import { logger } from '@infrastructure/Logger';
import { getFirestore } from '@infrastructure/firebaseAdmin';
import { getRedisStatus } from '@config/redis';
import { createHealthRoutes } from '@routes/health.routes';
import { createOpenApiDevRoute } from '../../openapi/devRoute.ts';
import type { VideoWorkerHeartbeatStore } from '@services/video-generation/jobs/VideoWorkerHeartbeatStore';
import type { FirestoreCircuitExecutor } from '@services/firestore/FirestoreCircuitExecutor';
import { resolveOptionalService } from './resolve-utils.ts';
import type { RuntimeFlags } from '../runtime-flags';

export function registerHealthRoutes(
  app: Application,
  container: DIContainer,
  runtimeFlags: RuntimeFlags,
): void {
  const { promptOutputOnly } = runtimeFlags;
  const firestoreCircuitExecutor = container.resolve('firestoreCircuitExecutor');

  // Resolve video worker heartbeat for health checks
  const videoWorkerHeartbeatStore = promptOutputOnly
    ? null
    : resolveOptionalService<VideoWorkerHeartbeatStore | null>(
        container,
        'videoWorkerHeartbeatStore',
        'health-video-workers'
      );
  const videoWorkerHeartbeatMaxAgeMs = Number.parseInt(
    process.env.VIDEO_WORKER_HEARTBEAT_MAX_AGE_MS || '',
    10
  );
  const resolvedVideoWorkerHeartbeatMaxAgeMs =
    Number.isFinite(videoWorkerHeartbeatMaxAgeMs) && videoWorkerHeartbeatMaxAgeMs > 0
      ? videoWorkerHeartbeatMaxAgeMs
      : 90_000;
  const checkVideoExecutionPath =
    !promptOutputOnly && !runtimeFlags.videoJobInlineEnabled
      ? async () => {
          if (!videoWorkerHeartbeatStore) {
            return {
              healthy: false,
              message: 'Video worker heartbeat store is unavailable',
            };
          }
          const summary = await videoWorkerHeartbeatStore.getActiveWorkerSummary(
            resolvedVideoWorkerHeartbeatMaxAgeMs
          );
          if (summary.activeWorkerCount === 0) {
            return {
              healthy: false,
              message: 'No active video worker heartbeats detected while inline processing is disabled',
              activeWorkerCount: 0,
              heartbeatMaxAgeMs: resolvedVideoWorkerHeartbeatMaxAgeMs,
            };
          }
          return {
            healthy: true,
            activeWorkerCount: summary.activeWorkerCount,
            heartbeatMaxAgeMs: resolvedVideoWorkerHeartbeatMaxAgeMs,
          };
        }
      : null;

  // Resolve worker instances for health status reporting
  type StatusProvider = { getStatus(): { running: boolean; lastRunAt: Date | null; consecutiveFailures: number } };
  const workerEntries: [string, StatusProvider | null][] = [
    ['creditRefundSweeper', resolveOptionalService<StatusProvider | null>(container, 'creditRefundSweeper', 'health-workers')],
    ['videoJobWorker', resolveOptionalService<StatusProvider | null>(container, 'videoJobWorker', 'health-workers')],
    ['dlqReprocessorWorker', resolveOptionalService<StatusProvider | null>(container, 'dlqReprocessorWorker', 'health-workers')],
    ['webhookReconciliationWorker', resolveOptionalService<StatusProvider | null>(container, 'webhookReconciliationWorker', 'health-workers')],
    ['billingProfileRepairWorker', resolveOptionalService<StatusProvider | null>(container, 'billingProfileRepairWorker', 'health-workers')],
  ];
  const workers: Record<string, StatusProvider> = {};
  for (const [name, provider] of workerEntries) {
    if (provider) workers[name] = provider;
  }

  const healthRoutes = createHealthRoutes({
    claudeClient: container.resolve('claudeClient'),
    groqClient: container.resolve('groqClient'),
    geminiClient: container.resolve('geminiClient'),
    cacheService: container.resolve('cacheService'),
    metricsService: container.resolve('metricsService'),
    firestoreCircuitExecutor,
    checkFirestore: async () => {
      await firestoreCircuitExecutor.executeRead('health.ready.firestoreProbe', async () => {
        await getFirestore().listCollections();
      });
    },
    ...(checkVideoExecutionPath ? { checkVideoExecutionPath } : {}),
    workers,
    getRedisStatus,
  });

  app.use('/', healthRoutes);

  // OpenAPI spec (dev only — returns null in production, not mounted)
  const openApiRoute = createOpenApiDevRoute();
  if (openApiRoute) {
    app.use('/api-docs', openApiRoute);
  }

  logger.debug('Health routes registered');
}
