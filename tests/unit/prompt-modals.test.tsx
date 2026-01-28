import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { PromptModals } from '@features/prompt-optimizer/components/PromptModals';
import { usePromptState } from '@features/prompt-optimizer/context/PromptStateContext';
import { useSettings } from '@components/Settings';

vi.mock('@features/prompt-optimizer/context/PromptStateContext', () => ({
  usePromptState: vi.fn(),
}));

vi.mock('@components/Settings', () => ({
  __esModule: true,
  default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => (
    <div>
      <span>Settings Open: {isOpen ? 'yes' : 'no'}</span>
      <button type="button" onClick={onClose}>Close Settings</button>
    </div>
  ),
  useSettings: vi.fn(),
}));

vi.mock('@components/KeyboardShortcuts', () => ({
  __esModule: true,
  default: ({ isOpen }: { isOpen: boolean }) => (
    <div>Shortcuts Open: {isOpen ? 'yes' : 'no'}</div>
  ),
}));

vi.mock('@/PromptImprovementForm', () => ({
  __esModule: true,
  default: ({ initialPrompt }: { initialPrompt: string }) => (
    <div>Improver: {initialPrompt}</div>
  ),
}));

const mockUsePromptState = vi.mocked(usePromptState);
const mockUseSettings = vi.mocked(useSettings);

describe('PromptModals', () => {
  describe('error handling', () => {
    it('renders settings closed when showSettings is false', () => {
      mockUsePromptState.mockReturnValue({
        showSettings: false,
        setShowSettings: vi.fn(),
        showShortcuts: false,
        setShowShortcuts: vi.fn(),
        showImprover: false,
        setShowImprover: vi.fn(),
        promptOptimizer: { inputPrompt: 'hello' },
        promptHistory: { clearHistory: vi.fn() },
      } as ReturnType<typeof usePromptState>);

      mockUseSettings.mockReturnValue({
        settings: {},
        updateSetting: vi.fn(),
        resetSettings: vi.fn(),
      } as ReturnType<typeof useSettings>);

      render(<PromptModals />);

      expect(screen.getByText('Settings Open: no')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('renders keyboard shortcuts when enabled', () => {
      mockUsePromptState.mockReturnValue({
        showSettings: false,
        setShowSettings: vi.fn(),
        showShortcuts: true,
        setShowShortcuts: vi.fn(),
        showImprover: false,
        setShowImprover: vi.fn(),
        promptOptimizer: { inputPrompt: 'hello' },
        promptHistory: { clearHistory: vi.fn() },
      } as ReturnType<typeof usePromptState>);

      mockUseSettings.mockReturnValue({
        settings: {},
        updateSetting: vi.fn(),
        resetSettings: vi.fn(),
      } as ReturnType<typeof useSettings>);

      render(<PromptModals />);

      expect(screen.getByText('Shortcuts Open: yes')).toBeInTheDocument();
    });
  });

  describe('core behavior', () => {
    it('renders improvement form with the current prompt', async () => {
      const setShowSettings = vi.fn();

      mockUsePromptState.mockReturnValue({
        showSettings: true,
        setShowSettings,
        showShortcuts: false,
        setShowShortcuts: vi.fn(),
        showImprover: true,
        setShowImprover: vi.fn(),
        promptOptimizer: { inputPrompt: 'hello world' },
        promptHistory: { clearHistory: vi.fn() },
      } as ReturnType<typeof usePromptState>);

      mockUseSettings.mockReturnValue({
        settings: {},
        updateSetting: vi.fn(),
        resetSettings: vi.fn(),
      } as ReturnType<typeof useSettings>);

      render(<PromptModals />);

      expect(screen.getByText('Improver: hello world')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Close Settings', hidden: true }));
      expect(setShowSettings).toHaveBeenCalledWith(false);
    });
  });
});
