import { z } from 'zod';

export const RoleClassifyRequestSchema = z.object({
  templateVersion: z.string().default('v1'),
  spans: z.array(z.unknown()).transform((spans) => {
    return spans
      .map((span) => {
        const s = span as Record<string, unknown>;
        return {
          text: String(s?.text ?? ''),
          start: Number.isInteger(s?.start) ? (s.start as number) : -1,
          end: Number.isInteger(s?.end) ? (s.end as number) : -1,
        };
      })
      .filter((s) => s.text && s.start >= 0 && s.end > s.start);
  }),
});

export type RoleClassifyRequest = z.infer<typeof RoleClassifyRequestSchema>;
