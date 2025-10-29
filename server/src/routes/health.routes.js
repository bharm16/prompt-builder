import express from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { metricsAuthMiddleware } from '../middleware/metricsAuth.js';

/**
 * Create health check routes
 * @param {Object} dependencies - Service dependencies
 * @returns {Router} Express router
 */
export function createHealthRoutes(dependencies) {
  const router = express.Router();
  const { claudeClient, groqClient, cacheService, metricsService } = dependencies;

  // GET /health - Basic health check
  router.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // GET /health/ready - Readiness check (checks dependencies)
  router.get(
    '/health/ready',
    asyncHandler(async (req, res) => {
      // Avoid external network calls on readiness to prevent abuse/DoS
      // Use internal indicators only (cache health and circuit breaker state)
      const cacheHealth = cacheService.isHealthy();
      const claudeStats = claudeClient.getStats();
      const groqStats = groqClient ? groqClient.getStats() : null;

      const checks = {
        cache: cacheHealth,
        openAI: {
          healthy: claudeStats.state === 'CLOSED',
          circuitBreakerState: claudeStats.state,
        },
        groq: groqClient ? {
          healthy: groqStats.state === 'CLOSED',
          circuitBreakerState: groqStats.state,
          enabled: true,
        } : {
          healthy: true, // Not required, so consider it healthy
          enabled: false,
          message: 'Groq API not configured (two-stage optimization disabled)',
        },
      };

      const allHealthy = Object.values(checks).every(
        (c) => c.healthy !== false
      );

      res.status(allHealthy ? 200 : 503).json({
        status: allHealthy ? 'ready' : 'not ready',
        timestamp: new Date().toISOString(),
        checks,
      });
    })
  );

  // GET /health/live - Liveness check (always returns OK if server is running)
  router.get('/health/live', (req, res) => {
    res.json({
      status: 'alive',
      timestamp: new Date().toISOString(),
    });
  });

  // GET /metrics - Prometheus metrics endpoint (protected)
  router.get(
    '/metrics',
    metricsAuthMiddleware,
    asyncHandler(async (req, res) => {
      res.set('Content-Type', metricsService.register.contentType);
      const metrics = await metricsService.getMetrics();
      res.end(metrics);
    })
  );

  // GET /stats - Application statistics (JSON format, protected)
  router.get('/stats', metricsAuthMiddleware, (req, res) => {
    const cacheStats = cacheService.getCacheStats();
    const claudeStats = claudeClient.getStats();
    const groqStats = groqClient ? groqClient.getStats() : null;

    res.json({
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      cache: cacheStats,
      apis: {
        openAI: claudeStats,
        groq: groqStats || { message: 'Groq API not configured' },
      },
      twoStageOptimization: {
        enabled: !!groqClient,
        status: groqClient ? (groqStats.state === 'CLOSED' ? 'operational' : 'degraded') : 'disabled',
      },
      memory: process.memoryUsage(),
      nodeVersion: process.version,
    });
  });

  // Test endpoint for Sentry error tracking
  router.get('/debug-sentry', (req, res) => {
    throw new Error('My first Sentry error!');
  });

  return router;
}
