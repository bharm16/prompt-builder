import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MainWorkspace } from '../MainWorkspace';

const useAppShellMock = vi.fn();
const promptOptimizerMock = vi.fn();

vi.mock('@/contexts/AppShellContext', () => ({
  useAppShell: () => useAppShellMock(),
}));

vi.mock('@/features/prompt-optimizer/PromptOptimizerContainer', () => ({
  default: (props: { convergenceHandoff: unknown }) => {
    promptOptimizerMock(props);
    return (
      <div
        data-testid="prompt-optimizer"
        data-handoff={JSON.stringify(props.convergenceHandoff)}
      />
    );
  },
}));

vi.mock('@/features/prompt-optimizer/context/GenerationControlsContext', () => ({
  GenerationControlsProvider: ({ children }: { children: ReactNode }) => (
    <div data-testid="generation-controls">{children}</div>
  ),
}));

describe('MainWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders workspace and passes convergence handoff', () => {
    useAppShellMock.mockReturnValue({
      convergenceHandoff: { prompt: 'Hello' },
    });

    render(<MainWorkspace />);

    expect(screen.getByTestId('generation-controls')).toBeInTheDocument();
    const workspace = screen.getByTestId('prompt-optimizer');
    expect(workspace).toHaveAttribute('data-handoff', JSON.stringify({ prompt: 'Hello' }));
    expect(promptOptimizerMock).toHaveBeenCalledWith(
      expect.objectContaining({ convergenceHandoff: { prompt: 'Hello' } })
    );
  });
});
