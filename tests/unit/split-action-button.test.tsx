import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type React from 'react';

import { SplitActionButton } from '@features/prompt-optimizer/GenerationsPanel/components/SplitActionButton';

vi.mock('@promptstudio/system/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, title, value }: { children: React.ReactNode; title?: string; value?: string }) => (
    <div data-value={value} title={title}>
      {children}
    </div>
  ),
  SelectTrigger: ({ children, ...props }: { children: React.ReactNode }) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@promptstudio/system/components/ui', () => ({
  Icon: ({ icon: IconComponent }: { icon: React.ComponentType }) => <IconComponent />,
  Play: () => <span>play</span>,
  CaretDown: () => <span>caret</span>,
}));

describe('SplitActionButton', () => {
  const models = {
    'model-a': { label: 'Model A', credits: 5 },
    'model-b': { label: 'Model B', credits: 1 },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('prevents running when disabled', () => {
      const onRun = vi.fn();
      render(
        <SplitActionButton
          label="Run"
          selectedModel="model-a"
          models={models}
          onRun={onRun}
          onModelChange={vi.fn()}
          disabled
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /run run with/i }));
      expect(onRun).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('shows the select model label when no model is chosen', () => {
      render(
        <SplitActionButton
          label="Run"
          selectedModel={null}
          models={models}
          onRun={vi.fn()}
          onModelChange={vi.fn()}
        />
      );

      expect(screen.getByRole('button', { name: /select model/i })).toBeDisabled();
      expect(screen.getByText('Select model')).toBeInTheDocument();
    });
  });

  describe('core behavior', () => {
    it('invokes the run action when enabled', () => {
      const onRun = vi.fn();
      render(
        <SplitActionButton
          label="Run"
          selectedModel="model-a"
          models={models}
          onRun={onRun}
          onModelChange={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /run run with model a/i }));
      expect(onRun).toHaveBeenCalled();
    });

    it('renders model credits in item titles', () => {
      render(
        <SplitActionButton
          label="Run"
          selectedModel="model-a"
          models={models}
          onRun={vi.fn()}
          onModelChange={vi.fn()}
        />
      );

      const items = screen.getAllByText(/model/i);
      const modelB = items.find((item) => item.textContent?.includes('Model B'));
      const container = modelB?.closest('div[data-value]');
      expect(container?.getAttribute('title')).toContain('credit');
    });
  });
});
