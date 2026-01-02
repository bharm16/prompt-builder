import { useEffect, useState } from 'react';

import type { Question } from '../types';

import { fetchGeneratedQuestions } from '../api';
import { generateFallbackQuestions } from '../utils/questionGeneration';

export interface UseQuestionGenerationResult {
  questions: Question[];
  isLoading: boolean;
  error: string | null;
}

export function useQuestionGeneration(initialPrompt: string): UseQuestionGenerationResult {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!initialPrompt) {
      return;
    }

    let isActive = true;

    const loadQuestions = async (): Promise<void> => {
      setIsLoading(true);
      setError(null);

      try {
        const generatedQuestions = await fetchGeneratedQuestions(initialPrompt);
        if (!isActive) return;
        setQuestions(generatedQuestions);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        if (!isActive) return;
        console.error('Error fetching questions:', err);
        setError(errorMessage);
        setQuestions(generateFallbackQuestions(initialPrompt));
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void loadQuestions();

    return () => {
      isActive = false;
    };
  }, [initialPrompt]);

  return { questions, isLoading, error };
}
