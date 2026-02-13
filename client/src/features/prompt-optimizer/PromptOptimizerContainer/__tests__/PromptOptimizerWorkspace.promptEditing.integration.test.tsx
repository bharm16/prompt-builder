import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import PromptOptimizerWorkspace from '../PromptOptimizerWorkspace';

const capturedViewProps = vi.hoisted(() => ({ current: null as any }));
const workspaceSessionState = vi.hoisted(() => ({
  isSequenceMode: true,
  currentShotId: 'shot-1',
  currentShot: null,
  updateShot: vi.fn(async () => undefined),
}));
const promptOptimizerState = vi.hoisted(() => ({
  inputPrompt: 'initial prompt',
  displayedPrompt: 'existing output',
  optimizedPrompt: '',
  genericOptimizedPrompt: null,
  isProcessing: false,
  isRefining: false,
  setInputPrompt: vi.fn((nextPrompt: string) => {
    promptOptimizerState.inputPrompt = nextPrompt;
  }),
}));
const promptStateSetters = vi.hoisted(() => ({
  setShowResults: vi.fn(),
  setDisplayedPromptSilently: vi.fn((nextPrompt: string) => {
    promptOptimizerState.displayedPrompt = nextPrompt;
  }),
}));

vi.mock('@hooks/useAuthUser', () => ({
  useAuthUser: () => null,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useLocation: () => ({ pathname: '/', search: '', hash: '' }),
    useParams: () => ({}),
  };
});

vi.mock('@components/KeyboardShortcuts', () => ({
  useKeyboardShortcuts: vi.fn(),
}));

vi.mock('@components/Toast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  }),
}));

vi.mock('../../components/AssetsSidebar', () => ({
  useAssetsSidebar: () => ({
    assets: [],
    byType: { character: [], style: [], location: [], object: [] },
    isLoading: false,
    refresh: vi.fn(async () => undefined),
  }),
}));

vi.mock('../../context/PromptStateContext', () => ({
  PromptStateProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  usePromptState: () => ({
    selectedMode: 'video',
    selectedModel: 'wan-2.2',
    setSelectedModel: vi.fn(),
    generationParams: {},
    setGenerationParams: vi.fn(),
    showResults: true,
    showSettings: false,
    setShowSettings: vi.fn(),
    showShortcuts: false,
    setShowShortcuts: vi.fn(),
    showHistory: false,
    setShowHistory: vi.fn(),
    showImprover: false,
    setShowImprover: vi.fn(),
    showBrainstorm: false,
    setShowBrainstorm: vi.fn(),
    suggestionsData: null,
    setSuggestionsData: vi.fn(),
    setConceptElements: vi.fn(),
    promptContext: null,
    setPromptContext: vi.fn(),
    currentPromptUuid: 'uuid-1',
    currentPromptDocId: 'doc-1',
    setCurrentPromptUuid: vi.fn(),
    setCurrentPromptDocId: vi.fn(),
    setShowResults: promptStateSetters.setShowResults,
    setCanUndo: vi.fn(),
    setCanRedo: vi.fn(),
    latestHighlightRef: { current: null },
    persistedSignatureRef: { current: null },
    registerPromptEdit: vi.fn(),
    resetVersionEdits: vi.fn(),
    undoStackRef: { current: [] },
    redoStackRef: { current: [] },
    isApplyingHistoryRef: { current: false },
    skipLoadFromUrlRef: { current: false },
    promptOptimizer: promptOptimizerState,
    promptHistory: {
      history: [],
      filteredHistory: [],
      isLoadingHistory: false,
      searchQuery: '',
      setSearchQuery: vi.fn(),
      deleteFromHistory: vi.fn(),
      updateEntryOutput: vi.fn(),
    },
    applyInitialHighlightSnapshot: vi.fn(),
    resetEditStacks: vi.fn(),
    setDisplayedPromptSilently: promptStateSetters.setDisplayedPromptSilently,
    handleCreateNew: vi.fn(),
    setOutputSaveState: vi.fn(),
    setOutputLastSavedAt: vi.fn(),
    navigate: vi.fn(),
    sessionId: null,
  }),
}));

vi.mock('../../context/GenerationControlsStore', () => ({
  useGenerationControlsStoreState: () => ({
    domain: {
      keyframes: [],
      startFrame: null,
      cameraMotion: null,
      subjectMotion: '',
    },
  }),
  useGenerationControlsStoreActions: () => ({
    setKeyframes: vi.fn(),
    addKeyframe: vi.fn(),
    setStartFrame: vi.fn(),
    clearStartFrame: vi.fn(),
    setCameraMotion: vi.fn(),
    setSubjectMotion: vi.fn(),
  }),
}));

