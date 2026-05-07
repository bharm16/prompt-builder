import type { Request, Response, NextFunction } from "express";
import { logger } from "@infrastructure/Logger";
import type { ValidationSchema } from "./types.js";

/**
 * Middleware factory for request validation using Zod schemas
 */
export function validateRequest(schema: ValidationSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (
      !schema ||
      typeof (schema as { safeParse?: unknown }).safeParse !== "function"
    ) {
      logger.error("Invalid validation schema provided", undefined, {
        requestId: (req as Request & { id?: string }).id,
        path: req.path,
        schemaType: typeof schema,
      });

      res.status(500).json({
        error: "Internal server error",
        message: "Invalid validation schema",
        requestId: (req as Request & { id?: string }).id,
      });
      return;
    }

    const result = schema.safeParse(req.body);

    if (!result.success) {
      const firstError = result.error?.issues?.[0];
      logger.warn("Request validation failed", {
        requestId: (req as Request & { id?: string }).id,
        error: firstError?.message || "Validation failed",
        path: req.path,
      });

      res.status(400).json({
        error: "Validation failed",
        details: firstError?.message || "Invalid request data",
        requestId: (req as Request & { id?: string }).id,
      });
      return;
    }

    // Replace request body with validated/sanitized value
    req.body = result.data;
    next();
  };
}
