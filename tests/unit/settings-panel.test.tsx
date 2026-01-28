/**
 * Unit tests for Settings component
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

import Settings from '@components/Settings/Settings';
import type { AppSettings } from '@components/Settings/types';

vi.mock('@promptstudio/system/components/ui/button', () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock('@promptstudio/system/components/ui/card', () => ({
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@promptstudio/system/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock('@promptstudio/system/components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange, ...props }: { checked?: boolean; onCheckedChange?: (value: boolean) => void }) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange?.(!checked)}
      {...props}
    />
  ),
}));

const baseSettings: AppSettings = {
  darkMode: false,
  fontSize: 'medium',
  autoSave: true,
  exportFormat: 'markdown',
};

describe('Settings', () => {
  describe('error handling', () => {
    it('handles missing clear data handler gracefully', async () => {
      const user = userEvent.setup();
      render(
        <Settings
          isOpen
          onClose={vi.fn()}
          settings={baseSettings}
          updateSetting={vi.fn()}
          resetSettings={vi.fn()}
        />
      );

      await user.click(screen.getByText('Clear All Data'));
      expect(
        screen.getByText('Are you sure? This will permanently delete all your saved prompts and history.')
      ).toBeInTheDocument();

      await user.click(screen.getByText('Yes, Delete All'));
      expect(
        screen.queryByText('Are you sure? This will permanently delete all your saved prompts and history.')
      ).not.toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('renders nothing when closed', () => {
      const { container } = render(
        <Settings
          isOpen={false}
          onClose={vi.fn()}
          settings={baseSettings}
          updateSetting={vi.fn()}
          resetSettings={vi.fn()}
        />
      );

      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('core behavior', () => {
    it('updates settings via toggles and selectors', async () => {
      const user = userEvent.setup();
      const updateSetting = vi.fn();

      render(
        <Settings
          isOpen
          onClose={vi.fn()}
          settings={baseSettings}
          updateSetting={updateSetting}
          resetSettings={vi.fn()}
        />
      );

      await user.click(screen.getByLabelText('Toggle dark mode'));
      expect(updateSetting).toHaveBeenCalledWith('darkMode', true);

      await user.click(screen.getByText('Large'));
      expect(updateSetting).toHaveBeenCalledWith('fontSize', 'large');
    });

    it('confirms and executes reset settings', async () => {
      const user = userEvent.setup();
      const resetSettings = vi.fn();

      render(
        <Settings
          isOpen
          onClose={vi.fn()}
          settings={baseSettings}
          updateSetting={vi.fn()}
          resetSettings={resetSettings}
        />
      );

      await user.click(screen.getByText('Reset Settings to Default'));
      expect(
        screen.getByText('Are you sure? This will reset all settings to their default values.')
      ).toBeInTheDocument();

      await user.click(screen.getByText('Yes, Reset'));

      expect(resetSettings).toHaveBeenCalled();
      expect(
        screen.queryByText('Are you sure? This will reset all settings to their default values.')
      ).not.toBeInTheDocument();
    });

    it('invokes clear data handler when confirmed', async () => {
      const user = userEvent.setup();
      const onClearAllData = vi.fn();

      render(
        <Settings
          isOpen
          onClose={vi.fn()}
          settings={baseSettings}
          updateSetting={vi.fn()}
          resetSettings={vi.fn()}
          onClearAllData={onClearAllData}
        />
      );

      await user.click(screen.getByText('Clear All Data'));
      await user.click(screen.getByText('Yes, Delete All'));

      expect(onClearAllData).toHaveBeenCalled();
    });
  });
});
