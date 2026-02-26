import { z } from 'zod';

// Reusable schema fragments
export const IdSchema = z.string().uuid();
export const TimestampSchema = z.string().datetime();
export const EmailSchema = z.string().email();

// Common response wrapper — re-exported from the shared contract layer.
export { ApiResponseSchema } from '@shared/schemas/api.schemas';
