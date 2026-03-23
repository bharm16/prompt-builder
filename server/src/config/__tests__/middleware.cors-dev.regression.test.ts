import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';

import { applyCorsMiddleware } from '../middleware.config';

describe('regression: dev cors keeps localhost access when ALLOWED_ORIGINS is configured', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAllowedOrigins = process.env.ALLOWED_ORIGINS;
  const originalFrontendUrl = process.env.FRONTEND_URL;

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }

    if (originalAllowedOrigins === undefined) {
      delete process.env.ALLOWED_ORIGINS;
    } else {
      process.env.ALLOWED_ORIGINS = originalAllowedOrigins;
    }

    if (originalFrontendUrl === undefined) {
      delete process.env.FRONTEND_URL;
    } else {
      process.env.FRONTEND_URL = originalFrontendUrl;
    }
  });

  it('allows localhost:5173 by exact match in development even when ALLOWED_ORIGINS is set', async () => {
    process.env.NODE_ENV = 'development';
    process.env.ALLOWED_ORIGINS = 'https://yourdomain.com,https://www.yourdomain.com';
    process.env.FRONTEND_URL = 'http://localhost:4173';

    const app = express();
    applyCorsMiddleware(app);
    app.get('/api/test', (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const response = await request(app)
      .get('/api/test')
      .set('Origin', 'http://localhost:5173');

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('does not allow lookalike localhost origins in development', async () => {
    process.env.NODE_ENV = 'development';
    process.env.ALLOWED_ORIGINS = 'https://yourdomain.com';
    process.env.FRONTEND_URL = 'http://localhost:4173';

    const app = express();
    applyCorsMiddleware(app);
    app.get('/api/test', (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const response = await request(app)
      .get('/api/test')
      .set('Origin', 'http://localhost:5173.evil.com');

    expect(response.status).toBe(500);
    expect(response.text).toContain('Not allowed by CORS');
  });
});
