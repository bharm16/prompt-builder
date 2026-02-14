import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

import { ToolSidebar } from '@components/ToolSidebar/ToolSidebar';
import type { ToolSidebarProps, ToolPanelType } from '@components/ToolSidebar/types';
import { useSidebarAssetsDomain, useSidebarSessionsDomain } from '@components/ToolSidebar/context';
import type { Asset, AssetType } from '@shared/types/asset';

vi.mock(
  '@utils/cn',
  () => ({
    cn: (...classes: Array<string | false | null | undefined>) =>
      classes.filter(Boolean).join(' '),
  })
);

const sidebarState = vi.hoisted(() => ({
  activePanel: 'sessions' as ToolPanelType,
  setActivePanel: vi.fn(),
}));

const panelProps = vi.hoisted(() => ({
  sessions: null as unknown,
  generation: null as unknown,
  characters: null as unknown,
}));

vi.mock('@components/ToolSidebar/hooks/useToolSidebarState', () => ({
  useToolSidebarState: () => sidebarState,
}));

vi.mock('@components/ToolSidebar/components/ToolRail', () => ({
  ToolRail: () => <div data-testid="tool-rail" />,
}));

vi.mock('@components/ToolSidebar/components/panels/SessionsPanel', () => ({
  SessionsPanel: () => {
    panelProps.sessions = useSidebarSessionsDomain();
    return <div data-testid="sessions-panel" />;
  },
}));

vi.mock('@components/ToolSidebar/components/panels/GenerationControlsPanel', () => ({
  GenerationControlsPanel: (props: { onBack?: () => void }) => (
    <button type="button" data-testid="generation-panel" onClick={props.onBack}>
      Back
    </button>
  ),
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
    panelProps.generation = null;
    panelProps.characters = null;
  });

  describe('error handling', () => {
    it('renders generation controls when activePanel is studio', () => {
      sidebarState.activePanel = 'studio';

      render(<ToolSidebar {...createProps()} />);

      expect(screen.getByTestId('generation-panel')).toBeInTheDocument();
    });

    it('renders styles panel when activePanel is styles', () => {
      sidebarState.activePanel = 'styles';

      render(<ToolSidebar {...createProps()} />);

      expect(screen.getByTestId('styles-panel')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
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

      expect(screen.getByTestId('sessions-panel')).toBeInTheDocument();
      const sessionsProps = panelProps.sessions as { searchQuery: string } | null;
      expect(sessionsProps?.searchQuery).toBe('find me');
    });

    it('passes core character assets to CharactersPanel', () => {
      sidebarState.activePanel = 'characters';
      const hero = createAsset({ id: 'asset-hero' });
      const assetsByType = createAssetsByType([hero]);

      render(
        <ToolSidebar
          {...createProps({
            assets: {
              assets: [hero],
              assetsByType,
              isLoadingAssets: false,
              onEditAsset: vi.fn(),
              onCreateAsset: vi.fn(),
            },
          })}
        />
      );

      const charactersDomain = panelProps.characters as { assetsByType: Record<AssetType, Asset[]> } | null;
      expect(charactersDomain?.assetsByType.character).toBe(assetsByType.character);
    });
  });

  describe('core behavior', () => {
    it('returns to sessions when GenerationControlsPanel back is triggered', () => {
      sidebarState.activePanel = 'studio';

      render(<ToolSidebar {...createProps()} />);

      const backButton = screen.getByTestId('generation-panel');
      backButton.click();

      expect(sidebarState.setActivePanel).toHaveBeenCalledWith('sessions');
    });
  });
});