vi.mock('../../context/WorkspaceSessionContext', () => ({
  WorkspaceSessionProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useWorkspaceSession: () => workspaceSessionState,
}));

vi.mock('../../hooks/useI2VContext', () => ({
  useI2VContext: () => ({
    startImageUrl: null,
    startImageSourcePrompt: null,
    constraintMode: 'strict',
  }),
}));

vi.mock('../hooks', () => ({
  usePromptLoader: () => ({ isLoading: false }),
  useHighlightsPersistence: () => ({ handleHighlightsPersist: vi.fn() }),
  useUndoRedo: () => ({
    handleUndo: vi.fn(),
    handleRedo: vi.fn(),
    handleDisplayedPromptChange: vi.fn(),
  }),
  usePromptOptimization: () => ({
    handleOptimize: vi.fn(async () => undefined),
  }),
  useImprovementFlow: () => ({
    handleImproveFirst: vi.fn(),
    handleImprovementComplete: vi.fn(),
  }),
  useConceptBrainstorm: () => ({
    handleConceptComplete: vi.fn(),
    handleSkipBrainstorm: vi.fn(),
  }),
  useEnhancementSuggestions: () => ({
    fetchEnhancementSuggestions: vi.fn(),
    handleSuggestionClick: vi.fn(),
  }),
  usePromptKeyframesSync: () => ({
    serializedKeyframes: [],
    onLoadKeyframes: vi.fn(),
  }),
  useStablePromptContext: () => null,
  usePromptCoherence: () => ({
    issues: [],
    isChecking: false,
    isPanelExpanded: false,
    setIsPanelExpanded: vi.fn(),
    affectedSpanIds: new Set<string>(),
    spanIssueMap: new Map<string, 'conflict' | 'harmonization'>(),
    runCheck: vi.fn(),
    dismissIssue: vi.fn(),
    dismissAll: vi.fn(),
    applyFix: vi.fn(),
  }),
  useAssetManagement: () => ({
    assetEditorState: null,
    quickCreateState: { isOpen: false },
    handlers: {
      onEditAsset: vi.fn(),
      onCreateAsset: vi.fn(),
      onCreateFromTrigger: vi.fn(),
      onCloseAssetEditor: vi.fn(),
      onCloseQuickCreate: vi.fn(),
      onQuickCreateComplete: vi.fn(async () => undefined),
      onCreate: vi.fn(async () => ({})),
      onUpdate: vi.fn(async () => ({})),
      onAddImage: vi.fn(async () => undefined),
      onDeleteImage: vi.fn(async () => undefined),
      onSetPrimaryImage: vi.fn(async () => undefined),
    },
  }),
  useSequenceShotPromptSync: vi.fn(),
}));

vi.mock('../../context/PromptResultsActionsContext', () => ({
  PromptResultsActionsProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('../providers/sidebar', () => ({
  SidebarSessionsProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  SidebarAssetsProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  SidebarPromptEditingProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  SidebarGenerationProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('../components/PromptOptimizerWorkspaceView', () => ({
  PromptOptimizerWorkspaceView: (props: unknown) => {
    capturedViewProps.current = props;
    return <div data-testid="workspace-view" />;
  },
}));

describe('PromptOptimizerWorkspace prompt editing integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    promptOptimizerState.inputPrompt = 'initial prompt';
    promptOptimizerState.displayedPrompt = 'existing output';
    workspaceSessionState.isSequenceMode = true;
    workspaceSessionState.currentShotId = 'shot-1';
    workspaceSessionState.updateShot.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('updates input, clears displayed output/results, and debounces sequence shot sync', async () => {
    render(<PromptOptimizerWorkspace />);

    const onPromptChange =
      capturedViewProps.current.sequenceWorkspaceProps.onPromptChange;

    act(() => {
      onPromptChange('next prompt');
    });

    expect(promptOptimizerState.setInputPrompt).toHaveBeenCalledWith('next prompt');
    expect(promptStateSetters.setDisplayedPromptSilently).toHaveBeenCalledWith('');
    expect(promptStateSetters.setShowResults).toHaveBeenCalledWith(false);
    expect(workspaceSessionState.updateShot).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(workspaceSessionState.updateShot).toHaveBeenCalledWith('shot-1', { prompt: 'next prompt' });
  });

  it('cancels pending sequence sync on unmount', async () => {
    const { unmount } = render(<PromptOptimizerWorkspace />);

    const onPromptChange =
      capturedViewProps.current.sequenceWorkspaceProps.onPromptChange;

    act(() => {
      onPromptChange('unmount prompt');
    });

    unmount();

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(workspaceSessionState.updateShot).not.toHaveBeenCalled();
  });
});
