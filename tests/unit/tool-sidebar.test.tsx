import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ToolSidebar } from '@components/ToolSidebar/ToolSidebar';
import type { ToolSidebarProps, ToolPanelType } from '@components/ToolSidebar/types';
import { useSidebarAssetsDomain, useSidebarSessionsDomain } from '@components/ToolSidebar/context';
import type { Asset, AssetType } from '@shared/types/asset';
import { PROMPT_FOCUS_INTENT } from '@/features/prompt-optimizer/CanvasWorkspace/events';

const mockFeatures = vi.hoisted(() => ({
  CANVAS_FIRST_LAYOUT: true,
}));

vi.mock('@/config/features.config', () => ({
  FEATURES: mockFeatures,
}));

vi.mock('@utils/cn', () => ({
  cn: (...classes: Array<string | false | null | undefined>) =>
    classes.filter(Boolean).join(' '),
}));

vi.mock('@promptstudio/system/components/ui/sheet', () => ({
  Sheet: ({
    open,
    children,
  }: {
    open: boolean;
    children: ReactNode;
  }) => (
    <div data-testid="sheet" data-open={open ? 'true' : 'false'}>
      {open ? children : null}
    </div>
  ),
  SheetContent: ({ children }: { children: ReactNode }) => (
    <div data-testid="sheet-content">{children}</div>
  ),
}));

const sidebarState = vi.hoisted(() => ({
  activePanel: 'sessions' as ToolPanelType,
  setActivePanel: vi.fn(),
}));

const panelProps = vi.hoisted(() => ({
  sessions: null as unknown,
  characters: null as unknown,
}));

vi.mock('@components/ToolSidebar/hooks/useToolSidebarState', () => ({
  useToolSidebarState: () => sidebarState,
}));

vi.mock('@components/ToolSidebar/components/ToolRail', () => ({
  ToolRail: ({ onPanelChange }: { onPanelChange: (panel: ToolPanelType) => void }) => (
    <div data-testid="tool-rail">
      <button type="button" data-testid="rail-sessions" onClick={() => onPanelChange('sessions')}>
        sessions
      </button>
      <button type="button" data-testid="rail-studio" onClick={() => onPanelChange('studio')}>
        studio
      </button>
      <button type="button" data-testid="rail-characters" onClick={() => onPanelChange('characters')}>
        characters
      </button>
      <button type="button" data-testid="rail-styles" onClick={() => onPanelChange('styles')}>
        styles
      </button>
      <button type="button" data-testid="rail-apps" onClick={() => onPanelChange('apps')}>
        apps
      </button>
    </div>
  ),
}));

vi.mock('@components/ToolSidebar/components/ToolPanel', () => ({
  ToolPanel: ({ children }: { children: ReactNode }) => (
    <div data-testid="tool-panel">{children}</div>
  ),
}));

vi.mock('@components/ToolSidebar/components/panels/SessionsPanel', () => ({
  SessionsPanel: () => {
    panelProps.sessions = useSidebarSessionsDomain();
    return <div data-testid="sessions-panel" />;
  },
}));

vi.mock('@components/ToolSidebar/components/panels/GenerationControlsPanel', () => ({
  GenerationControlsPanel: () => <div data-testid="generation-panel" />,
}));

vi.mock('@components/ToolSidebar/components/panels/CharactersPanel', () => ({
  CharactersPanel: () => {
    panelProps.characters = useSidebarAssetsDomain();
    return <div data-testid="characters-panel" />;
  },
}));

vi.mock('@components/ToolSidebar/components/panels/StylesPanel', () => ({
  StylesPanel: () => <div data-testid="styles-panel" />,
}));

const createAsset = (overrides: Partial<Asset> = {}): Asset => ({
  id: overrides.id ?? 'asset-1',
  userId: 'user-1',
  type: overrides.type ?? 'character',
  trigger: overrides.trigger ?? '@hero',
  name: overrides.name ?? 'Hero',
  textDefinition: overrides.textDefinition ?? 'hero',
  referenceImages: [],
  usageCount: 0,
  lastUsedAt: null,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  ...overrides,
});

const createAssetsByType = (characterAssets: Asset[]): Record<AssetType, Asset[]> => ({
  character: characterAssets,
  style: [],
  location: [],
  object: [],
});

