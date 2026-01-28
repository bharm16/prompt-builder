import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useToolSidebarState } from '@components/ToolSidebar/hooks/useToolSidebarState';

describe('useToolSidebarState', () => {
  describe('error handling', () => {
    it('uses the provided default panel', () => {
      const { result } = renderHook(() => useToolSidebarState('characters'));

      expect(result.current.activePanel).toBe('characters');
    });

    it('updates activePanel when setActivePanel is called', () => {
      const { result } = renderHook(() => useToolSidebarState('sessions'));

      act(() => {
        result.current.setActivePanel('studio');
      });

      expect(result.current.activePanel).toBe('studio');
    });
  });

  describe('edge cases', () => {
    it('initializes isPanelCollapsed to false', () => {
      const { result } = renderHook(() => useToolSidebarState());

      expect(result.current.isPanelCollapsed).toBe(false);
    });

    it('toggles isPanelCollapsed when updated', () => {
      const { result } = renderHook(() => useToolSidebarState());

      act(() => {
        result.current.setIsPanelCollapsed(true);
      });

      expect(result.current.isPanelCollapsed).toBe(true);

      act(() => {
        result.current.setIsPanelCollapsed(false);
      });

      expect(result.current.isPanelCollapsed).toBe(false);
    });
  });

  describe('core behavior', () => {
    it('keeps activePanel when collapsing state changes', () => {
      const { result } = renderHook(() => useToolSidebarState('sessions'));

      act(() => {
        result.current.setIsPanelCollapsed(true);
      });

      expect(result.current.activePanel).toBe('sessions');
    });
  });
});
