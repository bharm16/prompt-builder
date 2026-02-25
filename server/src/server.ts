/**
 * Server Lifecycle Management
 *
 * Handles:
 * - Server startup
 * - Graceful shutdown
 * - Signal handling (SIGTERM, SIGINT)
 * - Resource cleanup
 */

import type { Application } from 'express';
import type { Server } from 'http';
import type Redis from 'ioredis';
import type { ServiceConfig } from './config/services.config.ts';
import { logger } from './infrastructure/Logger.ts';
import { closeRedisClient } from './config/redis.ts';
import type { DIContainer } from './infrastructure/DIContainer.ts';
import type { SpanLabelingCacheService } from './services/cache/SpanLabelingCacheService.ts';
import type { CapabilitiesProbeService } from './services/capabilities/CapabilitiesProbeService.ts';
import type { CreditRefundSweeper } from './services/credits/CreditRefundSweeper.ts';
import type { VideoJobWorker } from './services/video-generation/jobs/VideoJobWorker.ts';
import type { VideoJobSweeper } from './services/video-generation/jobs/VideoJobSweeper.ts';
import type { VideoAssetRetentionService } from './services/video-generation/storage/VideoAssetRetentionService.ts';
import { getRuntimeFlags } from './config/runtime-flags.ts';

/**
 * Start the HTTP server
 *
 * @param {express.Application} app - Express app instance
 * @param {DIContainer} container - Dependency injection container
 * @returns {Promise<http.Server>} The HTTP server instance
 */
export async function startServer(
  app: Application,
  container: DIContainer
): Promise<Server> {
  const config = container.resolve<ServiceConfig>('config');
  const PORT = config.server.port;

  return new Promise((resolve, reject) => {
    try {
      const server = app.listen(PORT, () => {
        logger.info('Server started successfully', {
          port: PORT,
          environment: config.server.environment,
          nodeVersion: process.version,
          proxyUrl: `http://localhost:${PORT}`,
          metricsPath: '/metrics',
          healthPath: '/health',
        });

        resolve(server);
      });

      // Configure server timeouts
      server.keepAliveTimeout = 125000; // 125 seconds
      server.headersTimeout = 126000;   // 126 seconds
      server.timeout = 120000;          // 120 seconds (2 minutes)

      // Handle server errors
      server.on('error', (error) => {
        logger.error('Server error', error);
        reject(error);
      });

    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to start server', errorObj);
      reject(error);
    }
  });
}

/**
 * Setup graceful shutdown handlers
 *
 * @param {http.Server} server - HTTP server instance
 * @param {DIContainer} container - Dependency injection container
 */
export function setupGracefulShutdown(server: Server, container: DIContainer): void {
  const resolveOptional = <T>(serviceName: string): T | null => {
    try {
      return container.resolve<T>(serviceName);
    } catch {
      return null;
    }
  };

  const shutdown = async (signal: string) => {
    logger.info('Signal received; closing HTTP server.', { signal });
    const { videoWorkerShutdownDrainSeconds } = getRuntimeFlags();
    const drainTimeoutMs = Math.max(1_000, videoWorkerShutdownDrainSeconds * 1000);

    // Stop accepting new connections
    server.close(async () => {
      logger.info('HTTP server closed');

      try {
        // Stop periodic loops first to prevent new claims/retries during shutdown
        const videoJobSweeper = resolveOptional<VideoJobSweeper | null>('videoJobSweeper');
        videoJobSweeper?.stop();

        const creditRefundSweeper = resolveOptional<CreditRefundSweeper | null>('creditRefundSweeper');
        creditRefundSweeper?.stop();

        const videoAssetRetentionService =
          resolveOptional<VideoAssetRetentionService | null>('videoAssetRetentionService');
        videoAssetRetentionService?.stop();

        const capabilitiesProbe = resolveOptional<CapabilitiesProbeService | null>('capabilitiesProbeService');
        capabilitiesProbe?.stop();

        // Drain active worker jobs with a deadline, then release claims for fast reclaim.
        const videoJobWorker = resolveOptional<VideoJobWorker | null>('videoJobWorker');
        if (videoJobWorker) {
          await videoJobWorker.shutdown(drainTimeoutMs);
        }

        // Close Redis connection
        const redisClient = container.resolve<Redis | null>('redisClient');
        await closeRedisClient(redisClient);

        // Stop cache cleanup interval
        const spanLabelingCacheService =
          container.resolve<SpanLabelingCacheService | null>('spanLabelingCacheService');
        if (spanLabelingCacheService && spanLabelingCacheService.stopPeriodicCleanup) {
          spanLabelingCacheService.stopPeriodicCleanup();
        }

        logger.info('All resources cleaned up successfully');
        process.exit(0);
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        logger.error('Error during graceful shutdown', errorObj);
        process.exit(1);
      }
    });

    const forceShutdownMs = Math.max(30_000, drainTimeoutMs + 15_000);

    // Force shutdown after drain budget + safety margin
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, forceShutdownMs);
  };

  // Handle shutdown signals
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', error);
    shutdown('UNCAUGHT_EXCEPTION');
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection', undefined, { reason, promise });
    shutdown('UNHANDLED_REJECTION');
  });
}
