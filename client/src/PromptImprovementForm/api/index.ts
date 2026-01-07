import { buildFirebaseAuthHeaders } from '@/services/http/firebaseAuth';

import { QuestionsResponseSchema, type Question } from './schemas';

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
    console.error('Question generation API error:', errorText);
    throw new Error(`Failed to generate questions: ${response.status}`);
  }

  const data = QuestionsResponseSchema.parse(await response.json());
  return data.questions;
}
