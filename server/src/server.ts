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
import { logger } from './infrastructure/Logger.ts';
import { closeRedisClient } from './config/redis.ts';
import type { DIContainer } from './infrastructure/DIContainer.ts';

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
  const config = container.resolve('config');
  const PORT = config.server.port;

  return new Promise((resolve, reject) => {
    try {
      const server = app.listen(PORT, () => {
        logger.info('Server started successfully', {
          port: PORT,
          environment: config.server.environment,
          nodeVersion: process.version,
        });

        console.log(`🚀 Proxy server running on http://localhost:${PORT}`);
        console.log(`📊 Metrics available at http://localhost:${PORT}/metrics`);
        console.log(`💚 Health check at http://localhost:${PORT}/health`);

        resolve(server);
      });

      // Configure server timeouts
      server.keepAliveTimeout = 65000; // 65 seconds (> ALB idle timeout)
      server.headersTimeout = 66000;   // 66 seconds (> keepAliveTimeout)

      // Handle server errors
      server.on('error', (error) => {
        logger.error('Server error', error);
        reject(error);
      });

    } catch (error: any) {
      logger.error('Failed to start server', error);
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
  const shutdown = async (signal: string) => {
    logger.info(`${signal} signal received: closing HTTP server`);

    // Stop accepting new connections
    server.close(async () => {
      logger.info('HTTP server closed');

      try {
        // Close Redis connection
        const redisClient = container.resolve('redisClient');
        await closeRedisClient(redisClient);

        // Stop cache cleanup interval
        const spanLabelingCacheService = container.resolve('spanLabelingCacheService');
        if (spanLabelingCacheService && spanLabelingCacheService.stopPeriodicCleanup) {
          spanLabelingCacheService.stopPeriodicCleanup();
        }

        logger.info('All resources cleaned up successfully');
        process.exit(0);
      } catch (error: any) {
        logger.error('Error during graceful shutdown', error);
        process.exit(1);
      }
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
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
    logger.error('Unhandled rejection', { reason, promise });
    shutdown('UNHANDLED_REJECTION');
  });
}
