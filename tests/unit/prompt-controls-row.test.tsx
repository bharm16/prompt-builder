import type React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

import { PromptControlsRow } from '@features/prompt-optimizer/components/PromptControlsRow';
import { usePromptState } from '@features/prompt-optimizer/context/PromptStateContext';
import { useCapabilities } from '@features/prompt-optimizer/hooks/useCapabilities';
import { useModelRegistry } from '@features/prompt-optimizer/hooks/useModelRegistry';

vi.mock('@promptstudio/system/components/ui/select', () => ({
  Select: ({ children, disabled }: { children: React.ReactNode; disabled?: boolean }) => (
    <div data-testid="select" data-disabled={disabled ? 'true' : 'false'}>
      {children}
    </div>
  ),
  SelectTrigger: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>{children}</button>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@features/prompt-optimizer/context/PromptStateContext', () => ({
  usePromptState: vi.fn(),
}));

vi.mock('@features/prompt-optimizer/hooks/useCapabilities', () => ({
  useCapabilities: vi.fn(),
}));

vi.mock('@features/prompt-optimizer/hooks/useModelRegistry', () => ({
  useModelRegistry: vi.fn(),
}));

const mockUsePromptState = vi.mocked(usePromptState);
const mockUseCapabilities = vi.mocked(useCapabilities);
const mockUseModelRegistry = vi.mocked(useModelRegistry);

describe('PromptControlsRow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseModelRegistry.mockReturnValue({ models: [], isLoading: false, error: null });
    mockUseCapabilities.mockReturnValue({
      schema: null,
      isLoading: false,
      error: null,
      target: { provider: 'generic', model: 'auto', label: 'Auto' },
    });
  });

  describe('error handling', () => {
    it('returns null when not in video mode', () => {
      mockUsePromptState.mockReturnValue({
        selectedMode: 'image',
        selectedModel: '',
        setSelectedModel: vi.fn(),
        generationParams: {},
        setGenerationParams: vi.fn(),
        promptOptimizer: { isProcessing: false, isRefining: false },
      } as ReturnType<typeof usePromptState>);

      const { container } = render(<PromptControlsRow />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('disables the model selector when optimizing', () => {
      mockUsePromptState.mockReturnValue({
        selectedMode: 'video',
        selectedModel: '',
        setSelectedModel: vi.fn(),
        generationParams: {},
        setGenerationParams: vi.fn(),
        promptOptimizer: { isProcessing: true, isRefining: false },
      } as ReturnType<typeof usePromptState>);

      render(<PromptControlsRow />);

      const select = screen.getByTestId('select');
      expect(select).toHaveAttribute('data-disabled', 'true');
    });
  });

  describe('core behavior', () => {
    it('labels the model selector with Auto when no model is selected', () => {
      mockUsePromptState.mockReturnValue({
        selectedMode: 'video',
        selectedModel: '',
        setSelectedModel: vi.fn(),
        generationParams: {},
        setGenerationParams: vi.fn(),
        promptOptimizer: { isProcessing: false, isRefining: false },
      } as ReturnType<typeof usePromptState>);

      render(<PromptControlsRow />);

      expect(screen.getByRole('button', { name: 'Model: Auto' })).toBeInTheDocument();
    });
  });
});
