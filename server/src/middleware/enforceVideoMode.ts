import type { Request, Response, NextFunction } from 'express';

const VIDEO_MODE = 'video' as const;

export function enforceVideoMode(req: Request, _res: Response, next: NextFunction): void {
  const body = typeof req.body === 'object' && req.body !== null ? req.body : {};
  const bodyWithMode = body as { mode?: string };

  if (bodyWithMode.mode !== VIDEO_MODE) {
    bodyWithMode.mode = VIDEO_MODE;
  }

  req.body = body;
  next();
}
