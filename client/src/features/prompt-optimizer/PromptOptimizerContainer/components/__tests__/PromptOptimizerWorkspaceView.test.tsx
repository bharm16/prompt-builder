import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { PromptOptimizerWorkspaceView } from '../PromptOptimizerWorkspaceView';

const useWorkspaceSessionMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());
const navigateMock = vi.hoisted(() => vi.fn());
const locationMock = vi.hoisted(() => vi.fn(() => ({ search: '' })));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useLocation: () => locationMock(),
  };
});

vi.mock('@components/navigation/AppShell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));

vi.mock('../../../layouts/PromptResultsLayout', () => ({
  PromptResultsLayout: () => <div data-testid="prompt-results-layout" />,
}));

vi.mock('../../../components/SequenceWorkspace', () => ({
  SequenceWorkspace: ({ onExitSequence }: { onExitSequence?: () => void }) => (
    <button type="button" data-testid="sequence-workspace" onClick={onExitSequence}>
      Sequence workspace
    </button>
  ),
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
    locationMock.mockReturnValue({ search: '' });
  });

  it('renders sequence workspace when sequence mode is active with shots', () => {
    useWorkspaceSessionMock.mockReturnValue({
      session: null,
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
      session: null,
      shots: [],
      isSequenceMode: false,
      setCurrentShotId: vi.fn(),
      addShot: vi.fn(async () => ({ id: 'shot-2' })),
    });

    render(<PromptOptimizerWorkspaceView {...buildProps()} />);

    expect(screen.getByTestId('prompt-results-layout')).toBeInTheDocument();
    expect(screen.queryByTestId('sequence-workspace')).not.toBeInTheDocument();
  });

  it('navigates to origin session when sequence workspace exits sequence mode', async () => {
    const user = userEvent.setup();
    const props = buildProps();
    props.toolSidebarProps.history = [
      {
        id: 'continuity-1',
        input: 'Current sequence session',
        output: '',
        versions: [{ versionId: 'v-1', signature: 'sig-1', prompt: '', timestamp: '2026-02-12T00:00:00.000Z' }],
      },
      {
        id: 'source-1',
        input: 'Source session',
        output: '',
        versions: [
          {
            versionId: 'v-2',
            signature: 'sig-2',
            prompt: '',
            timestamp: '2026-02-12T00:00:00.000Z',
            video: { generatedAt: '2026-02-12T00:00:00.000Z', assetId: 'asset-video-1' },
          },
        ],
      },
    ];

    useWorkspaceSessionMock.mockReturnValue({
      session: {
        id: 'continuity-1',
        continuity: {
          primaryStyleReference: null,
        },
      },
      shots: [{ id: 'shot-1', sequenceIndex: 0, videoAssetId: 'asset-video-1' }],
      isSequenceMode: true,
      setCurrentShotId: vi.fn(),
      addShot: vi.fn(async () => ({ id: 'shot-2' })),
    });

    render(<PromptOptimizerWorkspaceView {...props} />);

    await user.click(screen.getByTestId('sequence-workspace'));

    expect(navigateMock).toHaveBeenCalledWith('/session/source-1');
  });

  it('falls back to root when no origin session can be resolved', async () => {
    const user = userEvent.setup();

    useWorkspaceSessionMock.mockReturnValue({
      session: {
        id: 'continuity-1',
        continuity: {
          primaryStyleReference: null,
        },
      },
      shots: [{ id: 'shot-1', sequenceIndex: 0, videoAssetId: 'asset-video-1' }],
      isSequenceMode: true,
      setCurrentShotId: vi.fn(),
      addShot: vi.fn(async () => ({ id: 'shot-2' })),
    });

    render(<PromptOptimizerWorkspaceView {...buildProps()} />);

    await user.click(screen.getByTestId('sequence-workspace'));

    expect(navigateMock).toHaveBeenCalledWith('/');
  });

  it('uses originSessionId query param when exiting sequence', async () => {
    const user = userEvent.setup();
    locationMock.mockReturnValue({ search: '?originSessionId=source-from-query' });

    useWorkspaceSessionMock.mockReturnValue({
      session: {
        id: 'continuity-1',
        continuity: {
          primaryStyleReference: null,
        },
      },
      shots: [{ id: 'shot-1', sequenceIndex: 0, videoAssetId: 'asset-video-1' }],
      isSequenceMode: true,
      setCurrentShotId: vi.fn(),
      addShot: vi.fn(async () => ({ id: 'shot-2' })),
    });

    render(<PromptOptimizerWorkspaceView {...buildProps()} />);

    await user.click(screen.getByTestId('sequence-workspace'));

    expect(navigateMock).toHaveBeenCalledWith('/session/source-from-query');
  });

  it('falls back to sidebar currentPromptDocId when query/history origin is unavailable', async () => {
    const user = userEvent.setup();
    const props = buildProps();
    props.toolSidebarProps.currentPromptDocId = 'source-from-sidebar';

    useWorkspaceSessionMock.mockReturnValue({
      session: {
        id: 'continuity-1',
        continuity: {
          primaryStyleReference: null,
        },
      },
      shots: [{ id: 'shot-1', sequenceIndex: 0, videoAssetId: 'asset-video-1' }],
      isSequenceMode: true,
      setCurrentShotId: vi.fn(),
      addShot: vi.fn(async () => ({ id: 'shot-2' })),
    });

    render(<PromptOptimizerWorkspaceView {...props} />);

    await user.click(screen.getByTestId('sequence-workspace'));

    expect(navigateMock).toHaveBeenCalledWith('/session/source-from-sidebar');
  });
});
