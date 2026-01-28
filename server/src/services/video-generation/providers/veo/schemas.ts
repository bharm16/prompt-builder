import { z } from 'zod';

export const VEO_START_RESPONSE_SCHEMA = z.object({
  name: z.string(),
});

export const VEO_OPERATION_SCHEMA = z.object({
  name: z.string(),
  done: z.boolean().optional(),
  error: z.object({ message: z.string().optional() }).optional(),
  response: z.unknown().optional(),
});

export type VeoOperation = z.infer<typeof VEO_OPERATION_SCHEMA>;
