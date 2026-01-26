import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { ButtonHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { PromptImprovementForm } from '@/PromptImprovementForm/PromptImprovementForm';
import { useQuestionGeneration } from '@/PromptImprovementForm/hooks/useQuestionGeneration';
import type { Question } from '@/PromptImprovementForm/types';

vi.mock('@/PromptImprovementForm/hooks/useQuestionGeneration', () => ({
  useQuestionGeneration: vi.fn(),
}));

vi.mock('@promptstudio/system/components/ui/button', () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock('@promptstudio/system/components/ui/textarea', () => ({
  Textarea: ({ ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
    <textarea {...props} />
  ),
}));

describe('PromptImprovementForm', () => {
  const mockUseQuestionGeneration = vi.mocked(useQuestionGeneration);

  const questions: Question[] = [
    {
      id: 1,
      title: 'Focus areas',
      description: 'Describe focus',
      field: 'specificAspects',
      examples: ['Example focus'],
    },
    {
      id: 2,
      title: 'Background',
      description: 'Describe background',
      field: 'backgroundLevel',
      examples: ['Beginner'],
    },
    {
      id: 3,
      title: 'Use case',
      description: 'Describe use',
      field: 'intendedUse',
      examples: ['Internal memo'],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('shows loading state messaging while questions are generated', () => {
      mockUseQuestionGeneration.mockReturnValue({
        questions: [],
        isLoading: true,
        error: null,
      });

      render(<PromptImprovementForm onComplete={vi.fn()} initialPrompt="Draft" />);

      expect(screen.getByText('Generating context-aware questions...')).toBeInTheDocument();
      expect(screen.getByText('Analyzing your prompt...')).toBeInTheDocument();
    });

    it('shows fallback message when question generation fails', () => {
      mockUseQuestionGeneration.mockReturnValue({
        questions: [],
        isLoading: false,
        error: 'Failed',
      });

      render(<PromptImprovementForm onComplete={vi.fn()} initialPrompt="Draft" />);

      expect(screen.getByText('Failed to generate custom questions')).toBeInTheDocument();
      expect(screen.getByText('Using fallback questions instead')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('disables submission when no answers are provided', () => {
      mockUseQuestionGeneration.mockReturnValue({
        questions: [],
        isLoading: false,
        error: null,
      });

      render(<PromptImprovementForm onComplete={vi.fn()} initialPrompt="Draft" />);

      const button = screen.getByRole('button', {
        name: 'Answer at least one question to continue',
      });
      expect(button).toBeDisabled();
    });

    it('allows skipping context and sends empty answers', async () => {
      const user = userEvent.setup();
      const onComplete = vi.fn();
      mockUseQuestionGeneration.mockReturnValue({
        questions,
        isLoading: false,
        error: null,
      });

      render(<PromptImprovementForm onComplete={onComplete} initialPrompt="Draft" />);

      await user.click(screen.getByRole('button', { name: 'Skip and optimize without context' }));

      expect(onComplete).toHaveBeenCalledWith('Draft', {
        specificAspects: '',
        backgroundLevel: '',
        intendedUse: '',
      });
    });
  });

  describe('core behavior', () => {
    it('builds an enhanced prompt when answers are provided', async () => {
      const user = userEvent.setup();
      const onComplete = vi.fn();
      mockUseQuestionGeneration.mockReturnValue({
        questions,
        isLoading: false,
        error: null,
      });

      render(<PromptImprovementForm onComplete={onComplete} initialPrompt="Draft" />);

      await user.click(screen.getByRole('button', { name: 'Example focus' }));
      await user.click(screen.getByRole('button', { name: 'Optimize with Context' }));

      expect(onComplete).toHaveBeenCalledWith(
        expect.stringContaining('Specific Focus: Example focus'),
        {
          specificAspects: 'Example focus',
          backgroundLevel: '',
          intendedUse: '',
        }
      );
    });
  });
});
