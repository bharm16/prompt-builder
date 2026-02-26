import { useCallback, useState } from 'react';
import type { ToolPanelType } from '../types';

const PANEL_STORAGE_KEY = 'tool-sidebar:activePanel';
const COLLAPSED_STORAGE_KEY = 'tool-sidebar:isPanelCollapsed';

const VALID_PANELS = new Set<string>(['sessions', 'studio', 'characters', 'styles']);

const loadActivePanel = (fallback: ToolPanelType): ToolPanelType => {
  if (typeof window === 'undefined') return fallback;
  try {
    const value = window.localStorage.getItem(PANEL_STORAGE_KEY);
    if (value === 'create' || value === 'continuity') return 'studio';
    if (value && VALID_PANELS.has(value)) return value as ToolPanelType;
    return fallback;
  } catch {
    return fallback;
  }
};

const loadIsPanelCollapsed = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(COLLAPSED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

interface UseToolSidebarStateReturn {
  activePanel: ToolPanelType;
  setActivePanel: (panel: ToolPanelType) => void;
  isPanelCollapsed: boolean;
  setIsPanelCollapsed: (collapsed: boolean) => void;
}

export function useToolSidebarState(
  defaultPanel: ToolPanelType = 'studio'
): UseToolSidebarStateReturn {
  const [activePanel, setActivePanelState] = useState<ToolPanelType>(() => loadActivePanel(defaultPanel));
  const [isPanelCollapsed, setIsPanelCollapsedState] = useState(() => loadIsPanelCollapsed());

  const setActivePanel = useCallback((panel: ToolPanelType) => {
    setActivePanelState((previousPanel) => {
      if (previousPanel === panel) {
        return previousPanel;
      }
      try { window.localStorage.setItem(PANEL_STORAGE_KEY, panel); } catch { /* ignore */ }
      return panel;
    });
  }, []);

  const setIsPanelCollapsed = useCallback((collapsed: boolean) => {
    setIsPanelCollapsedState((previous) => {
      if (previous === collapsed) {
        return previous;
      }
      try { window.sessionStorage.setItem(COLLAPSED_STORAGE_KEY, String(collapsed)); } catch { /* ignore */ }
      return collapsed;
    });
  }, []);

  return {
    activePanel,
    setActivePanel,
    isPanelCollapsed,
    setIsPanelCollapsed,
  };
}
