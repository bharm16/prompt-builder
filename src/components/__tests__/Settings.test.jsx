import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import Settings, { useSettings } from '../Settings.jsx';

describe('useSettings', () => {
  it('initializes with defaults and persists updates', () => {
    const Test = () => {
      const { settings, updateSetting, resetSettings } = useSettings();
      return (
        <div>
          <div data-testid="dark">{String(settings.darkMode)}</div>
          <div data-testid="font">{settings.fontSize}</div>
          <button onClick={() => updateSetting('fontSize', 'large')}>set</button>
          <button onClick={() => resetSettings()}>reset</button>
        </div>
      );
    };
    render(<Test />);
    expect(screen.getByTestId('dark').textContent).toBe('false');
    expect(screen.getByTestId('font').textContent).toBe('medium');

    fireEvent.click(screen.getByText('set'));
    expect(screen.getByTestId('font').textContent).toBe('large');

    fireEvent.click(screen.getByText('reset'));
    expect(screen.getByTestId('font').textContent).toBe('medium');
  });
});

describe('Settings component', () => {
  it('renders when open and handles toggles', () => {
    const settings = { darkMode: false, fontSize: 'medium', autoSave: true, exportFormat: 'markdown' };
    const updateSetting = vi.fn();
    const onClose = vi.fn();
    render(
      <Settings
        isOpen
        onClose={onClose}
        settings={settings}
        updateSetting={updateSetting}
        resetSettings={vi.fn()}
        onClearAllData={vi.fn()}
      />
    );
    const title = screen.getByRole('heading', { name: /settings/i });
    expect(title).toBeInTheDocument();

    const darkToggle = screen.getByRole('switch', { name: /dark mode/i });
    fireEvent.click(darkToggle);
    expect(updateSetting).toHaveBeenCalledWith('darkMode', true);

    const done = screen.getByRole('button', { name: /done/i });
    fireEvent.click(done);
    expect(onClose).toHaveBeenCalled();
  });
});
