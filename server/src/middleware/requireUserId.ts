import type { Request, Response } from 'express';

export type RequestWithUser = Request & { user?: { uid?: string } };

export function requireUserId(req: RequestWithUser, res: Response): string | null {
  const userId = req.user?.uid;
  if (!userId) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return null;
  }
  return userId;
}
