import type { Request, Response, NextFunction } from 'express';
import { logger } from '@infrastructure/Logger';
import type { ValidationSchema } from './types.js';

/**
 * Middleware factory for request validation using Joi or Zod schemas
 */
export function validateRequest(schema: ValidationSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Check if it's a Zod schema (has safeParse method)
    if (schema && typeof (schema as { safeParse?: unknown }).safeParse === 'function') {
      const zodSchema = schema as { safeParse: (value: unknown) => { success: boolean; error?: { errors: Array<{ message?: string }> }; data: unknown } };
      const result = zodSchema.safeParse(req.body);
      
      if (!result.success) {
        const firstError = result.error?.errors?.[0];
        logger.warn('Request validation failed', {
          requestId: (req as Request & { id?: string }).id,
          error: firstError?.message || 'Validation failed',
          path: req.path,
        });

        res.status(400).json({
          error: 'Validation failed',
          details: firstError?.message || 'Invalid request data',
          requestId: (req as Request & { id?: string }).id,
        });
        return;
      }

      // Replace request body with validated/sanitized value
      req.body = result.data;
      next();
      return;
    }

    // Fallback to Joi schema (has validate method)
    if (schema && typeof (schema as { validate?: unknown }).validate === 'function') {
      const joiSchema = schema as {
        validate: (value: unknown, options?: {
          stripUnknown?: boolean;
          allowUnknown?: boolean;
          abortEarly?: boolean;
        }) => { error?: { details: Array<{ message: string }> }; value: unknown };
      };
      const { error, value } = joiSchema.validate(req.body, {
        stripUnknown: false,
        allowUnknown: false,
        abortEarly: false
      });

      if (error) {
        logger.warn('Request validation failed', {
          requestId: (req as Request & { id?: string }).id,
          error: error.details[0]?.message,
          path: req.path,
        });

        res.status(400).json({
          error: 'Validation failed',
          details: error.details[0]?.message || 'Invalid request data',
          requestId: (req as Request & { id?: string }).id,
        });
        return;
      }

      // Replace request body with validated/sanitized value
      req.body = value;
      next();
      return;
    }

    // Invalid schema
    logger.error(
      'Invalid validation schema provided',
      undefined,
      {
        requestId: (req as Request & { id?: string }).id,
        path: req.path,
        schemaType: typeof schema,
      }
    );

    res.status(500).json({
      error: 'Internal server error',
      message: 'Invalid validation schema',
      requestId: (req as Request & { id?: string }).id,
    });
  };
}
