import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { PromptControlsRow } from '@features/prompt-optimizer/components/PromptControlsRow';
import { usePromptConfig, usePromptServices } from '@features/prompt-optimizer/context/PromptStateContext';
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
  usePromptConfig: vi.fn(),
  usePromptServices: vi.fn(),
}));

vi.mock('@features/prompt-optimizer/hooks/useCapabilities', () => ({
  useCapabilities: vi.fn(),
}));

vi.mock('@features/prompt-optimizer/hooks/useModelRegistry', () => ({
  useModelRegistry: vi.fn(),
}));

const mockUsePromptConfig = vi.mocked(usePromptConfig);
const mockUsePromptServices = vi.mocked(usePromptServices);
const mockUseCapabilities = vi.mocked(useCapabilities);
const mockUseModelRegistry = vi.mocked(useModelRegistry);

const createPromptConfigState = (
  overrides: Partial<ReturnType<typeof usePromptConfig>> = {}
): ReturnType<typeof usePromptConfig> => ({
  modes: [],
  selectedMode: 'video',
  setSelectedMode: vi.fn(),
  currentMode: {
    id: 'video',
    name: 'Video Prompt',
    icon: undefined as never,
    description: 'Generate AI video prompts',
  },
  selectedModel: '',
  setSelectedModel: vi.fn(),
  generationParams: {},
  setGenerationParams: vi.fn(),
  videoTier: 'render',
  setVideoTier: vi.fn(),
  ...overrides,
});

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
    mockUsePromptServices.mockReturnValue({
      promptOptimizer: { isProcessing: false },
      promptHistory: {} as never,
    } as never);
  });

  it('returns null when not in video mode', () => {
    mockUsePromptConfig.mockReturnValue(createPromptConfigState({
      selectedMode: 'image',
    }));

    const { container } = render(<PromptControlsRow />);
    expect(container.firstChild).toBeNull();
  });

  it('disables the model selector while optimizing', () => {
    mockUsePromptServices.mockReturnValue({
      promptOptimizer: { isProcessing: true },
      promptHistory: {} as never,
    } as never);
    mockUsePromptConfig.mockReturnValue(createPromptConfigState({
      selectedMode: 'video',
    }));

    render(<PromptControlsRow />);

    const select = screen.getByTestId('select');
    expect(select).toHaveAttribute('data-disabled', 'true');
  });

  it('labels the model selector with Auto when no model is selected', () => {
    mockUsePromptConfig.mockReturnValue(createPromptConfigState({
      selectedMode: 'video',
    }));

    render(<PromptControlsRow />);

    expect(screen.getByRole('button', { name: 'Model: Auto' })).toBeInTheDocument();
  });
});
