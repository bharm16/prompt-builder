import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { PromptResultsSection } from '@features/prompt-optimizer/components/PromptResultsSection';
import { usePromptState } from '@features/prompt-optimizer/context/PromptStateContext';

vi.mock('@features/prompt-optimizer/context/PromptStateContext', () => ({
  usePromptState: vi.fn(),
}));

vi.mock('@features/prompt-optimizer/PromptCanvas', () => ({
  PromptCanvas: (props: { inputPrompt: string; displayedPrompt: string }) => (
    <div>
      <span>Input: {props.inputPrompt}</span>
      <span>Output: {props.displayedPrompt}</span>
    </div>
  ),
}));

const mockUsePromptState = vi.mocked(usePromptState);

describe('PromptResultsSection', () => {
  describe('error handling', () => {
    it('shows the refining banner when refining is true', () => {
      mockUsePromptState.mockReturnValue({
        showResults: true,
        currentPromptUuid: 'uuid-1',
        promptOptimizer: {
          inputPrompt: 'input',
          displayedPrompt: 'output',
          optimizedPrompt: 'opt',
          previewPrompt: null,
          previewAspectRatio: null,
          qualityScore: null,
          isDraftReady: true,
          isRefining: true,
          isProcessing: false,
          draftSpans: null,
          refinedSpans: null,
        },
        currentMode: { id: 'video' },
        suggestionsData: null,
        initialHighlights: null,
        initialHighlightsVersion: 0,
        canUndo: false,
        canRedo: false,
        handleCreateNew: vi.fn(),
      } as ReturnType<typeof usePromptState>);

      render(
        <PromptResultsSection
          user={null}
          onDisplayedPromptChange={vi.fn()}
          onReoptimize={vi.fn()}
          onFetchSuggestions={vi.fn()}
          onSuggestionClick={vi.fn()}
          onHighlightsPersist={vi.fn()}
          onUndo={vi.fn()}
          onRedo={vi.fn()}
        />
      );

      expect(screen.getByText('Draft ready. Refining in background...')).toBeInTheDocument();
    });
  });

  describe('core behavior', () => {
    it('passes prompt data into PromptCanvas', () => {
      mockUsePromptState.mockReturnValue({
        showResults: true,
        currentPromptUuid: 'uuid-1',
        promptOptimizer: {
          inputPrompt: 'input prompt',
          displayedPrompt: 'displayed prompt',
          optimizedPrompt: 'opt',
          previewPrompt: null,
          previewAspectRatio: null,
          qualityScore: null,
          isDraftReady: false,
          isRefining: false,
          isProcessing: false,
          draftSpans: null,
          refinedSpans: null,
        },
        currentMode: { id: 'video' },
        suggestionsData: null,
        initialHighlights: null,
        initialHighlightsVersion: 0,
        canUndo: false,
        canRedo: false,
        handleCreateNew: vi.fn(),
      } as ReturnType<typeof usePromptState>);

      render(
        <PromptResultsSection
          user={null}
          onDisplayedPromptChange={vi.fn()}
          onReoptimize={vi.fn()}
          onFetchSuggestions={vi.fn()}
          onSuggestionClick={vi.fn()}
          onHighlightsPersist={vi.fn()}
          onUndo={vi.fn()}
          onRedo={vi.fn()}
        />
      );

      expect(screen.getByText('Input: input prompt')).toBeInTheDocument();
      expect(screen.getByText('Output: displayed prompt')).toBeInTheDocument();
    });
  });
});
