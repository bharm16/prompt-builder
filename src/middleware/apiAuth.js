import { logger } from '../infrastructure/Logger.js';

/**
 * API Key Authentication Middleware
 *
 * Validates API keys from either the X-API-Key header or apiKey query parameter.
 * Requires ALLOWED_API_KEYS environment variable with comma-separated keys.
 *
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export function apiAuthMiddleware(req, res, next) {
  // Extract API key from header or query parameter
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    logger.warn('API request without API key', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      requestId: req.id,
    });

    return res.status(401).json({
      error: 'API key required',
      message: 'Please provide an API key via X-API-Key header',
      requestId: req.id,
    });
  }

  // Get allowed API keys from environment
  const allowedKeys = process.env.ALLOWED_API_KEYS?.split(',').map((k) => k.trim()) || [];

  if (allowedKeys.length === 0) {
    logger.error('ALLOWED_API_KEYS environment variable not configured', {
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
