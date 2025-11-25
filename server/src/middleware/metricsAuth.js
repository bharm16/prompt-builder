import { logger } from '../infrastructure/Logger.ts';

/**
 * Metrics Authentication Middleware
 *
 * Validates bearer token for accessing metrics and stats endpoints.
 * Requires METRICS_TOKEN environment variable.
 *
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export function metricsAuthMiddleware(req, res, next) {
  // Extract bearer token from Authorization header
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    logger.warn('Metrics access attempt without authorization', {
      ip: req.ip,
      path: req.path,
      requestId: req.id,
    });

    return res.status(401).json({
      error: 'Authorization required',
      message: 'Please provide Bearer token in Authorization header',
    });
  }

  // Validate Bearer token format
  if (!authHeader.startsWith('Bearer ')) {
    logger.warn('Invalid authorization format for metrics access', {
      ip: req.ip,
      path: req.path,
      requestId: req.id,
    });

    return res.status(401).json({
      error: 'Invalid authorization format',
      message: 'Authorization header must use Bearer token format',
    });
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  // Get metrics token from environment
  const validToken = process.env.METRICS_TOKEN;

  if (!validToken) {
    logger.error('METRICS_TOKEN environment variable not configured', {
      requestId: req.id,
    });

    return res.status(500).json({
      error: 'Server configuration error',
      message: 'Metrics authentication not properly configured',
    });
  }

  // Validate token (constant-time comparison to prevent timing attacks)
  const tokenBuffer = Buffer.from(token);
  const validTokenBuffer = Buffer.from(validToken);

  // Check length first to prevent length-based timing attacks
  if (tokenBuffer.length !== validTokenBuffer.length) {
    logger.warn('Invalid metrics token attempt', {
      ip: req.ip,
      path: req.path,
      requestId: req.id,
    });

    return res.status(403).json({
      error: 'Invalid token',
      message: 'The provided token is not authorized',
    });
  }

  // Constant-time comparison
  let isValid = true;
  for (let i = 0; i < tokenBuffer.length; i++) {
    if (tokenBuffer[i] !== validTokenBuffer[i]) {
      isValid = false;
    }
  }

  if (!isValid) {
    logger.warn('Invalid metrics token attempt', {
      ip: req.ip,
      path: req.path,
      requestId: req.id,
    });

    return res.status(403).json({
      error: 'Invalid token',
      message: 'The provided token is not authorized',
    });
  }

  // Authentication successful
  logger.info('Metrics access authenticated', {
    ip: req.ip,
    path: req.path,
    requestId: req.id,
  });

  next();
}
