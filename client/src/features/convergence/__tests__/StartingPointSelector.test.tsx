import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { StartingPointSelector } from '../components/StartingPointSelector/StartingPointSelector';

describe('StartingPointSelector', () => {
  it('should show three options', () => {
    render(
      <StartingPointSelector
        intent="test"
        onSelect={vi.fn()}
        isLoading={false}
      />
    );

    expect(screen.getByText('Upload Image')).toBeInTheDocument();
    expect(screen.getByText('Quick Generate')).toBeInTheDocument();
    expect(screen.getByText('Visual Exploration')).toBeInTheDocument();
  });

  it('should show uploader when upload is selected', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();

    render(
      <StartingPointSelector
        intent="test"
        onSelect={onSelect}
        isLoading={false}
      />
    );

    await user.click(screen.getByText('Upload Image'));

    expect(screen.getByTestId('image-uploader')).toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('should call onSelect for quick mode', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();

    render(
      <StartingPointSelector
        intent="test"
        onSelect={onSelect}
        isLoading={false}
      />
    );

    await user.click(screen.getByText('Quick Generate'));

    expect(onSelect).toHaveBeenCalledWith('quick');
  });
});
