import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContinuityIntentPicker } from '../ContinuityIntentPicker';

describe('ContinuityIntentPicker', () => {
  it('maps intent buttons to continuity modes', async () => {
    const onModeChange = vi.fn();

    render(
      <ContinuityIntentPicker
        mode="frame-bridge"
        onModeChange={onModeChange}
        strength={0.7}
        onStrengthChange={vi.fn()}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /new angle, same look/i }));
    expect(onModeChange).toHaveBeenCalledWith('style-match');

    await userEvent.click(screen.getByRole('button', { name: /independent/i }));
    expect(onModeChange).toHaveBeenCalledWith('none');
  });

  it('treats native and none as independent and disables strength controls', () => {
    const { rerender } = render(
      <ContinuityIntentPicker
        mode="native"
        onModeChange={vi.fn()}
        strength={0.4}
        onStrengthChange={vi.fn()}
      />
    );

    expect(screen.getByText('Continuity strength')).toBeInTheDocument();
    expect(screen.getByRole('slider')).toBeDisabled();

    rerender(
      <ContinuityIntentPicker
        mode="none"
        onModeChange={vi.fn()}
        strength={0.4}
        onStrengthChange={vi.fn()}
      />
    );

    expect(screen.getByRole('slider')).toBeDisabled();
  });
});
