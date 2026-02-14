import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { Asset } from '@shared/types/asset';
import { PromptOptimizerWorkspaceView } from '../PromptOptimizerWorkspaceView';

vi.mock('@components/navigation/AppShell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));

vi.mock('../../../layouts/PromptResultsLayout', () => ({
  PromptResultsLayout: () => <div data-testid="prompt-results-layout" />,
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

vi.mock('@components/DebugButton', () => ({
  default: () => <div data-testid="debug-button" />,
}));

const createAsset = (id: string): Asset => ({
  id,
  userId: 'user-1',
  type: 'character',
  trigger: '@hero',
  name: 'Hero',
  textDefinition: 'hero',
  referenceImages: [],
  usageCount: 0,
  lastUsedAt: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
});

const buildProps = () =>
  ({
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
      onCreate: vi.fn(async () => createAsset('asset-1')),
      onUpdate: vi.fn(async () => createAsset('asset-1')),
      onAddImage: vi.fn(async () => undefined),
      onDeleteImage: vi.fn(async () => undefined),
      onSetPrimaryImage: vi.fn(async () => undefined),
    },
    detectedAssetsPrompt: '',
    detectedAssets: [],
    onEditAsset: vi.fn(),
    onCreateFromTrigger: vi.fn(),
    debugProps: {
      enabled: false,
      inputPrompt: '',
      displayedPrompt: '',
      optimizedPrompt: '',
      selectedMode: 'video',
      promptContext: null,
    },
  });

describe('PromptOptimizerWorkspaceView', () => {
  it('always renders prompt results layout when not loading', () => {
    render(<PromptOptimizerWorkspaceView {...buildProps()} />);

    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    expect(screen.getByTestId('prompt-results-layout')).toBeInTheDocument();
    expect(screen.queryByText('Loading prompt...')).not.toBeInTheDocument();
  });

  it('renders loading state while prompt is loading', () => {
    const props = buildProps();
    render(<PromptOptimizerWorkspaceView {...props} shouldShowLoading />);

    expect(screen.getByText('Loading prompt...')).toBeInTheDocument();
    expect(screen.queryByTestId('prompt-results-layout')).not.toBeInTheDocument();
  });

  it('renders debug button when debug mode is enabled', () => {
    const props = buildProps();
    render(
      <PromptOptimizerWorkspaceView
        {...props}
        debugProps={{ ...props.debugProps, enabled: true }}
      />
    );

    expect(screen.getByTestId('debug-button')).toBeInTheDocument();
  });
});
