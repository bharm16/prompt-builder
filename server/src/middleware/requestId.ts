import { v4 as uuidv4 } from 'uuid';
import { runWithRequestContext } from '@infrastructure/requestContext';
import type { NextFunction, Request, Response } from 'express';

/**
 * Middleware to add unique request ID to each request
 * Helps with request correlation and debugging
 */
type RequestWithId = Request & { id: string };

export function requestIdMiddleware(
  req: RequestWithId,
  res: Response,
  next: NextFunction
): void {
  // Use provided request ID or generate new one
  const headerValue = req.headers['x-request-id'];
  const requestId = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  const resolvedRequestId =
    typeof requestId === 'string' && requestId.length > 0 ? requestId : uuidv4();
  req.id = resolvedRequestId;

  // Set response header
  res.setHeader('X-Request-ID', resolvedRequestId);

  runWithRequestContext({ requestId: resolvedRequestId }, () => next());
}
