import { buildFirebaseAuthHeaders } from '@/services/http/firebaseAuth';
import { logger } from '@/services/LoggingService';
import { summarize } from '@/utils/logging';
import { QuestionsResponseSchema, type Question } from './schemas';

const log = logger.child('PromptImprovementFormApi');

export async function fetchGeneratedQuestions(prompt: string): Promise<Question[]> {
  const authHeaders = await buildFirebaseAuthHeaders();
  const response = await fetch('/api/generate-questions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    log.error('Question generation API request failed', new Error('generate-questions request failed'), {
      operation: 'fetchGeneratedQuestions',
      status: response.status,
      errorText: summarize(errorText),
      promptLength: prompt.length,
    });
    throw new Error(`Failed to generate questions: ${response.status}`);
  }

  const data = QuestionsResponseSchema.parse(await response.json());
  return data.questions;
}
