import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrengthSlider } from '../StrengthSlider';

describe('StrengthSlider', () => {
  it('renders a custom label when provided', () => {
    render(<StrengthSlider value={0.6} onChange={vi.fn()} label="Temporal match" />);
    expect(screen.getByText('Temporal match')).toBeInTheDocument();
  });

  it('calls onChange when preset is clicked', async () => {
    const onChange = vi.fn();
    render(<StrengthSlider value={0.6} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'Strict' }));
    expect(onChange).toHaveBeenCalledWith(0.8);
  });
});
