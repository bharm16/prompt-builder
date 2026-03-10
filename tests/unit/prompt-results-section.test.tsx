import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PromptResultsSection } from '@features/prompt-optimizer/components/PromptResultsSection';
import {
  usePromptActions,
  usePromptConfig,
  usePromptHighlights,
  usePromptServices,
  usePromptSession,
  usePromptUIStateContext,
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

const buildPromptOptimizer = () => ({
  inputPrompt: 'input prompt',
  displayedPrompt: 'displayed prompt',
  optimizedPrompt: 'displayed prompt',
  previewPrompt: null,
  previewAspectRatio: null,
  qualityScore: null,
  isProcessing: false,
  optimizationResultVersion: 1,
  setInputPrompt: vi.fn(),
});

describe('PromptResultsSection', () => {
  it('passes prompt data into PromptCanvas', () => {
    mockUsePromptUIStateContext.mockReturnValue({
      showResults: true,
      setShowResults: vi.fn(),
    } as never);

    mockUsePromptSession.mockReturnValue({
      currentPromptUuid: 'uuid-1',
      suggestionsData: null,
    } as never);

    mockUsePromptConfig.mockReturnValue({
      currentMode: { id: 'video' },
    } as never);

    mockUsePromptHighlights.mockReturnValue({
      initialHighlights: null,
      initialHighlightsVersion: 0,
      canUndo: false,
      canRedo: false,
    } as never);

    mockUsePromptActions.mockReturnValue({
      handleCreateNew: vi.fn(),
      setDisplayedPromptSilently: vi.fn(),
    } as never);

    mockUsePromptServices.mockReturnValue({
      promptOptimizer: buildPromptOptimizer(),
      promptHistory: {} as never,
    } as never);
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
    } as never);

    render(<PromptResultsSection />);

    expect(screen.getByText('Input: input prompt')).toBeInTheDocument();
    expect(screen.getByText('Output: displayed prompt')).toBeInTheDocument();
    expect(screen.queryByText('Optimizing prompt...')).not.toBeInTheDocument();
  });
});
