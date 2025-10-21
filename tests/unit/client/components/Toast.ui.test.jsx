import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Note: Skipped due to ESM loader + global mocks in setup.
// Keeping for reference; enable if setup stops mocking Toast globally.
describe.skip('Toast UI (real component)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders alert and closes on click', async () => {
    // Dynamically import real Toast component bypassing project mock
    const mod = await import(new URL('../Toast.jsx', import.meta.url));
    const Toast = mod.default;

    const onClose = vi.fn();
    render(<Toast id={1} message="Hello" type="info" onClose={onClose} />);

    const alert = await screen.findByRole('alert');
    expect(alert).toBeInTheDocument();

    const close = screen.getByRole('button', { name: /close notification/i });
    fireEvent.click(close);
    vi.advanceTimersByTime(220);
    expect(onClose).toHaveBeenCalled();
  });
});
