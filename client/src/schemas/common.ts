import { z } from 'zod';

// Reusable schema fragments
export const IdSchema = z.string().uuid();
export const TimestampSchema = z.string().datetime();
export const EmailSchema = z.string().email();

// Common response wrapper
export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: dataSchema,
    success: z.boolean(),
    error: z
      .object({
        code: z.string(),
        message: z.string(),
      })
      .optional(),
  });