const createProps = (overrides: Partial<ToolSidebarProps> = {}): ToolSidebarProps => ({
  user: null,
  sessions: {
    history: [],
    filteredHistory: [],
    isLoadingHistory: false,
    searchQuery: '',
    onSearchChange: vi.fn(),
    onLoadFromHistory: vi.fn(),
    onCreateNew: vi.fn(),
    onDelete: vi.fn(),
  },
  promptInteraction: {
    isProcessing: false,
    isRefining: false,
    onInsertTrigger: vi.fn(),
  },
  generation: {
    onDraft: vi.fn(),
    onRender: vi.fn(),
    onImageUpload: vi.fn(),
    onStoryboard: vi.fn(),
  },
  assets: {
    assets: [],
    assetsByType: createAssetsByType([]),
    isLoadingAssets: false,
    onEditAsset: vi.fn(),
    onCreateAsset: vi.fn(),
  },
  ...overrides,
});

describe('ToolSidebar', () => {
  beforeEach(() => {
    sidebarState.activePanel = 'sessions';
    sidebarState.setActivePanel.mockClear();
    panelProps.sessions = null;
    panelProps.characters = null;
    mockFeatures.CANVAS_FIRST_LAYOUT = true;
  });

  it('renders rail-only flow without inline tool panel when canvas-first layout is enabled', () => {
    sidebarState.activePanel = 'studio';

    render(<ToolSidebar {...createProps()} />);

    expect(screen.getByTestId('tool-rail')).toBeInTheDocument();
    expect(screen.queryByTestId('tool-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('generation-panel')).not.toBeInTheDocument();
  });

  it('opens sessions, characters, and styles as sheet overlays in canvas-first mode', () => {
    const hero = createAsset({ id: 'asset-hero' });
    const assetsByType = createAssetsByType([hero]);
    const props = createProps({
      assets: {
        assets: [hero],
        assetsByType,
        isLoadingAssets: false,
        onEditAsset: vi.fn(),
        onCreateAsset: vi.fn(),
      },
    });

    sidebarState.activePanel = 'sessions';
    const { rerender } = render(<ToolSidebar {...props} />);
    expect(screen.getByTestId('sessions-panel')).toBeInTheDocument();

    sidebarState.activePanel = 'characters';
    rerender(<ToolSidebar {...props} />);
    expect(screen.getByTestId('characters-panel')).toBeInTheDocument();
    const charactersDomain = panelProps.characters as { assetsByType: Record<AssetType, Asset[]> } | null;
    expect(charactersDomain?.assetsByType.character).toBeTruthy();

    sidebarState.activePanel = 'styles';
    rerender(<ToolSidebar {...props} />);
    expect(screen.getByTestId('styles-panel')).toBeInTheDocument();
  });

  it('dispatches prompt focus intent when studio is selected from the rail in canvas-first mode', () => {
    sidebarState.activePanel = 'sessions';
    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

    render(<ToolSidebar {...createProps()} />);
    fireEvent.click(screen.getByTestId('rail-studio'));

    expect(sidebarState.setActivePanel).toHaveBeenCalledWith('studio');
    const eventTypes = dispatchEventSpy.mock.calls.map(
      ([event]) => (event as Event).type
    );
    expect(eventTypes).toContain(PROMPT_FOCUS_INTENT);
  });

  it('keeps legacy inline panel path when canvas-first layout is disabled', () => {
    mockFeatures.CANVAS_FIRST_LAYOUT = false;
    sidebarState.activePanel = 'studio';

    render(<ToolSidebar {...createProps()} />);

    expect(screen.getByTestId('tool-panel')).toBeInTheDocument();
    expect(screen.getByTestId('generation-panel')).toBeInTheDocument();
  });

  it('resolves sessions domain from grouped props', () => {
    sidebarState.activePanel = 'sessions';

    render(
      <ToolSidebar
        {...createProps({
          sessions: {
            history: [],
            filteredHistory: [],
            isLoadingHistory: false,
            searchQuery: 'find me',
            onSearchChange: vi.fn(),
            onLoadFromHistory: vi.fn(),
            onCreateNew: vi.fn(),
            onDelete: vi.fn(),
          },
        })}
      />
    );

    const sessionsProps = panelProps.sessions as { searchQuery: string } | null;
    expect(sessionsProps?.searchQuery).toBe('find me');
  });
});
