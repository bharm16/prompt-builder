import { z } from 'zod';

/**
 * Zod schemas for Video Concept API responses
 * Following STYLE_RULES.md: Runtime validation at API boundaries
 */

export const CompatibilityScoreSchema = z.object({
  score: z.number().min(0).max(1),
});

export const ValidationResultSchema = z.object({
  valid: z.boolean(),
  conflicts: z.array(z.string()).optional(),
  compatibility: CompatibilityScoreSchema.optional(),
});

export const ElementSuggestionsSchema = z.array(z.string());

export const ParsedElementsSchema = z.record(z.string(), z.string());

export const RefinementSuggestionsSchema = z.record(
  z.string(),
  z.array(z.string())
);

export const TechnicalParamsSchema = z.record(z.string(), z.unknown());

export const CompleteSceneResponseSchema = z.object({
  suggestions: ParsedElementsSchema.optional(),
  smartDefaults: z
    .object({
      refinements: RefinementSuggestionsSchema.optional(),
      technical: TechnicalParamsSchema.optional(),
    })
    .optional(),
  refinements: RefinementSuggestionsSchema.optional(),
  technicalParams: TechnicalParamsSchema.optional(),
});

// Type exports (inferred from schemas)
export type CompatibilityScore = z.infer<typeof CompatibilityScoreSchema>;
export type ValidationResult = z.infer<typeof ValidationResultSchema>;
export type ElementSuggestions = z.infer<typeof ElementSuggestionsSchema>;
export type ParsedElements = z.infer<typeof ParsedElementsSchema>;
export type RefinementSuggestions = z.infer<
  typeof RefinementSuggestionsSchema
>;
export type TechnicalParams = z.infer<typeof TechnicalParamsSchema>;
export type CompleteSceneResponse = z.infer<
  typeof CompleteSceneResponseSchema
>;

