/**
 * Types for middleware
 */

import type { Request, Response, NextFunction } from "express";
import type { ZodSchema } from "zod";

/**
 * Validation schema (Zod)
 */
export type ValidationSchema = ZodSchema;

/**
 * Express middleware function
 */
export type Middleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => void | Promise<void>;

/**
 * Request with validated body
 */
export interface ValidatedRequest extends Request {
  body: unknown;
}
