import type { Request } from 'express';
import { logger } from '@infrastructure/Logger';
import { admin } from '@infrastructure/firebaseAdmin';
import { extractFirebaseToken } from '@utils/auth';

interface RequestWithAuth extends Request {
  apiKey?: string;
  user?: { uid?: string };
}

export async function getAuthenticatedUserId(req: Request): Promise<string | null> {
  const reqWithAuth = req as RequestWithAuth;
  const apiKey = reqWithAuth.apiKey;

  if (apiKey && process.env.NODE_ENV !== 'production') {
    return `dev-api-key:${apiKey}`;
  }

  const token = extractFirebaseToken(req);

  if (!token) {
    logger.warn('Missing authentication token for video generation', {
      path: req.path,
      ip: req.ip,
    });
    return null;
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    const uid = decoded.uid;
    reqWithAuth.user = { uid };
    return uid;
  } catch (error) {
    logger.warn('Invalid authentication token for video generation', {
      path: req.path,
      ip: req.ip,
      error: (error as Error)?.message,
    });
    return null;
  }
}
