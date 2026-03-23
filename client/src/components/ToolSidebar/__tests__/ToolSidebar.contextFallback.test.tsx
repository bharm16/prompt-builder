import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ToolSidebar } from '../ToolSidebar';
import type { ToolPanelType } from '../types';

const sidebarState = vi.hoisted(() => ({
  activePanel: 'sessions' as ToolPanelType,
  setActivePanel: vi.fn(),
}));

vi.mock('@components/ToolSidebar/hooks/useToolSidebarState', () => ({
  useToolSidebarState: () => sidebarState,
}));

vi.mock('@components/ToolSidebar/components/ToolRail', () => ({
  ToolRail: () => <div data-testid="tool-rail" />,
}));

vi.mock('@components/ToolSidebar/components/panels/SessionsPanel', async () => {
  const { useSidebarSessionsDomain } = await vi.importActual<
    typeof import('@components/ToolSidebar/context')
  >('@components/ToolSidebar/context');
  return {
    SessionsPanel: () => {
      const domain = useSidebarSessionsDomain();
      return <div data-testid="sessions-query">{domain?.searchQuery ?? 'none'}</div>;
    },
  };
});

vi.mock('@components/ToolSidebar/components/panels/GenerationControlsPanel', () => ({
  GenerationControlsPanel: () => <div data-testid="generation-panel" />,
}));

vi.mock('@components/ToolSidebar/components/panels/CharactersPanel', () => ({
  CharactersPanel: () => <div data-testid="characters-panel" />,
}));

vi.mock('@components/ToolSidebar/components/panels/StylesPanel', () => ({
  StylesPanel: () => <div data-testid="styles-panel" />,
}));

describe('ToolSidebar context fallback', () => {
  beforeEach(() => {
    sidebarState.activePanel = 'sessions';
    sidebarState.setActivePanel.mockClear();
  });

  it('renders degraded sessions state without SidebarDataContext provider', () => {
    render(<ToolSidebar user={null} />);

    expect(screen.getByTestId('tool-rail')).toBeInTheDocument();
    expect(screen.getByTestId('tool-sidebar-overlay-panel')).toBeInTheDocument();
    expect(screen.getByTestId('sessions-query')).toHaveTextContent('none');
  });
});
