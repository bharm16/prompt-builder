import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';
import type { LucideIcon } from 'lucide-react';
import { PromptInputSection } from '../PromptInputSection';
import type { PromptInputProps } from '../../types';
import type { PromptStateContextValue } from '../../context/types';
import { usePromptState } from '../../context/PromptStateContext';

vi.mock('../../context/PromptStateContext', () => ({
  usePromptState: vi.fn(),
}));

const mockPromptInput = vi.fn((props: PromptInputProps) => (
  <div data-testid="prompt-input" data-mode={props.selectedMode}>
    {props.inputPrompt}
  </div>
));

vi.mock('../../PromptInput', () => ({
  PromptInput: (props: PromptInputProps) => mockPromptInput(props),
}));

const mockUsePromptState = usePromptState as MockedFunction<typeof usePromptState>;
const placeholderIcon = (() => null) as unknown as LucideIcon;

const createPromptState = (
  overrides: Partial<PromptStateContextValue> = {}
): PromptStateContextValue => ({
  modes: [{ id: 'optimize', name: 'Standard', icon: placeholderIcon, description: 'Standard' }],
  selectedMode: 'optimize',
  setSelectedMode: vi.fn(),
  currentMode: { id: 'optimize', name: 'Standard', icon: placeholderIcon, description: 'Standard' },
  showHistory: false,
  setShowHistory: vi.fn(),
  showResults: false,
  setShowResults: vi.fn(),
  showSettings: false,
  setShowSettings: vi.fn(),
  showShortcuts: false,
  setShowShortcuts: vi.fn(),
  showImprover: false,
  setShowImprover: vi.fn(),
  showBrainstorm: false,
  setShowBrainstorm: vi.fn(),
  currentAIIndex: 0,
  setCurrentAIIndex: vi.fn(),
  suggestionsData: null,
  setSuggestionsData: vi.fn(),
  conceptElements: null,
  setConceptElements: vi.fn(),
  promptContext: null,
  setPromptContext: vi.fn(),
  currentPromptUuid: null,
  setCurrentPromptUuid: vi.fn(),
  currentPromptDocId: null,
  setCurrentPromptDocId: vi.fn(),
  initialHighlights: null,
  setInitialHighlights: vi.fn(),
  initialHighlightsVersion: 0,
  setInitialHighlightsVersion: vi.fn(),
  canUndo: false,
  setCanUndo: vi.fn(),
  canRedo: false,
  setCanRedo: vi.fn(),
  latestHighlightRef: { current: null },
  persistedSignatureRef: { current: null },
  undoStackRef: { current: [] },
  redoStackRef: { current: [] },
  isApplyingHistoryRef: { current: false },
  skipLoadFromUrlRef: { current: false },
  promptOptimizer: {
    inputPrompt: 'Test prompt',
    setInputPrompt: vi.fn(),
    isProcessing: false,
    optimizedPrompt: '',
    setOptimizedPrompt: vi.fn(),
    displayedPrompt: '',
    setDisplayedPrompt: vi.fn(),
    qualityScore: null,
    skipAnimation: false,
    setSkipAnimation: vi.fn(),
    improvementContext: null,
    setImprovementContext: vi.fn(),
    draftPrompt: '',
    isDraftReady: false,
    isRefining: false,
    draftSpans: null,
    refinedSpans: null,
    optimize: vi.fn(async () => ({ optimized: '', score: null })),
    resetPrompt: vi.fn(),
  },
  promptHistory: {
    history: [],
    filteredHistory: [],
    isLoadingHistory: false,
    searchQuery: '',
    setSearchQuery: vi.fn(),
    saveToHistory: vi.fn(async () => null),
    clearHistory: vi.fn(async () => {}),
    deleteFromHistory: vi.fn(async () => {}),
    loadHistoryFromFirestore: vi.fn(async () => {}),
    updateEntryHighlight: vi.fn(),
  },
  applyInitialHighlightSnapshot: vi.fn(),
  resetEditStacks: vi.fn(),
  setDisplayedPromptSilently: vi.fn(),
  handleCreateNew: vi.fn(),
  loadFromHistory: vi.fn(),
  navigate: vi.fn(),
  uuid: undefined,
  ...overrides,
});

describe('PromptInputSection', () => {
  const onOptimize = vi.fn();
  const onShowBrainstorm = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePromptState.mockReturnValue(createPromptState());
  });

  it('renders PromptInput with context values when idle', () => {
    render(
      <PromptInputSection
        aiNames={['GPT-4']}
        onOptimize={onOptimize}
        onShowBrainstorm={onShowBrainstorm}
      />
    );

    expect(screen.getByTestId('prompt-input')).toBeInTheDocument();
    expect(mockPromptInput).toHaveBeenCalledTimes(1);
    const passedProps = mockPromptInput.mock.calls[0]?.[0];
    expect(passedProps?.inputPrompt).toBe('Test prompt');
    expect(passedProps?.selectedMode).toBe('optimize');
    expect(passedProps?.onOptimize).toBe(onOptimize);
  });

  it('renders loading skeleton when prompt optimizer is processing', () => {
    mockUsePromptState.mockReturnValue(
      createPromptState({
        promptOptimizer: {
          ...createPromptState().promptOptimizer,
          isProcessing: true,
        },
      })
    );

    render(
      <PromptInputSection
        aiNames={['GPT-4']}
        onOptimize={onOptimize}
        onShowBrainstorm={onShowBrainstorm}
      />
    );

    expect(mockPromptInput).not.toHaveBeenCalled();
    expect(screen.queryByTestId('prompt-input')).not.toBeInTheDocument();
    expect(document.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('forwards aiNames and callbacks unchanged', () => {
    const state = createPromptState({
      selectedMode: 'video',
      currentAIIndex: 2,
      promptOptimizer: {
        ...createPromptState().promptOptimizer,
        inputPrompt: 'Video prompt',
      },
    });
    mockUsePromptState.mockReturnValue(state);

    const aiNames = ['ModelA', 'ModelB'];
    render(
      <PromptInputSection
        aiNames={aiNames}
        onOptimize={onOptimize}
        onShowBrainstorm={onShowBrainstorm}
      />
    );

    const passedProps = mockPromptInput.mock.calls[0]?.[0];
    expect(passedProps?.aiNames).toBe(aiNames);
    expect(passedProps?.currentAIIndex).toBe(2);
    expect(passedProps?.onShowBrainstorm).toBe(onShowBrainstorm);
    expect(passedProps?.selectedMode).toBe('video');
  });
});
