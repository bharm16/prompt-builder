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
  const { claudeClient, cacheService, metricsService } = dependencies;

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
      const checks = {
        cache: cacheService.isHealthy(),
        claudeAPI: await claudeClient.healthCheck(),
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

    res.json({
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      cache: cacheStats,
      circuitBreaker: claudeStats,
      memory: process.memoryUsage(),
      nodeVersion: process.version,
    });
  });

  return router;
}
