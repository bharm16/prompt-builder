import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LockedSpanIndicator } from '@features/prompt-optimizer/components/LockedSpanIndicator';

describe('LockedSpanIndicator', () => {
  it('renders reason and handles alternative selection', async () => {
    const user = userEvent.setup();
    const onSelectAlternative = vi.fn();

    render(
      <LockedSpanIndicator
        reason="Lighting is fixed by the image"
        motionAlternatives={[{ text: 'gentle motion' }]}
        onSelectAlternative={onSelectAlternative}
      />
    );

    expect(screen.getByText('Locked by image')).toBeInTheDocument();
    expect(screen.getByText('Lighting is fixed by the image')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'gentle motion' }));
    expect(onSelectAlternative).toHaveBeenCalledWith({ text: 'gentle motion' });
  });
});
