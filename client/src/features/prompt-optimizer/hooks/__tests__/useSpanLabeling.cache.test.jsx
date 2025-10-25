import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import {
  useSpanLabeling,
  __clearSpanLabelingCache,
  __getSpanLabelingCacheSnapshot,
} from '../useSpanLabeling.js';

const TestComponent = ({ text, cacheKey, triggerRefresh = false, enabled = true }) => {
  const { status, spans, refresh } = useSpanLabeling({
    text,
    cacheKey,
    enabled,
    debounceMs: 0,
    maxSpans: 10,
    minConfidence: 0.5,
  });

  React.useEffect(() => {
    if (triggerRefresh) {
      refresh();
    }
  }, [triggerRefresh, refresh]);

  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="spans">{spans.length}</span>
    </div>
  );
};

describe('useSpanLabeling caching', () => {
  beforeEach(() => {
    __clearSpanLabelingCache();
    if (typeof localStorage !== 'undefined' && typeof localStorage.clear === 'function') {
      localStorage.clear();
    }
    if (typeof sessionStorage !== 'undefined' && typeof sessionStorage.clear === 'function') {
      sessionStorage.clear();
    }
    fetch.mockReset();
  });

  it('reuses cached highlight data for identical text', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        spans: [{ id: '1', start: 0, end: 5 }],
        meta: { total: 1 },
      }),
    });

    const { rerender } = render(<TestComponent text="Golden hour sunset" cacheKey="prompt-1" />);

    await waitFor(() =>
      expect(screen.getByTestId('status').textContent).toBe('success')
    );
    expect(fetch).toHaveBeenCalled();

    const snapshotAfterFirst = __getSpanLabelingCacheSnapshot();
    expect(snapshotAfterFirst.length).toBeGreaterThanOrEqual(1);
    expect(snapshotAfterFirst[0].textPreview.trim()).toBe('Golden hour sunset');
    expect(snapshotAfterFirst[0].cacheId).toBe('prompt-1');
    expect(snapshotAfterFirst[0].key.includes('prompt-1')).toBe(true);

    fetch.mockClear();

    rerender(<TestComponent text="Golden hour sunset" cacheKey="prompt-1" />);

    await waitFor(() =>
      expect(screen.getByTestId('status').textContent).toBe('success')
    );
    expect(fetch).not.toHaveBeenCalled();
    const snapshotAfterSecond = __getSpanLabelingCacheSnapshot();
    expect(snapshotAfterSecond.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('spans').textContent).toBe('1');
  });

  it('bypasses cache when refresh is requested', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        spans: [{ id: '1', start: 0, end: 6 }],
        meta: { total: 1 },
      }),
    });

    const { rerender } = render(<TestComponent text="Camera movement" cacheKey="prompt-2" />);

    await waitFor(() =>
      expect(screen.getByTestId('status').textContent).toBe('success')
    );
    expect(fetch).toHaveBeenCalledTimes(1);

    fetch.mockReset();
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        spans: [{ id: '2', start: 0, end: 15 }],
        meta: { total: 1 },
      }),
    });

    rerender(<TestComponent text="Camera movement" cacheKey="prompt-2" triggerRefresh />);

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByTestId('status').textContent).toBe('success')
    );
    expect(screen.getByTestId('spans').textContent).toBe('1');
  });

  it('does not reuse cached data for different text with same length', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        spans: [{ id: 'a', start: 0, end: 3 }],
        meta: { total: 1 },
      }),
    });

    const { unmount } = render(<TestComponent text="Shot" cacheKey="prompt-3" />);
    await waitFor(() =>
      expect(screen.getByTestId('status').textContent).toBe('success')
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    unmount();

    fetch.mockReset();
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        spans: [{ id: 'b', start: 0, end: 3 }],
        meta: { total: 1 },
      }),
    });

    render(<TestComponent text="Zoom" cacheKey="prompt-3" />);
    await waitFor(() =>
      expect(screen.getByTestId('status').textContent).toBe('success')
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('keeps cache entries isolated per cacheKey even if text matches', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        spans: [{ id: 'x', start: 0, end: 4 }],
        meta: { total: 1 },
      }),
    });

    const { unmount } = render(<TestComponent text="Shot list" cacheKey="prompt-A" />);
    await waitFor(() =>
      expect(screen.getByTestId('status').textContent).toBe('success')
    );
    expect(fetch).toHaveBeenCalled();
    unmount();

    fetch.mockReset();
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        spans: [{ id: 'y', start: 0, end: 8 }],
        meta: { total: 1 },
      }),
    });

    render(<TestComponent text="Shot list" cacheKey="prompt-B" />);
    await waitFor(() =>
      expect(screen.getByTestId('status').textContent).toBe('success')
    );
    expect(fetch).toHaveBeenCalled();
  });
});
