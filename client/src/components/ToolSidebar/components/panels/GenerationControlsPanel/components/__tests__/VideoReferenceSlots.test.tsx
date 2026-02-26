import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { VideoReferenceSlots } from '../VideoReferenceSlots';

describe('VideoReferenceSlots', () => {
  it('renders max slots and allows type updates + clear', () => {
    const onUpdateType = vi.fn();
    const onRemove = vi.fn();

    render(
      <VideoReferenceSlots
        references={[
          {
            id: 'ref-1',
            url: 'https://example.com/ref-1.png',
            referenceType: 'asset',
            source: 'upload',
          },
        ]}
        maxSlots={3}
        isUploadDisabled={false}
        onRequestUpload={vi.fn()}
        onUploadFile={vi.fn()}
        onRemove={onRemove}
        onUpdateType={onUpdateType}
      />
    );

    expect(screen.getAllByRole('button', { name: /Add video reference image/i })).toHaveLength(2);

    fireEvent.change(screen.getByLabelText('Reference type 1'), {
      target: { value: 'style' },
    });
    expect(onUpdateType).toHaveBeenCalledWith('ref-1', 'style');

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onRemove).toHaveBeenCalledWith('ref-1');
  });

  it('requests upload when empty slot is clicked', () => {
    const onRequestUpload = vi.fn();

    render(
      <VideoReferenceSlots
        references={[]}
        maxSlots={3}
        isUploadDisabled={false}
        onRequestUpload={onRequestUpload}
        onUploadFile={vi.fn()}
        onRemove={vi.fn()}
        onUpdateType={vi.fn()}
      />
    );

    const firstEmptySlot = screen.getAllByRole('button', {
      name: /Add video reference image/i,
    })[0];
    if (!firstEmptySlot) {
      throw new Error('Expected at least one empty reference slot');
    }

    fireEvent.click(firstEmptySlot);

    expect(onRequestUpload).toHaveBeenCalledTimes(1);
  });
});
