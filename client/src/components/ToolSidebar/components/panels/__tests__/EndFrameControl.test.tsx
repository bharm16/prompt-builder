import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { EndFrameControl } from '../EndFrameControl';

describe('EndFrameControl', () => {
  it('renders empty state and requests upload on click', () => {
    const onRequestUpload = vi.fn();

    render(
      <EndFrameControl
        endFrame={null}
        isUploadDisabled={false}
        onUploadFile={vi.fn()}
        onRequestUpload={onRequestUpload}
        onClear={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'End frame' }));

    expect(onRequestUpload).toHaveBeenCalledTimes(1);
  });

  it('shows clear action when end frame exists', () => {
    const onClear = vi.fn();

    render(
      <EndFrameControl
        endFrame={{
          id: 'end-1',
          url: 'https://example.com/end.png',
          source: 'upload',
        }}
        isUploadDisabled={false}
        onUploadFile={vi.fn()}
        onRequestUpload={vi.fn()}
        onClear={onClear}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
