import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { ToolRail } from '@components/ToolSidebar/components/ToolRail';
import type { User } from '@hooks/types';
import type { ActiveTool } from '@/contexts/AppShellContext';

vi.mock(
  '@utils/cn',
  () => ({
    cn: (...classes: Array<string | false | null | undefined>) =>
      classes.filter(Boolean).join(' '),
  }),
  { virtual: true }
);

const appShellState = vi.hoisted(() => ({
  activeTool: 'studio' as ActiveTool,
  setActiveTool: vi.fn(),
}));

vi.mock('@/contexts/AppShellContext', () => ({
  useAppShell: () => appShellState,
}));

const renderToolRail = (props: { activePanel: Parameters<typeof ToolRail>[0]['activePanel']; user: User | null; onPanelChange: (panel: Parameters<typeof ToolRail>[0]['activePanel']) => void; }) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: '/studio', search: '?tab=1' }]}>
      <ToolRail {...props} onCreateNew={vi.fn()} />
    </MemoryRouter>
  );

describe('ToolRail', () => {
  beforeEach(() => {
    appShellState.activeTool = 'studio';
    appShellState.setActiveTool.mockClear();
  });

  describe('error handling', () => {
    it('renders sign-in link with encoded return path for guests', () => {
      renderToolRail({
        activePanel: 'sessions',
        user: null,
        onPanelChange: vi.fn(),
      });

      const link = screen.getByRole('link', { name: 'Sign in' });
      expect(link.getAttribute('href')).toBe(
        `/signin?redirect=${encodeURIComponent('/studio?tab=1')}`
      );
      expect(screen.getByText('U')).toBeInTheDocument();
    });

    it('uses email initial when displayName is empty', () => {
      const user: User = {
        uid: 'user-1',
        email: 'test@example.com',
        displayName: '   ',
      };

      renderToolRail({
        activePanel: 'sessions',
        user,
        onPanelChange: vi.fn(),
      });

      const link = screen.getByRole('link', { name: 'Account' });
      expect(link.getAttribute('href')).toBe('/account');
      expect(screen.getByText('T')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('marks Create as active when active tool is create', () => {
      appShellState.activeTool = 'create';

      renderToolRail({
        activePanel: 'sessions',
        user: null,
        onPanelChange: vi.fn(),
      });

      const createButton = screen.getByRole('button', { name: 'Create' });
      expect(createButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('marks Chars as active when active panel is characters', () => {
      renderToolRail({
        activePanel: 'characters',
        user: null,
        onPanelChange: vi.fn(),
      });

      const charsButton = screen.getByRole('button', { name: 'Chars' });
      expect(charsButton).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('core behavior', () => {
    it('switches to create tool when Create is clicked', () => {
      const onPanelChange = vi.fn();

      renderToolRail({
        activePanel: 'sessions',
        user: null,
        onPanelChange,
      });

      const createButton = screen.getByRole('button', { name: 'Create' });
      createButton.click();

      expect(appShellState.setActiveTool).toHaveBeenCalledWith('create');
      expect(onPanelChange).toHaveBeenCalledWith('create');
    });
  });
});
