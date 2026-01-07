import { logger } from '@infrastructure/Logger';

/**
 * API Key Authentication Middleware
 *
 * Validates API keys from either the X-API-Key header, Authorization: Bearer header,
 * or apiKey query parameter. Requires ALLOWED_API_KEYS (preferred) or API_KEY.
 *
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const DEV_FALLBACK_KEY = 'dev-key-12345';
const BEARER_PREFIX = 'Bearer ';

function normalizeHeaderValue(headerValue) {
  if (Array.isArray(headerValue)) {
    return headerValue[0] || null;
  }
  if (typeof headerValue === 'string' && headerValue.trim().length > 0) {
    return headerValue.trim();
  }
  return null;
}

function extractBearerToken(headerValue) {
  const value = normalizeHeaderValue(headerValue);
  if (!value || !value.startsWith(BEARER_PREFIX)) {
    return null;
  }
  const token = value.substring(BEARER_PREFIX.length).trim();
  return token.length > 0 ? token : null;
}

export function apiAuthMiddleware(req, res, next) {
  const headerApiKey = normalizeHeaderValue(req.headers['x-api-key']);
  const authApiKey = headerApiKey ? null : extractBearerToken(req.headers.authorization);
  const queryApiKey = typeof req.query?.apiKey === 'string' ? req.query.apiKey : null;
  const apiKey = headerApiKey || authApiKey || queryApiKey;

  if (!apiKey) {
    logger.warn('API request without API key', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      requestId: req.id,
    });

    return res.status(401).json({
      error: 'API key required',
      message: 'Provide an API key via Authorization: Bearer <key> or X-API-Key header',
      requestId: req.id,
    });
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

  if (allowedKeys.length === 0) {
    logger.error('API key environment variables not configured', {
      requestId: req.id,
    });

    return res.status(500).json({
      error: 'Server configuration error',
      message: 'API authentication not properly configured',
    });
  }

  // Validate API key
  if (!allowedKeys.includes(apiKey)) {
    logger.warn('Invalid API key attempt', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      requestId: req.id,
    });

    return res.status(403).json({
      error: 'Invalid API key',
      message: 'The provided API key is not authorized',
    });
  }

  // Authentication successful
  logger.info('API request authenticated', {
    ip: req.ip,
    path: req.path,
    method: req.method,
    requestId: req.id,
  });

  req.apiKey = apiKey;
  next();
}
