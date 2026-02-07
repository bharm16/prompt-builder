import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { VideoPromptToolbar } from '../VideoPromptToolbar';

vi.mock('@promptstudio/system/components/ui', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>): React.ReactElement => <svg {...props} />;
  return {
    Copy: Icon,
    Trash2: Icon,
    Wand2: Icon,
  };
});

describe('VideoPromptToolbar', () => {
  it('calls split preview handlers when clicked', async () => {
    const user = userEvent.setup();
    const onGenerateSinglePreview = vi.fn();
    const onGenerateFourPreviews = vi.fn();

    render(
      <VideoPromptToolbar
        canCopy
        canClear
        canGeneratePreviews
        onCopy={vi.fn()}
        onClear={vi.fn()}
        onGenerateSinglePreview={onGenerateSinglePreview}
        onGenerateFourPreviews={onGenerateFourPreviews}
        promptLength={42}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Generate 1 preview · 1 cr' }));
    await user.click(screen.getByRole('button', { name: 'Generate 4 previews · ~4 cr' }));

    expect(onGenerateSinglePreview).toHaveBeenCalledTimes(1);
    expect(onGenerateFourPreviews).toHaveBeenCalledTimes(1);
  });

  it('disables split preview actions when generation is unavailable', () => {
    render(
      <VideoPromptToolbar
        canCopy
        canClear
        canGeneratePreviews={false}
        onCopy={vi.fn()}
        onClear={vi.fn()}
        onGenerateSinglePreview={vi.fn()}
        onGenerateFourPreviews={vi.fn()}
        promptLength={0}
      />
    );

    expect(screen.getByRole('button', { name: 'Generate 1 preview · 1 cr' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Generate 4 previews · ~4 cr' })).toBeDisabled();
  });
});
