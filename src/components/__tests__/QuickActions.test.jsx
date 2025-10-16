import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import QuickActions from '../QuickActions.jsx';

const Icon = () => <svg data-testid="qa-icon" />;

const actions = [
  { label: 'Research Topic', description: 'Investigate subject', category: 'research', icon: Icon },
  { label: 'Write Summary', description: 'Summarize content', category: 'writing', icon: Icon },
  { label: 'Learn Concept', description: 'Study ideas', category: 'learning', icon: Icon },
];

describe('QuickActions', () => {
  it('renders actions grouped by category and handles click', () => {
    const onActionClick = vi.fn();
    render(<QuickActions actions={actions} onActionClick={onActionClick} />);

    // Buttons rendered with aria-labels
    const btn = screen.getByRole('button', { name: /use research topic template/i });
    expect(btn).toBeInTheDocument();

    // Click triggers callback with action payload
    fireEvent.click(btn);
    expect(onActionClick).toHaveBeenCalledWith(expect.objectContaining({ label: 'Research Topic' }));
  });
});

