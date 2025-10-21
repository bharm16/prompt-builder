import { v4 as uuidv4 } from 'uuid';

/**
 * Middleware to add unique request ID to each request
 * Helps with request correlation and debugging
 */
export function requestIdMiddleware(req, res, next) {
  // Use provided request ID or generate new one
  req.id = req.headers['x-request-id'] || uuidv4();

  // Set response header
  res.setHeader('X-Request-ID', req.id);

  next();
}
