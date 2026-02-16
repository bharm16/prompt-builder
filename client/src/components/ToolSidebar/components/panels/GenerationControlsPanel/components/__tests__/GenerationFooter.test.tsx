import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GenerationFooter } from '../GenerationFooter';

vi.mock('../ModelRecommendationDropdown', () => ({
  ModelRecommendationDropdown: ({ renderModelId }: { renderModelId: string }) => (
    <div data-testid="model-recommendation-dropdown">{renderModelId}</div>
  ),
}));

const baseProps = {
  renderModelOptions: [{ id: 'sora-2', label: 'Sora' }],
  renderModelId: 'sora-2',
  onModelChange: vi.fn(),
  onGenerate: vi.fn(),
  isGenerateDisabled: false,
};

describe('GenerationFooter', () => {
  it('disables generate button and shows tooltip when credits are insufficient', () => {
    render(<GenerationFooter {...baseProps} creditBalance={10} />);

    const button = screen.getByRole('button', { name: /Generate/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', 'Need 80 credits (you have 10)');
  });

  it('renders inline balance metadata with amber style on low balance', () => {
    render(<GenerationFooter {...baseProps} creditBalance={12} />);

    const lowBalanceBadge = screen.getByText('· 12 bal');
    expect(lowBalanceBadge).toBeInTheDocument();
    expect(lowBalanceBadge.className).toContain('text-amber-400');
  });

  it('does not block when balance is unknown', () => {
    render(<GenerationFooter {...baseProps} creditBalance={null} />);

    const button = screen.getByRole('button', { name: /Generate/i });
    expect(button).not.toBeDisabled();
  });
});
