import express, { type Router } from 'express';
import { asyncHandler } from '@middleware/asyncHandler';
import { metricsAuthMiddleware } from '@middleware/metricsAuth';
import { logger } from '@infrastructure/Logger';

interface HealthDependencies {
  claudeClient?: { getStats: () => { state: string } } | null;
  groqClient?: { getStats: () => { state: string } } | null;
  geminiClient?: { getStats: () => { state: string } } | null;
  cacheService: {
    isHealthy: () => boolean;
    getCacheStats: () => unknown;
  };
  metricsService: {
    register: { contentType: string };
    getMetrics: () => Promise<string>;
  };
  /** Optional Firestore connectivity check. Skipped when not provided (e.g. tests). */
  checkFirestore?: () => Promise<void>;
}

/**
 * Create health check routes
 * @param {Object} dependencies - Service dependencies
 * @returns {Router} Express router
 */
export function createHealthRoutes(dependencies: HealthDependencies): Router {
  const router = express.Router();
  const { claudeClient, groqClient, geminiClient, cacheService, metricsService, checkFirestore } = dependencies;

  // GET /health - Basic health check
  router.get('/health', (req, res) => {
    const requestId = req.id;
    logger.debug('Health check request', {
      operation: 'health',
      requestId,
    });
    
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
      const startTime = performance.now();
      const operation = 'healthReady';
      const requestId = req.id;
      
      logger.debug('Starting operation.', {
        operation,
        requestId,
      });
      
      // Use lightweight internal indicators where possible (cache, circuit breakers).
      // Firestore is the exception: it has no local state, so a metadata-only call
      // with a tight timeout verifies connectivity without reading documents.
      const cacheHealth = cacheService.isHealthy();
      const claudeStats = claudeClient?.getStats();
      const groqStats = groqClient?.getStats();
      const geminiStats = geminiClient?.getStats();

      let firestoreHealthy = true;
      let firestoreMessage: string | undefined;
      if (checkFirestore) {
        try {
          await Promise.race([
            checkFirestore(),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
          ]);
        } catch (err) {
          firestoreHealthy = false;
          firestoreMessage = err instanceof Error ? err.message : 'unknown error';
        }
      }

      const checks = {
        cache: { healthy: cacheHealth },
        firestore: checkFirestore
          ? (firestoreHealthy ? { healthy: true } : { healthy: false, message: `Firestore unreachable: ${firestoreMessage}` })
          : { healthy: true, enabled: false, message: 'Firestore check not configured' },
        openAI: claudeStats ? {
          healthy: claudeStats.state === 'CLOSED',
          circuitBreakerState: claudeStats.state,
          enabled: true,
        } : {
          healthy: true,
          enabled: false,
          message: 'OpenAI API not configured',
        },
        groq: groqStats ? {
          healthy: groqStats.state === 'CLOSED',
          circuitBreakerState: groqStats.state,
          enabled: true,
        } : {
          healthy: true, // Not required, so consider it healthy
          enabled: false,
          message: 'Groq API not configured (two-stage optimization disabled)',
        },
        gemini: geminiStats ? {
          healthy: geminiStats.state === 'CLOSED',
          circuitBreakerState: geminiStats.state,
          enabled: true,
        } : {
          healthy: true,
          enabled: false,
          message: 'Gemini API not configured',
        },
      };

      const allHealthy = Object.values(checks).every(
        (c) => c.healthy !== false
      );

      logger.info('Operation completed.', {
        operation,
        requestId,
        duration: Math.round(performance.now() - startTime),
        status: allHealthy ? 'ready' : 'not ready',
        checks,
      });

      res.status(allHealthy ? 200 : 503).json({
        status: allHealthy ? 'ready' : 'not ready',
        timestamp: new Date().toISOString(),
        checks,
      });
    })
  );

  // GET /health/live - Liveness check (always returns OK if server is running)
  router.get('/health/live', (req, res) => {
    const requestId = req.id;
    logger.debug('Liveness check request', {
      operation: 'healthLive',
      requestId,
    });
    
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
      const requestId = req.id;
      logger.debug('Metrics request', {
        operation: 'metrics',
        requestId,
      });
      
      res.set('Content-Type', metricsService.register.contentType);
      const metrics = await metricsService.getMetrics();
      res.end(metrics);
    })
  );

  // GET /stats - Application statistics (JSON format, protected)
  router.get('/stats', metricsAuthMiddleware, (req, res) => {
    const startTime = performance.now();
    const operation = 'stats';
    const requestId = req.id;
    
    logger.debug('Starting operation.', {
      operation,
      requestId,
    });
    
    const cacheStats = cacheService.getCacheStats();
    const claudeStats = claudeClient?.getStats();
    const groqStats = groqClient ? groqClient.getStats() : null;
    const geminiStats = geminiClient ? geminiClient.getStats() : null;

    logger.info('Operation completed.', {
      operation,
      requestId,
      duration: Math.round(performance.now() - startTime),
    });

    res.json({
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      cache: cacheStats,
      apis: {
        openAI: claudeStats || { message: 'OpenAI API not configured' },
        groq: groqStats || { message: 'Groq API not configured' },
        gemini: geminiStats || { message: 'Gemini API not configured' },
      },
      twoStageOptimization: {
        enabled: !!groqClient,
        status: groqStats ? (groqStats.state === 'CLOSED' ? 'operational' : 'degraded') : 'disabled',
      },
      memory: process.memoryUsage(),
      nodeVersion: process.version,
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    router.get('/debug-sentry', (_req, _res) => {
      throw new Error('My first Sentry error!');
    });
  }

  return router;
}
