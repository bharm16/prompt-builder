import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { createRef } from 'react';

import PromptEnhancementEditor from '@/components/PromptEnhancementEditor/PromptEnhancementEditor';
import { useEnhancementEditor } from '@/components/PromptEnhancementEditor/hooks/useEnhancementEditor';

vi.mock('@/components/PromptEnhancementEditor/hooks/useEnhancementEditor', () => ({
  useEnhancementEditor: vi.fn(),
}));

describe('PromptEnhancementEditor', () => {
  const mockUseEnhancementEditor = vi.mocked(useEnhancementEditor);

  describe('error handling', () => {
    it('propagates errors from the enhancement hook', () => {
      mockUseEnhancementEditor.mockImplementation(() => {
        throw new Error('hook failed');
      });

      expect(() =>
        render(
          <PromptEnhancementEditor promptContent="Prompt" onPromptUpdate={vi.fn()} />
        )
      ).toThrow('hook failed');
    });

    it('invokes mouse up handler from the hook', () => {
      const contentRef = createRef<HTMLDivElement>();
      const handleMouseUp = vi.fn();
      mockUseEnhancementEditor.mockReturnValue({
        contentRef,
        handleMouseUp,
      });

      render(<PromptEnhancementEditor promptContent="Prompt" onPromptUpdate={vi.fn()} />);

      const content = screen.getByText('Prompt');
      fireEvent.mouseUp(content);
      expect(handleMouseUp).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('renders even when prompt content is empty', () => {
      const contentRef = createRef<HTMLDivElement>();
      mockUseEnhancementEditor.mockReturnValue({
        contentRef,
        handleMouseUp: vi.fn(),
      });

      const { container } = render(
        <PromptEnhancementEditor promptContent="" onPromptUpdate={vi.fn()} />
      );

      const root = container.firstElementChild;
      expect(root?.tagName).toBe('DIV');
      expect(root).toHaveClass('cursor-text');
    });
  });

  describe('core behavior', () => {
    it('wires the mouse up handler and attaches the ref', () => {
      const handleMouseUp = vi.fn();
      const contentRef = createRef<HTMLDivElement>();
      mockUseEnhancementEditor.mockReturnValue({ contentRef, handleMouseUp });

      render(
        <PromptEnhancementEditor
          promptContent="Editable prompt"
          onPromptUpdate={vi.fn()}
          originalUserPrompt="Original"
        />
      );

      const content = screen.getByText('Editable prompt');
      fireEvent.mouseUp(content);

      expect(handleMouseUp).toHaveBeenCalled();
      expect(contentRef.current).toBe(content);
    });
  });
});
