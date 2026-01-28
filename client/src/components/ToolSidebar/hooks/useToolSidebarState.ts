import { useState } from 'react';
import type { ToolPanelType } from '../types';

interface UseToolSidebarStateReturn {
  activePanel: ToolPanelType;
  setActivePanel: (panel: ToolPanelType) => void;
  isPanelCollapsed: boolean;
  setIsPanelCollapsed: (collapsed: boolean) => void;
}

export function useToolSidebarState(
  defaultPanel: ToolPanelType = 'studio'
): UseToolSidebarStateReturn {
  const [activePanel, setActivePanel] = useState<ToolPanelType>(defaultPanel);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);

  return {
    activePanel,
    setActivePanel,
    isPanelCollapsed,
    setIsPanelCollapsed,
  };
}
