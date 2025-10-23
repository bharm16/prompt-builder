import React from 'react';
import { describe, expect, it, beforeEach, afterEach, vi, beforeAll } from 'vitest';
import { render, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { JSDOM } from 'jsdom';

beforeAll(() => {
  if (typeof document === 'undefined') {
    const jsdom = new JSDOM('<!doctype html><html><body></body></html>');
    global.window = jsdom.window;
    global.document = jsdom.window.document;
  }
});


vi.mock('../hooks/useSpanLabeling.js', () => ({
  useSpanLabeling: vi.fn(),
}));

vi.mock('../../utils/anchorRanges.js', () => {
  return {
    buildTextNodeIndex: vi.fn(() => ({ nodes: [], length: 0 })),
    wrapRangeSegments: ({ root, start, end, createWrapper }) => {
      const wrapper = createWrapper();
      const text = root.textContent || '';
      const slice = text.slice(start, end);
      if (slice) {
        wrapper.textContent = slice;
      }
      root.appendChild(wrapper);
      return [wrapper];
    },
  };
});

const { useSpanLabeling } = await import('../hooks/useSpanLabeling.js');
const { PromptCanvas } = await import('../PromptCanvas.jsx');
const { ToastProvider } = await import('../../../components/Toast.jsx');

const baseProps = {
  inputPrompt: '',
  optimizedPrompt: '',
  displayedPrompt: '',
  qualityScore: null,
  selectedMode: 'video',
  currentMode: 'video',
  promptUuid: 'test-prompt',
  promptContext: null,
  onDisplayedPromptChange: vi.fn(),
  onSkipAnimation: vi.fn(),
  suggestionsData: { show: false },
  onFetchSuggestions: vi.fn(),
  onCreateNew: vi.fn(),
};

const samplePrompt = 'Paint the wall red. Paint the wall red again.';
const targetPhrase = 'Paint the wall red';

beforeEach(() => {
  const firstStart = samplePrompt.indexOf(targetPhrase);
  const secondStart = samplePrompt.indexOf(targetPhrase, firstStart + 1);
  useSpanLabeling.mockReturnValue({
    spans: [
      {
        id: 'span_1',
        text: targetPhrase,
        start: firstStart,
        end: firstStart + targetPhrase.length,
        role: 'Descriptive',
        confidence: 0.9,
      },
      {
        id: 'span_2',
        text: targetPhrase,
        start: secondStart,
        end: secondStart + targetPhrase.length,
        role: 'Descriptive',
        confidence: 0.9,
      },
    ],
    meta: { version: 'test', notes: '' },
    status: 'success',
    error: null,
    refresh: vi.fn(),
  });
});

afterEach(() => {
  vi.clearAllMocks();
  cleanup();
});

describe('PromptCanvas highlighting', () => {
  it('invokes onFetchSuggestions with span metadata when highlight is clicked', async () => {
    const onFetchSuggestions = vi.fn();

    const { container } = render(
      <ToastProvider>
        <PromptCanvas
          {...baseProps}
          displayedPrompt={samplePrompt}
          optimizedPrompt={samplePrompt}
          onFetchSuggestions={onFetchSuggestions}
        />
      </ToastProvider>
    );

    const editor = container.querySelector('[contenteditable]');
    expect(editor).toBeTruthy();

    const highlight = await waitFor(() => {
      const node = container.querySelector('[data-span-id="span_2"]');
      expect(node).toBeTruthy();
      return node;
    });

    fireEvent.mouseDown(highlight);

    await waitFor(() => {
      expect(onFetchSuggestions).toHaveBeenCalledTimes(1);
    });

    const payload = onFetchSuggestions.mock.calls[0][0];
    expect(payload.highlightedText).toBe(targetPhrase);
    expect(payload.metadata?.spanId).toBe('span_2');
    expect(payload.metadata?.span?.leftCtx).toBeDefined();
    expect(payload.metadata?.span?.quote).toBe(targetPhrase);
  });
});
