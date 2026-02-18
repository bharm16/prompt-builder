import type { Request } from 'express';
import { logger } from '@infrastructure/Logger';
import { admin } from '@infrastructure/firebaseAdmin';
import { extractFirebaseToken } from '@utils/auth';

interface PaymentRequestWithAuth extends Request {
  user?: { uid?: string };
  apiKey?: string;
}

export async function resolveUserId(req: Request): Promise<string | null> {
  const reqWithAuth = req as PaymentRequestWithAuth;

  if (reqWithAuth.user?.uid) {
    return reqWithAuth.user.uid;
  }

  const token = extractFirebaseToken(req);
  if (token) {
    try {
      const decoded = await admin.auth().verifyIdToken(token);
      const uid = decoded.uid;
      reqWithAuth.user = { uid };
      return uid;
    } catch (error) {
      logger.warn('Failed to verify auth token for payment request', {
        path: req.path,
        error: (error as Error).message,
      });
    }
  }

  if (reqWithAuth.apiKey) {
    return reqWithAuth.apiKey;
  }

  return null;
}
