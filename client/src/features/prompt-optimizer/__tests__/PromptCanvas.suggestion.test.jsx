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


vi.mock('../phraseExtractor.js', () => {
  return {
    runExtractionPipeline: vi.fn(),
    PARSER_VERSION: 'test-parser',
    LEXICON_VERSION: 'test-lexicon',
    EMOJI_POLICY_VERSION: 'test-emoji',
  };
});

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

const { runExtractionPipeline } = await import('../phraseExtractor.js');
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

const createSpan = (id, start) => ({
  id,
  source: 'LEXICON',
  category: 'style',
  confidence: 1,
  start,
  end: start + targetPhrase.length,
  startGrapheme: start,
  endGrapheme: start + targetPhrase.length,
  text: targetPhrase,
  quote: targetPhrase,
  leftCtx: samplePrompt.slice(Math.max(0, start - 10), start),
  rightCtx: samplePrompt.slice(start + targetPhrase.length, start + targetPhrase.length + 10),
  idempotencyKey: `${targetPhrase}::${start}`,
  validatorPass: true,
  droppedReason: null,
  metadata: { matcher: 'test' },
});

beforeEach(() => {
  const firstStart = samplePrompt.indexOf(targetPhrase);
  const secondStart = samplePrompt.indexOf(targetPhrase, firstStart + 1);
  runExtractionPipeline.mockReturnValue({
    canonical: { normalized: samplePrompt, length: samplePrompt.length },
    spans: [createSpan('span_1', firstStart), createSpan('span_2', secondStart)],
    stats: { totalCandidates: 2, final: 2 },
    versions: {
      parser: 'test-parser',
      lexicon: 'test-lexicon',
      emojiPolicy: 'test-emoji',
    },
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

    await waitFor(() => {
      expect(runExtractionPipeline).toHaveBeenCalled();
    });

    const editor = container.querySelector('[contenteditable]');
    expect(editor).toBeTruthy();

    const secondStart =
      samplePrompt.indexOf(targetPhrase, samplePrompt.indexOf(targetPhrase) + 1);

    const syntheticHighlight = document.createElement('span');
    syntheticHighlight.className = 'value-word';
    syntheticHighlight.dataset.spanId = 'span_2';
    syntheticHighlight.dataset.category = 'style';
    syntheticHighlight.dataset.source = 'LEXICON';
    syntheticHighlight.dataset.start = String(secondStart);
    syntheticHighlight.dataset.end = String(secondStart + targetPhrase.length);
    syntheticHighlight.dataset.startGrapheme = syntheticHighlight.dataset.start;
    syntheticHighlight.dataset.endGrapheme = syntheticHighlight.dataset.end;
    syntheticHighlight.dataset.validatorPass = 'true';
    syntheticHighlight.dataset.quote = targetPhrase;
    syntheticHighlight.dataset.leftCtx = samplePrompt.slice(
      Math.max(0, secondStart - 10),
      secondStart
    );
    syntheticHighlight.dataset.rightCtx = samplePrompt.slice(
      secondStart + targetPhrase.length,
      secondStart + targetPhrase.length + 10
    );
    syntheticHighlight.dataset.idempotencyKey = 'test-key';
    syntheticHighlight.textContent = targetPhrase;

    editor.appendChild(syntheticHighlight);

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
