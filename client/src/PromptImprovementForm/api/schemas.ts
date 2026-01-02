import { z } from 'zod';

export const QuestionSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string(),
  field: z.enum(['specificAspects', 'backgroundLevel', 'intendedUse']),
  examples: z.array(z.string()),
});

export const QuestionsResponseSchema = z.object({
  questions: z.array(QuestionSchema),
});

export type Question = z.infer<typeof QuestionSchema>;
export type QuestionsResponse = z.infer<typeof QuestionsResponseSchema>;
