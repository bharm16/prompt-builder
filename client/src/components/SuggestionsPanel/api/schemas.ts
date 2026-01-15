import { z } from 'zod';

/**
 * Zod schemas for Custom Suggestions API responses
 * Following STYLE_RULES.md: Runtime validation at API boundaries
 */

const CustomSuggestionItemSchema = z
  .object({
    text: z.string(),
    category: z.string().optional(),
    explanation: z.string().optional(),
    id: z.string().optional(),
    compatibility: z.number().optional(),
  })
  .passthrough();

export const CustomSuggestionsResponseSchema = z.object({
  suggestions: z.array(z.union([z.string(), CustomSuggestionItemSchema])),
});

export type CustomSuggestionsResponse = z.infer<
  typeof CustomSuggestionsResponseSchema
>;
