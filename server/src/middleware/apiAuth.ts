import type { NextFunction, Request, Response } from 'express';
import { admin } from '@infrastructure/firebaseAdmin';
import { logger } from '@infrastructure/Logger';

/**
 * API Key Authentication Middleware
 *
 * Validates API keys from either the X-API-Key header, Authorization: Bearer header,
 * or apiKey query parameter. Requires ALLOWED_API_KEYS (preferred) or API_KEY.
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next middleware function
 */
const DEV_FALLBACK_KEY = 'dev-key-12345';
const BEARER_PREFIX = 'Bearer ';

type ApiAuthRequest = Request & {
  apiKey?: string;
  user?: { uid: string };
  id?: string;
  query: Request['query'] & { apiKey?: string };
};

function normalizeHeaderValue(
  headerValue: string | string[] | undefined
): string | null {
  if (Array.isArray(headerValue)) {
    return headerValue[0] || null;
  }
  if (typeof headerValue === 'string' && headerValue.trim().length > 0) {
    return headerValue.trim();
  }
  return null;
}

function extractBearerToken(headerValue: string | string[] | undefined): string | null {
  const value = normalizeHeaderValue(headerValue);
  if (!value || !value.startsWith(BEARER_PREFIX)) {
    return null;
  }
  const token = value.substring(BEARER_PREFIX.length).trim();
  return token.length > 0 ? token : null;
}

export async function apiAuthMiddleware(
  req: ApiAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const headerApiKey = normalizeHeaderValue(req.headers['x-api-key']);
  const authBearer = extractBearerToken(req.headers.authorization);
  const queryApiKey = typeof req.query.apiKey === 'string' ? req.query.apiKey : null;
  const apiKeyCandidate = headerApiKey || queryApiKey || authBearer;

  const firebaseTokenHeader = normalizeHeaderValue(req.headers['x-firebase-token']);
  const firebaseToken = firebaseTokenHeader || authBearer;

  if (firebaseToken) {
    try {
      const decoded = await admin.auth().verifyIdToken(firebaseToken);
      req.user = { uid: decoded.uid };
      logger.info('API request authenticated via Firebase token', {
        ip: req.ip,
        path: req.path,
        method: req.method,
        requestId: req.id,
        userId: decoded.uid,
      });
      next();
      return;
    } catch (error) {
      logger.warn('Invalid Firebase token', {
        ip: req.ip,
        path: req.path,
        method: req.method,
        requestId: req.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Get allowed API keys from environment
  const envKeys = process.env.ALLOWED_API_KEYS?.split(',')
    .map((k) => k.trim())
    .filter(Boolean) || [];
  const singleApiKey =
    typeof process.env.API_KEY === 'string' && process.env.API_KEY.trim().length > 0
      ? [process.env.API_KEY.trim()]
      : [];
  const allowedKeys =
    envKeys.length > 0
      ? envKeys
      : singleApiKey.length > 0
        ? singleApiKey
        : process.env.NODE_ENV !== 'production'
          ? [DEV_FALLBACK_KEY]
          : [];

  if (apiKeyCandidate && allowedKeys.includes(apiKeyCandidate)) {
    logger.info('API request authenticated via API key', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      requestId: req.id,
    });

    req.apiKey = apiKeyCandidate;
    req.user = { uid: `api-key:${apiKeyCandidate}` };
    next();
    return;
  }

  if (!apiKeyCandidate && !firebaseToken) {
    logger.warn('API request without authentication', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      requestId: req.id,
    });

    res.status(401).json({
      error: 'Authentication required',
      message: 'Provide a Firebase token or API key to access this endpoint',
      requestId: req.id,
    });
    return;
  }

  logger.warn('Authentication failed', {
    ip: req.ip,
    path: req.path,
    method: req.method,
    requestId: req.id,
  });

  res.status(403).json({
    error: 'Unauthorized',
    message: 'The provided credentials are not authorized',
  });
  return;
}
