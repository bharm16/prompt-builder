import { logger } from '../infrastructure/Logger.js';

/**
 * Global error handling middleware
 * Catches and formats errors consistently
 */
export function errorHandler(err, req, res, next) {
  // Log the error
  logger.error('Request error', err, {
    requestId: req.id,
    method: req.method,
    path: req.path,
    body: req.body,
  });

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
