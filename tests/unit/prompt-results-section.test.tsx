import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { PromptResultsSection } from '@features/prompt-optimizer/components/PromptResultsSection';
import {
  usePromptActions,
  usePromptConfig,
  usePromptHighlights,
  usePromptUIStateContext,
  usePromptServices,
  usePromptSession,
} from '@features/prompt-optimizer/context/PromptStateContext';
import { usePromptResultsActionsContext } from '@features/prompt-optimizer/context/PromptResultsActionsContext';

vi.mock('@features/prompt-optimizer/context/PromptStateContext', () => ({
  usePromptActions: vi.fn(),
  usePromptConfig: vi.fn(),
  usePromptHighlights: vi.fn(),
  usePromptServices: vi.fn(),
  usePromptSession: vi.fn(),
  usePromptUIStateContext: vi.fn(),
}));

vi.mock('@features/prompt-optimizer/context/PromptResultsActionsContext', () => ({
  usePromptResultsActionsContext: vi.fn(),
}));

vi.mock('@features/prompt-optimizer/PromptCanvas', () => ({
  PromptCanvas: (props: { inputPrompt: string; displayedPrompt: string }) => (
    <div>
      <span>Input: {props.inputPrompt}</span>
      <span>Output: {props.displayedPrompt}</span>
    </div>
  ),
}));

const mockUsePromptActions = vi.mocked(usePromptActions);
const mockUsePromptConfig = vi.mocked(usePromptConfig);
const mockUsePromptHighlights = vi.mocked(usePromptHighlights);
const mockUsePromptServices = vi.mocked(usePromptServices);
const mockUsePromptSession = vi.mocked(usePromptSession);
const mockUsePromptUIStateContext = vi.mocked(usePromptUIStateContext);
const mockUsePromptResultsActionsContext = vi.mocked(usePromptResultsActionsContext);

const buildPromptOptimizer = (overrides: Partial<ReturnType<typeof usePromptServices>['promptOptimizer']> = {}) => ({
  inputPrompt: 'input',
  displayedPrompt: 'output',
  optimizedPrompt: 'opt',
  previewPrompt: null,
  previewAspectRatio: null,
  qualityScore: null,
  isDraftReady: true,
  isRefining: false,
  isProcessing: false,
  draftSpans: null,
  refinedSpans: null,
  setInputPrompt: vi.fn(),
  ...overrides,
});

describe('PromptResultsSection', () => {
  describe('error handling', () => {
    it('shows the refining banner when refining is true', () => {
      mockUsePromptUIStateContext.mockReturnValue({
        showResults: true,
      } as ReturnType<typeof usePromptUIStateContext>);

      mockUsePromptSession.mockReturnValue({
        currentPromptUuid: 'uuid-1',
        suggestionsData: null,
      } as ReturnType<typeof usePromptSession>);

      mockUsePromptConfig.mockReturnValue({
        currentMode: { id: 'video' },
      } as ReturnType<typeof usePromptConfig>);

      mockUsePromptHighlights.mockReturnValue({
        initialHighlights: null,
        initialHighlightsVersion: 0,
        canUndo: false,
        canRedo: false,
      } as ReturnType<typeof usePromptHighlights>);

      mockUsePromptActions.mockReturnValue({
        handleCreateNew: vi.fn(),
      } as unknown as ReturnType<typeof usePromptActions>);

      mockUsePromptServices.mockReturnValue({
        promptOptimizer: buildPromptOptimizer({
          isRefining: true,
          isDraftReady: true,
        }),
      } as ReturnType<typeof usePromptServices>);
      mockUsePromptResultsActionsContext.mockReturnValue({
        user: null,
        onDisplayedPromptChange: vi.fn(),
        onReoptimize: vi.fn(async () => undefined),
        onFetchSuggestions: vi.fn(),
        onSuggestionClick: vi.fn(),
        onHighlightsPersist: vi.fn(),
        onUndo: vi.fn(),
        onRedo: vi.fn(),
        stablePromptContext: null,
        suggestionsData: null,
      } as any);

      render(<PromptResultsSection />);

      expect(screen.getByText('Optimizing prompt...')).toBeInTheDocument();
    });
  });

  describe('core behavior', () => {
    it('passes prompt data into PromptCanvas', () => {
      mockUsePromptUIStateContext.mockReturnValue({
        showResults: true,
      } as ReturnType<typeof usePromptUIStateContext>);

      mockUsePromptSession.mockReturnValue({
        currentPromptUuid: 'uuid-1',
        suggestionsData: null,
      } as ReturnType<typeof usePromptSession>);

      mockUsePromptConfig.mockReturnValue({
        currentMode: { id: 'video' },
      } as ReturnType<typeof usePromptConfig>);

      mockUsePromptHighlights.mockReturnValue({
        initialHighlights: null,
        initialHighlightsVersion: 0,
        canUndo: false,
        canRedo: false,
      } as ReturnType<typeof usePromptHighlights>);

      mockUsePromptActions.mockReturnValue({
        handleCreateNew: vi.fn(),
      } as unknown as ReturnType<typeof usePromptActions>);

      mockUsePromptServices.mockReturnValue({
        promptOptimizer: buildPromptOptimizer({
          inputPrompt: 'input prompt',
          displayedPrompt: 'displayed prompt',
          isDraftReady: false,
        }),
      } as ReturnType<typeof usePromptServices>);
      mockUsePromptResultsActionsContext.mockReturnValue({
        user: null,
        onDisplayedPromptChange: vi.fn(),
        onReoptimize: vi.fn(async () => undefined),
        onFetchSuggestions: vi.fn(),
        onSuggestionClick: vi.fn(),
        onHighlightsPersist: vi.fn(),
        onUndo: vi.fn(),
        onRedo: vi.fn(),
        stablePromptContext: null,
        suggestionsData: null,
      } as any);

      render(<PromptResultsSection />);

      expect(screen.getByText('Input: input prompt')).toBeInTheDocument();
      expect(screen.getByText('Output: displayed prompt')).toBeInTheDocument();
    });
  });
});
