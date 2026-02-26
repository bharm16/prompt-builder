import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { StartFrameControl } from '../StartFrameControl';

vi.mock('@/hooks/useResolvedMediaUrl', () => ({
  useResolvedMediaUrl: ({ url }: { url: string }) => ({ url }),
}));

describe('StartFrameControl', () => {
  it('requests upload when empty control is clicked', () => {
    const onRequestUpload = vi.fn();

    render(
      <StartFrameControl
        startFrame={null}
        isUploadDisabled={false}
        onUploadFile={vi.fn()}
        onRequestUpload={onRequestUpload}
        onClear={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Start frame'));
    expect(onRequestUpload).toHaveBeenCalledTimes(1);
  });

  it('shows and clears an existing start frame', () => {
    const onClear = vi.fn();

    render(
      <StartFrameControl
        startFrame={{
          id: 'start-frame',
          url: 'https://example.com/start.png',
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
    expect(screen.getByAltText('Start frame')).toBeInTheDocument();
  });
});
