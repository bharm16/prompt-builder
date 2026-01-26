/**
 * Unit tests for PromptEnhancementEditor component
 */

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import PromptEnhancementEditor from '@components/PromptEnhancementEditor/PromptEnhancementEditor';
import { useEnhancementEditor } from '@components/PromptEnhancementEditor/hooks/useEnhancementEditor';

vi.mock('@components/PromptEnhancementEditor/hooks/useEnhancementEditor', () => ({
  useEnhancementEditor: vi.fn(),
}));

const mockUseEnhancementEditor = vi.mocked(useEnhancementEditor);

describe('PromptEnhancementEditor', () => {
  it('renders prompt content and wires mouse up handler', () => {
    const handleMouseUp = vi.fn();
    const contentRef = React.createRef<HTMLDivElement>();
    mockUseEnhancementEditor.mockReturnValue({
      contentRef,
      handleMouseUp,
    });

    render(
      <PromptEnhancementEditor
        promptContent="Sample prompt"
        onPromptUpdate={vi.fn()}
      />
    );

    const content = screen.getByText('Sample prompt');
    fireEvent.mouseUp(content);

    expect(handleMouseUp).toHaveBeenCalledTimes(1);
  });

  it('passes optional props through to the hook', () => {
    const handleMouseUp = vi.fn();
    const contentRef = React.createRef<HTMLDivElement>();
    mockUseEnhancementEditor.mockReturnValue({
      contentRef,
      handleMouseUp,
    });

    const onShowSuggestionsChange = vi.fn();

    render(
      <PromptEnhancementEditor
        promptContent="Content"
        onPromptUpdate={vi.fn()}
        originalUserPrompt="Original"
        onShowSuggestionsChange={onShowSuggestionsChange}
      />
    );

    expect(mockUseEnhancementEditor).toHaveBeenCalledWith(
      expect.objectContaining({
        promptContent: 'Content',
        originalUserPrompt: 'Original',
        onShowSuggestionsChange,
      })
    );
  });
});
