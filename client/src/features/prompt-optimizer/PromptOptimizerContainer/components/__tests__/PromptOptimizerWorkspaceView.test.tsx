import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { PromptOptimizerWorkspaceView } from '../PromptOptimizerWorkspaceView';

const useWorkspaceSessionMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());

vi.mock('@components/navigation/AppShell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));

vi.mock('../../../layouts/PromptResultsLayout', () => ({
  PromptResultsLayout: () => <div data-testid="prompt-results-layout" />,
}));

vi.mock('../../../components/SequenceWorkspace', () => ({
  SequenceWorkspace: () => <div data-testid="sequence-workspace" />,
}));

vi.mock('../../../components/PromptModals', () => ({
  PromptModals: () => null,
}));

vi.mock('../../../components/QuickCharacterCreate', () => ({
  QuickCharacterCreate: () => null,
}));

vi.mock('../../../components/DetectedAssets', () => ({
  DetectedAssets: () => null,
}));

vi.mock('@features/assets/components/AssetEditor', () => ({
  default: () => null,
}));

vi.mock('../../../context/WorkspaceSessionContext', () => ({
  useWorkspaceSession: () => useWorkspaceSessionMock(),
}));

vi.mock('@components/Toast', () => ({
  useToast: () => ({ error: toastErrorMock }),
}));

vi.mock('@components/DebugButton', () => ({
  default: () => null,
}));

const buildProps = () =>
  ({
    toolSidebarProps: {
      prompt: 'Shot prompt',
      onPromptChange: vi.fn(),
      onOptimize: vi.fn(),
      isProcessing: false,
      isRefining: false,
    },
    showHistory: false,
    onToggleHistory: vi.fn(),
    shouldShowLoading: false,
    promptModalsProps: {
      onImprovementComplete: vi.fn(),
      onConceptComplete: vi.fn(),
      onSkipBrainstorm: vi.fn(),
    },
    quickCreateState: { isOpen: false },
    onQuickCreateClose: vi.fn(),
    onQuickCreateComplete: vi.fn(),
    assetEditorState: null,
    assetEditorHandlers: {
      onClose: vi.fn(),
      onCreate: vi.fn(async () => ({ id: 'asset-1' })),
      onUpdate: vi.fn(async () => ({ id: 'asset-1' })),
      onAddImage: vi.fn(async () => undefined),
      onDeleteImage: vi.fn(async () => undefined),
      onSetPrimaryImage: vi.fn(async () => undefined),
    },
    detectedAssetsPrompt: '',
    detectedAssets: [],
    onEditAsset: vi.fn(),
    onCreateFromTrigger: vi.fn(),
    promptResultsLayoutProps: {} as any,
    debugProps: {
      enabled: false,
      inputPrompt: '',
      displayedPrompt: '',
      optimizedPrompt: '',
      selectedMode: 'video',
      promptContext: null,
    },
  }) as any;

describe('PromptOptimizerWorkspaceView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders sequence workspace when sequence mode is active with shots', () => {
    useWorkspaceSessionMock.mockReturnValue({
      shots: [{ id: 'shot-1', sequenceIndex: 0 }],
      isSequenceMode: true,
      setCurrentShotId: vi.fn(),
      addShot: vi.fn(async () => ({ id: 'shot-2' })),
    });

    render(<PromptOptimizerWorkspaceView {...buildProps()} />);

    expect(screen.getByTestId('sequence-workspace')).toBeInTheDocument();
    expect(screen.queryByTestId('prompt-results-layout')).not.toBeInTheDocument();
  });

  it('renders prompt results layout when sequence mode is disabled', () => {
    useWorkspaceSessionMock.mockReturnValue({
      shots: [],
      isSequenceMode: false,
      setCurrentShotId: vi.fn(),
      addShot: vi.fn(async () => ({ id: 'shot-2' })),
    });

    render(<PromptOptimizerWorkspaceView {...buildProps()} />);

    expect(screen.getByTestId('prompt-results-layout')).toBeInTheDocument();
    expect(screen.queryByTestId('sequence-workspace')).not.toBeInTheDocument();
  });
});
