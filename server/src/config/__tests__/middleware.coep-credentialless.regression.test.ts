import express from 'express';
import request from 'supertest';
import { describe, expect, it, afterEach } from 'vitest';

import { applySecurityMiddleware } from '../middleware.config';

/**
 * Regression: COEP must be set to 'credentialless', not 'require-corp'.
 *
 * The stricter 'require-corp' policy blocked preview media loaded from signed
 * GCS URLs because Google Cloud Storage doesn't set Cross-Origin-Resource-Policy
 * headers on signed URL responses. The browser enforced ORB (Opaque Response
 * Blocking), resulting in preview images and videos not rendering.
 *
 * 'credentialless' allows cross-origin resources that don't include credentials
 * (cookies, client certs) to load without CORP headers. Signed GCS URLs are
 * credential-free, so this policy is sufficient.
 *
 * Invariant: The COEP production header must be 'credentialless' so that
 * cross-origin media from GCS signed URLs can render in the browser.
 */

describe('regression: COEP header allows GCS signed URL media', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it('sets Cross-Origin-Embedder-Policy to credentialless in production', async () => {
    process.env.NODE_ENV = 'production';

    const app = express();
    applySecurityMiddleware(app);
    app.get('/test', (_req, res) => {
      res.status(200).send('ok');
    });

    const response = await request(app).get('/test');

    expect(response.headers['cross-origin-embedder-policy']).toBe('credentialless');
    expect(response.headers['cross-origin-opener-policy']).toBe('same-origin');
    expect(response.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });
});
