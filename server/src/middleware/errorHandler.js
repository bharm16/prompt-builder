import { logger } from '../infrastructure/Logger.js';

/**
 * Global error handling middleware
 * Catches and formats errors consistently
 */
export function errorHandler(err, req, res, next) {
  // Log the error
  const meta = {
    requestId: req.id,
    method: req.method,
    path: req.path,
  };

  // Redact request bodies to avoid sensitive data leakage in production
  if (process.env.NODE_ENV !== 'production') {
    try {
      const bodyStr = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      meta.bodyPreview = bodyStr?.substring(0, 300);
      meta.bodyLength = bodyStr?.length;
    } catch {
      // ignore serialization errors
    }
  }

  logger.error('Request error', err, meta);

  // Determine status code
  const statusCode = err.statusCode || err.status || 500;

  // Build error response
  const errorResponse = {
    error: err.message || 'Internal server error',
    requestId: req.id,
  };

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
  }

  // Add additional error details if available
  if (err.details) {
    errorResponse.details = err.details;
  }

  res.status(statusCode).json(errorResponse);
}
