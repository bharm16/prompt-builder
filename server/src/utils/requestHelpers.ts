/**
 * Request Helper Utilities
 * 
 * Common utilities for extracting and handling request metadata
 */

import type { Request } from 'express';

/**
 * Extract userId from request
 * Checks multiple sources in order of priority:
 * 1. Firebase auth user (req.user.uid)
 * 2. API key (req.apiKey)
 * 3. Request body userId (for backward compatibility)
 * 4. Falls back to 'anonymous'
 * 
 * @param req - Express request object
 * @returns userId string
 */
export function extractUserId(req: Request): string {
  const reqWithAuth = req as Request & { 
    user?: { uid?: string }; 
    apiKey?: string;
    body?: { userId?: string };
  };
  
  return reqWithAuth.user?.uid || 
         reqWithAuth.apiKey || 
         reqWithAuth.body?.userId ||
         'anonymous';
}

/**
 * Extract standard request metadata for logging
 * 
 * @param req - Express request object
 * @returns Standard metadata object
 */
export function extractRequestMetadata(req: Request) {
  const reqWithId = req as Request & { id?: string };
  
  return {
    requestId: reqWithId.id,
    userId: extractUserId(req),
    method: req.method,
    path: req.path,
    ip: req.ip,
  };
}
