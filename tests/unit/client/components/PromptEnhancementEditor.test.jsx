import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import PromptEnhancementEditor from '../../../../client/src/components/PromptEnhancementEditor.jsx';

describe('PromptEnhancementEditor selection → suggestion flow', () => {
  let origGetSelection;
  beforeEach(() => {
    origGetSelection = window.getSelection;
  });
  afterEach(() => {
    window.getSelection = origGetSelection;
    vi.restoreAllMocks();
  });

  it('selects text, fetches suggestions, and applies one', async () => {
    const prompt = 'This is a coffee shop scene with cozy vibes.';
    const onUpdate = vi.fn();
    const onPanel = vi.fn();

    // Mock fetch for enhancement suggestions
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ suggestions: [{ text: 'cafe' }] }),
    });

    const { container } = render(
      <PromptEnhancementEditor
        promptContent={prompt}
        onPromptUpdate={onUpdate}
        originalUserPrompt={prompt}
        onShowSuggestionsChange={onPanel}
      />
    );

    const editor = container.firstChild; // contentRef div

    // Mock window.getSelection within the editor
    window.getSelection = () => ({
      toString: () => 'coffee shop',
      anchorNode: editor,
      getRangeAt: () => ({ cloneRange: () => ({}) }),
      removeAllRanges: () => {},
      addRange: () => {},
    });

    // Trigger mouse up to start selection flow
    fireEvent.mouseUp(editor);

    // Wait until our panel callback receives suggestions loaded (isLoading false at some point)
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
      // Expect at least one call with show true
      const calls = onPanel.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
    });

    // The latest panel payload should include onSuggestionClick
    const latest = onPanel.mock.calls[onPanel.mock.calls.length - 1][0];
    expect(typeof latest.onSuggestionClick).toBe('function');

    // Apply the suggestion
    await latest.onSuggestionClick({ text: 'cafe' });
    expect(onUpdate).toHaveBeenCalledWith(
      'This is a cafe scene with cozy vibes.'
    );
  });
});

