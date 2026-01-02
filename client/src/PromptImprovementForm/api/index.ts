import { API_CONFIG } from '@config/api.config';

import { QuestionsResponseSchema, type Question } from './schemas';

export async function fetchGeneratedQuestions(prompt: string): Promise<Question[]> {
  const response = await fetch('/api/generate-questions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_CONFIG.apiKey,
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
