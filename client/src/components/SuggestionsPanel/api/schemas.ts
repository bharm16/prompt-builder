import { z } from 'zod';

/**
 * Zod schemas for Custom Suggestions API responses
 * Following STYLE_RULES.md: Runtime validation at API boundaries
 */

export const CustomSuggestionsResponseSchema = z.object({
  suggestions: z.array(z.string()),
});

export type CustomSuggestionsResponse = z.infer<
  typeof CustomSuggestionsResponseSchema
>;

