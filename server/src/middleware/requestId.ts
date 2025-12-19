import { v4 as uuidv4 } from 'uuid';
import { runWithRequestContext } from '../infrastructure/requestContext.js';
import type { NextFunction, Request, Response } from 'express';

/**
 * Middleware to add unique request ID to each request
 * Helps with request correlation and debugging
 */
type RequestWithId = Request & { id?: string | string[] };

export function requestIdMiddleware(
  req: RequestWithId,
  res: Response,
  next: NextFunction
): void {
  // Use provided request ID or generate new one
  req.id = (req.headers['x-request-id'] as string | string[] | undefined) || uuidv4();

  // Set response header
  res.setHeader('X-Request-ID', req.id);

  runWithRequestContext({ requestId: req.id }, () => next());
}
