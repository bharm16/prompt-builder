import { logger } from '@infrastructure/Logger';

/**
 * Middleware factory for request validation using Joi or Zod schemas
 * @param {Object} schema - Joi or Zod validation schema
 * @returns {Function} Express middleware
 */
export function validateRequest(schema) {
  return (req, res, next) => {
    // Check if it's a Zod schema (has safeParse method)
    if (schema && typeof schema.safeParse === 'function') {
      const result = schema.safeParse(req.body);
      
      if (!result.success) {
        const firstError = result.error.errors[0];
        logger.warn('Request validation failed', {
          requestId: req.id,
          error: firstError?.message || 'Validation failed',
          path: req.path,
        });

        return res.status(400).json({
          error: 'Validation failed',
          details: firstError?.message || 'Invalid request data',
          requestId: req.id,
        });
      }

      // Replace request body with validated/sanitized value
      req.body = result.data;
      next();
      return;
    }

    // Fallback to Joi schema (has validate method)
    if (schema && typeof schema.validate === 'function') {
      const { error, value } = schema.validate(req.body, {
        stripUnknown: false,
        allowUnknown: false,
        abortEarly: false
      });

      if (error) {
        logger.warn('Request validation failed', {
          requestId: req.id,
          error: error.details[0].message,
          path: req.path,
        });

        return res.status(400).json({
          error: 'Validation failed',
          details: error.details[0].message,
          requestId: req.id,
        });
      }

      // Replace request body with validated/sanitized value
      req.body = value;
      next();
      return;
    }

    // Invalid schema
    logger.error('Invalid validation schema provided', {
      requestId: req.id,
      path: req.path,
      schemaType: typeof schema,
    });

    return res.status(500).json({
      error: 'Internal server error',
      message: 'Invalid validation schema',
      requestId: req.id,
    });
  };
}
