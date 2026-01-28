import type { Request } from 'express';

const BEARER_PREFIX = 'Bearer ';
const FIREBASE_TOKEN_HEADER = 'x-firebase-token';

export function normalizeHeaderValue(
  headerValue: string | string[] | undefined
): string | null {
  if (Array.isArray(headerValue)) {
    return headerValue[0] || null;
  }
  if (typeof headerValue === 'string' && headerValue.trim().length > 0) {
    return headerValue.trim();
  }
  return null;
}

export function extractBearerToken(
  headerValue: string | string[] | undefined
): string | null {
  const value = normalizeHeaderValue(headerValue);
  if (!value || !value.startsWith(BEARER_PREFIX)) {
    return null;
  }
  const token = value.substring(BEARER_PREFIX.length).trim();
  return token.length > 0 ? token : null;
}

export function extractFirebaseToken(req: Request): string | null {
  const headerToken = normalizeHeaderValue(req.headers[FIREBASE_TOKEN_HEADER]);
  if (headerToken) {
    return headerToken;
  }

  const bearerToken = extractBearerToken(req.headers.authorization);
  const apiKey = (req as Request & { apiKey?: string }).apiKey;
  if (bearerToken && bearerToken !== apiKey) {
    return bearerToken;
  }

  return null;
}

