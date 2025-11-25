import { logger } from '@infrastructure/Logger';

/**
 * Middleware factory for request validation using Joi schemas
 * @param {Object} schema - Joi validation schema
 * @returns {Function} Express middleware
 */
export function validateRequest(schema) {
  return (req, res, next) => {
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
  };
}
