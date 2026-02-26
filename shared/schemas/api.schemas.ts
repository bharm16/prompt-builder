/**
 * Zod schemas mirroring shared/types/api.ts.
 *
 * Used for runtime validation of API responses at the client boundary and in
 * contract tests.  The `.passthrough()` calls allow forward-compatible server
 * additions without breaking client-side parsing.
 */
import { z } from 'zod';
import { API_ERROR_CODES } from '../types/api.js';

// ---------------------------------------------------------------------------
// Error schemas
// ---------------------------------------------------------------------------

export const ApiErrorCodeSchema = z.enum(API_ERROR_CODES);

export const ApiErrorResponseSchema = z
  .object({
    error: z.string(),
    code: ApiErrorCodeSchema.optional(),
    details: z.string().optional(),
    requestId: z.string().optional(),
  })
  .passthrough();

// ---------------------------------------------------------------------------
// Success envelope schemas
// ---------------------------------------------------------------------------

/** Generic success response — pass a Zod schema for the `data` field. */
export const ApiSuccessResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z
    .object({
      success: z.literal(true),
      data: dataSchema,
      requestId: z.string().optional(),
    })
    .passthrough();

/** Generic API response (success | error) — pass a Zod schema for the data. */
export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.discriminatedUnion('success', [
    z.object({
      success: z.literal(true),
      data: dataSchema,
      requestId: z.string().optional(),
    }),
    z.object({
      success: z.literal(false),
      error: z.string(),
      code: ApiErrorCodeSchema.optional(),
      details: z.string().optional(),
      requestId: z.string().optional(),
    }),
  ]);
