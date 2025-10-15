import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { SuggestionsPanel } from '../PromptEnhancementEditor.jsx';

describe('SuggestionsPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders flat suggestions and handles click', () => {
    const onSuggestionClick = vi.fn();
    render(
      <SuggestionsPanel
        suggestionsData={{
          show: true,
          selectedText: 'old',
          suggestions: [{ text: 'opt 1' }, { text: 'opt 2' }],
          isLoading: false,
          onSuggestionClick,
          onClose: vi.fn(),
          fullPrompt: 'content',
        }}
      />
    );
    const btn = screen.getByRole('listitem', { name: /Suggestion 1/i });
    fireEvent.click(btn);
    expect(onSuggestionClick).toHaveBeenCalledWith('opt 1');
  });

  it('requests custom suggestions using fetch', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ suggestions: [{ text: 'c1' }] }) });
    render(
      <SuggestionsPanel
        suggestionsData={{
          show: true,
          selectedText: 'old',
          suggestions: [],
          isLoading: false,
          onSuggestionClick: vi.fn(),
          onClose: vi.fn(),
          fullPrompt: 'content',
        }}
      />
    );
    const input = screen.getByPlaceholderText(/make it more cinematic/i);
    fireEvent.change(input, { target: { value: 'shorter and clearer' } });
    const genBtn = screen.getByRole('button', { name: /generate custom suggestions/i });
    fireEvent.click(genBtn);
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalled();
    fetchMock.mockRestore();
  });
});
