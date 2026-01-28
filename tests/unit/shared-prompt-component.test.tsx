/**
 * Unit tests for SharedPrompt component
 */

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import SharedPrompt from '@components/SharedPrompt/SharedPrompt';
import { useSharedPrompt } from '@components/SharedPrompt/hooks/useSharedPrompt';
import { useNavigate } from 'react-router-dom';

vi.mock('@components/SharedPrompt/hooks/useSharedPrompt', () => ({
  useSharedPrompt: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: vi.fn(() => ({ uuid: 'uuid-123' })),
    useNavigate: vi.fn(),
  };
});

const mockUseSharedPrompt = vi.mocked(useSharedPrompt);
const mockUseNavigate = vi.mocked(useNavigate);

describe('SharedPrompt', () => {
  it('renders loading state', () => {
    mockUseSharedPrompt.mockReturnValue({
      prompt: null,
      promptContext: null,
      loading: true,
      error: null,
      copied: false,
      formattedOutput: { html: '' },
      handleCopy: vi.fn(),
    });

    render(<SharedPrompt />);

    expect(screen.getByText('Loading prompt...')).toBeInTheDocument();
  });

  it('renders error state and navigates home', () => {
    const navigate = vi.fn();
    mockUseNavigate.mockReturnValue(navigate);

    mockUseSharedPrompt.mockReturnValue({
      prompt: null,
      promptContext: null,
      loading: false,
      error: 'Failed to load prompt',
      copied: false,
      formattedOutput: { html: '' },
      handleCopy: vi.fn(),
    });

    render(<SharedPrompt />);

    expect(screen.getByText('Failed to load prompt')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Go to Home'));

    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('renders prompt content and triggers copy', () => {
    const handleCopy = vi.fn();
    mockUseSharedPrompt.mockReturnValue({
      prompt: {
        uuid: 'uuid-123',
        input: 'Input text',
        output: 'Output text',
        mode: 'optimize',
        timestamp: new Date().toISOString(),
        score: 75,
      },
      promptContext: null,
      loading: false,
      error: null,
      copied: false,
      formattedOutput: { html: '<div>Output text</div>' },
      handleCopy,
    });

    render(<SharedPrompt />);

    expect(screen.getByText('Shared Prompt')).toBeInTheDocument();
    expect(screen.getByText('Input text')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Copy'));

    expect(handleCopy).toHaveBeenCalled();
  });
});
