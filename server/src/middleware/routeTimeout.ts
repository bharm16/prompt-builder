import type { RequestHandler, Request, Response, NextFunction } from 'express';

type RequestWithId = Request & { id?: string };
type RouteTimeoutFilter = (req: Request) => boolean;

interface RouteTimeoutOptions {
  shouldApply?: RouteTimeoutFilter;
}

/**
 * Creates a middleware that sends a 504 if the response hasn't started
 * within `timeoutMs` milliseconds.
 *
 * Safe to use on streaming routes — once `res.headersSent` is true the
 * timeout becomes a no-op.
 */
export function createRouteTimeout(
  timeoutMs: number,
  options?: RouteTimeoutOptions
): RequestHandler {
  return (_req: Request, res: Response, next: NextFunction): void => {
    if (options?.shouldApply && !options.shouldApply(_req)) {
      next();
      return;
    }

    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(504).json({
          error: 'Request timeout',
          code: 'ROUTE_TIMEOUT',
          requestId: (_req as RequestWithId).id,
        });
      }
    }, timeoutMs);

    // Unref so the timer doesn't keep the process alive during shutdown
    timer.unref();

    res.on('close', () => clearTimeout(timer));
    res.on('finish', () => clearTimeout(timer));
    next();
  };
}
