import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConstraintModeSelector } from '@features/prompt-optimizer/components/ConstraintModeSelector';

describe('ConstraintModeSelector', () => {
  it('renders active mode and label', () => {
    render(
      <ConstraintModeSelector
        mode="strict"
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText('I2V Mode')).toBeInTheDocument();
    expect(screen.getByText('Strict')).toBeInTheDocument();
  });

  it('shows analyzing status', () => {
    render(
      <ConstraintModeSelector
        mode="flexible"
        onChange={vi.fn()}
        isAnalyzing
      />
    );

    expect(screen.getByText('Analyzing image...')).toBeInTheDocument();
  });
});
