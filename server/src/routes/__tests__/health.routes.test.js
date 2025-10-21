import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createHealthRoutes } from '../health.routes.js';

describe('health.routes', () => {
  function buildApp({ cacheHealthy = true, claudeHealthy = true } = {}) {
    const app = express();
    const claudeClient = {
      healthCheck: async () => (claudeHealthy ? { healthy: true } : { healthy: false }),
      getStats: () => ({ state: 'CLOSED', stats: {} }),
    };
    const cacheService = {
      isHealthy: () => (cacheHealthy ? { healthy: true, stats: {} } : { healthy: false }),
      getCacheStats: () => ({})
    };
    const metricsService = { register: { contentType: 'text/plain' }, getMetrics: async () => '# HELP' };
    app.use('/', createHealthRoutes({ claudeClient, cacheService, metricsService }));
    return app;
  }

  it('GET /health returns 200 and status healthy', async () => {
    const app = buildApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
  });

  it('GET /health/live returns 200 and alive', async () => {
    const app = buildApp();
    const res = await request(app).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('alive');
  });

  it('GET /health/ready returns 200 when dependencies healthy', async () => {
    const app = buildApp({ cacheHealthy: true, claudeHealthy: true });
    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
  });

  it('GET /health/ready returns 503 when dependency unhealthy', async () => {
    const app = buildApp({ cacheHealthy: false, claudeHealthy: true });
    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('not ready');
  });
});

