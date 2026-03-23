import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useToolSidebarState } from '../useToolSidebarState';

describe('regression: stale Apps sidebar state falls back to studio', () => {
  afterEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('maps persisted apps state to studio on load', () => {
    window.localStorage.setItem('tool-sidebar:activePanel', 'apps');

    const { result } = renderHook(() => useToolSidebarState('sessions'));

    expect(result.current.activePanel).toBe('studio');
  });
});
