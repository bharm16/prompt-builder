import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MainWorkspace } from '../MainWorkspace';
import type { PromptHistoryEntry } from '@hooks/usePromptHistory';

const navigateMock = vi.fn();
const setActiveToolMock = vi.fn();
const updateEntryPersistedMock = vi.fn();
const onAuthStateChangedMock = vi.fn();
let lastAppShellProps: any;

const useAppShellMock = vi.fn();
const usePromptHistoryMock = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('@/contexts/AppShellContext', () => ({
  useAppShell: () => useAppShellMock(),
}));

vi.mock('@/components/navigation/AppShell', () => ({
  AppShell: (props: any) => {
    lastAppShellProps = props;
    return <div data-testid="app-shell">{props.children}</div>;
  },
}));

vi.mock('@/features/convergence/components/ConvergenceFlow', () => ({
  ConvergenceFlow: () => <div data-testid="convergence-flow" />,
}));

vi.mock('@/features/prompt-optimizer/PromptOptimizerContainer', () => ({
  default: (props: any) => (
    <div data-testid="prompt-optimizer" data-handoff={JSON.stringify(props.convergenceHandoff)} />
  ),
}));

vi.mock('@/features/prompt-optimizer/context/GenerationControlsContext', () => ({
  GenerationControlsProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="generation-controls">{children}</div>
  ),
}));

vi.mock('@/repositories', () => ({
  getAuthRepository: () => ({
    onAuthStateChanged: onAuthStateChangedMock,
  }),
}));

vi.mock('@hooks/usePromptHistory', () => ({
  usePromptHistory: (user: unknown) => usePromptHistoryMock(user),
}));

describe('MainWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onAuthStateChangedMock.mockReturnValue(() => undefined);
    usePromptHistoryMock.mockReturnValue({
      history: [],
      filteredHistory: [],
      isLoadingHistory: false,
      searchQuery: '',
      setSearchQuery: vi.fn(),
      deleteFromHistory: vi.fn(),
      updateEntryPersisted: updateEntryPersistedMock,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('navigates to root when loading history entry without uuid', () => {
      useAppShellMock.mockReturnValue({
        activeTool: 'create',
        convergenceHandoff: null,
        setActiveTool: setActiveToolMock,
      });

      render(<MainWorkspace />);

      const entry = { id: '1', uuid: undefined } as PromptHistoryEntry;
      lastAppShellProps.onLoadFromHistory(entry);

      expect(setActiveToolMock).toHaveBeenCalledWith('studio', { skipWarning: true });
      expect(navigateMock).toHaveBeenCalledWith('/');
    });

    it('skips rename when history entry has no uuid', () => {
      useAppShellMock.mockReturnValue({
        activeTool: 'create',
        convergenceHandoff: null,
        setActiveTool: setActiveToolMock,
      });

      render(<MainWorkspace />);

      const entry = { id: '1', uuid: undefined } as PromptHistoryEntry;
      lastAppShellProps.onRename(entry, 'New Title');

      expect(updateEntryPersistedMock).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('navigates to prompt uuid when loading a history entry', () => {
      useAppShellMock.mockReturnValue({
        activeTool: 'create',
        convergenceHandoff: null,
        setActiveTool: setActiveToolMock,
      });

      render(<MainWorkspace />);

      const entry = { id: '2', uuid: 'abc123' } as PromptHistoryEntry;
      lastAppShellProps.onLoadFromHistory(entry);

      expect(setActiveToolMock).toHaveBeenCalledWith('studio', { skipWarning: true });
      expect(navigateMock).toHaveBeenCalledWith('/prompt/abc123');
    });

    it('switches to studio and navigates home when creating new prompt', () => {
      useAppShellMock.mockReturnValue({
        activeTool: 'create',
        convergenceHandoff: null,
        setActiveTool: setActiveToolMock,
      });

      render(<MainWorkspace />);

      lastAppShellProps.onCreateNew();

      expect(setActiveToolMock).toHaveBeenCalledWith('studio', { skipWarning: true });
      expect(navigateMock).toHaveBeenCalledWith('/');
    });
  });

  describe('core behavior', () => {
    it('renders Create workspace shell when active tool is create', () => {
      useAppShellMock.mockReturnValue({
        activeTool: 'create',
        convergenceHandoff: null,
        setActiveTool: setActiveToolMock,
      });

      render(<MainWorkspace />);

      expect(screen.getByTestId('generation-controls')).toBeInTheDocument();
      expect(screen.getByTestId('app-shell')).toBeInTheDocument();
      expect(screen.getByTestId('convergence-flow')).toBeInTheDocument();
    });

    it('renders Studio workspace when active tool is studio', () => {
      useAppShellMock.mockReturnValue({
        activeTool: 'studio',
        convergenceHandoff: { prompt: 'Hello' },
        setActiveTool: setActiveToolMock,
      });

      render(<MainWorkspace />);

      expect(screen.getByTestId('generation-controls')).toBeInTheDocument();
      expect(screen.queryByTestId('app-shell')).toBeNull();
      const studio = screen.getByTestId('prompt-optimizer');
      expect(studio).toHaveAttribute('data-handoff', JSON.stringify({ prompt: 'Hello' }));
    });
  });
});
