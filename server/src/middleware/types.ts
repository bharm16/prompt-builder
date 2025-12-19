/**
 * Types for middleware
 */

import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';

/**
 * Joi schema interface (for backward compatibility)
 */
export interface JoiSchema {
  validate: (value: unknown, options?: {
    stripUnknown?: boolean;
    allowUnknown?: boolean;
    abortEarly?: boolean;
  }) => { error?: { details: Array<{ message: string }> }; value: unknown };
}

/**
 * Validation schema (Zod or Joi)
 */
export type ValidationSchema = ZodSchema | JoiSchema;

/**
 * Express middleware function
 */
export type Middleware = (req: Request, res: Response, next: NextFunction) => void | Promise<void>;

/**
 * Request with validated body
 */
export interface ValidatedRequest extends Request {
  body: unknown;
}

