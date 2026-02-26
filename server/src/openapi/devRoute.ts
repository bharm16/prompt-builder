/**
 * Development-only OpenAPI spec route.
 *
 * Mounts at `/api-docs` and serves the generated OpenAPI spec as JSON.
 * Only active when `NODE_ENV !== 'production'`.
 *
 * Browse the spec by pasting the JSON URL into https://editor.swagger.io
 * or any OpenAPI-compatible viewer.
 */

import express, { type Router } from 'express';
import { buildOpenApiSpec } from './spec.ts';

/**
 * Create a router that serves the OpenAPI spec at GET /api-docs.
 * Returns null in production (caller should skip mounting).
 */
export function createOpenApiDevRoute(): Router | null {
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  const router = express.Router();

  // Cache the spec in memory — it doesn't change at runtime.
  let cachedSpec: ReturnType<typeof buildOpenApiSpec> | null = null;

  router.get('/', (_req, res) => {
    if (!cachedSpec) {
      cachedSpec = buildOpenApiSpec();
    }
    res.json(cachedSpec);
  });

  return router;
}
