/**
 * AppShell Context
 *
 * Provides shared state for tool switching between Create (Visual Convergence)
 * and Studio (advanced prompt editor) modes.
 *
 * Requirements:
 * - 16.1-16.6: Tool panel integration
 * - 17.1-17.7: Tool switching and handoff
 */

import React, { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import type { ConvergenceHandoff } from '@features/convergence/types';

/**
 * Active tool type - determines which tool is displayed in the main workspace
 */
export type ActiveTool = 'create' | 'studio';

/**
 * Context value interface for AppShell
 */
export interface AppShellContextValue {
  /** Currently active tool ('create' for Visual Convergence, 'studio' for prompt editor) */
  activeTool: ActiveTool;
  /** Handoff data when switching from Create to Studio mode (Requirement 17.6) */
  convergenceHandoff: ConvergenceHandoff | null;
  /**
   * Set the active tool with optional generation-in-progress warning (Requirement 17.7)
   * @param tool - The tool to switch to
   * @param options - Optional configuration for the switch
   */
  setActiveTool: (tool: ActiveTool, options?: SetActiveToolOptions) => SetActiveToolResult;
  /** Set the convergence handoff data for Studio pre-fill */
  setConvergenceHandoff: (handoff: ConvergenceHandoff | null) => void;
}

/**
 * Options for setActiveTool
 */
export interface SetActiveToolOptions {
  /** Skip the generation-in-progress warning */
  skipWarning?: boolean;
}

/**
 * Result of attempting to switch tools
 */
export type SetActiveToolResult = 'changed' | 'blocked' | 'unchanged';

/**
 * Props for AppShellProvider
 */
export interface AppShellProviderProps {
  children: ReactNode;
  /** Initial active tool (defaults to 'studio') */
  initialTool?: ActiveTool;
  /** Callback to check if generation is in progress */
  isGeneratingCheck?: () => boolean;
}

/**
 * AppShell context - null when used outside provider
 */
const AppShellContext = createContext<AppShellContextValue | null>(null);

/**
 * AppShell Provider Component
 *
 * Wraps the application to provide tool switching state and convergence handoff data.
 *
 * @example
 * ```tsx
 * <AppShellProvider>
 *   <App />
 * </AppShellProvider>
 * ```
 */
export function AppShellProvider({
  children,
  initialTool = 'studio',
  isGeneratingCheck,
}: AppShellProviderProps): React.ReactElement {
  const [activeTool, setActiveToolState] = useState<ActiveTool>(initialTool);
  const [convergenceHandoff, setConvergenceHandoff] = useState<ConvergenceHandoff | null>(null);

  /**
   * Set active tool with generation-in-progress warning (Requirement 17.7)
   */
  const setActiveTool = useCallback(
    (tool: ActiveTool, options?: SetActiveToolOptions): SetActiveToolResult => {
      // Skip if already on the requested tool
      if (tool === activeTool) {
        return 'unchanged';
      }

      // Check for generation in progress and warn user (Requirement 17.7)
      if (!options?.skipWarning && isGeneratingCheck?.()) {
        const confirmed = window.confirm(
          'Generation is in progress. Are you sure you want to switch tools? This may interrupt the current operation.'
        );
        if (!confirmed) {
          return 'blocked';
        }
      }

      setActiveToolState(tool);
      return 'changed';
    },
    [activeTool, isGeneratingCheck]
  );

  const value: AppShellContextValue = {
    activeTool,
    convergenceHandoff,
    setActiveTool,
    setConvergenceHandoff,
  };

  return <AppShellContext.Provider value={value}>{children}</AppShellContext.Provider>;
}

/**
 * Hook to access AppShell context
 *
 * @throws Error if used outside of AppShellProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { activeTool, setActiveTool, convergenceHandoff, setConvergenceHandoff } = useAppShell();
 *
 *   const handleEditInStudio = () => {
 *     setConvergenceHandoff({
 *       prompt: 'My prompt',
 *       lockedDimensions: [],
 *       previewImageUrl: 'https://...',
 *       cameraMotion: 'pan_left',
 *       subjectMotion: 'walking slowly',
 *     });
 *     setActiveTool('studio');
 *   };
 *
 *   return <button onClick={handleEditInStudio}>Edit in Studio</button>;
 * }
 * ```
 */
export function useAppShell(): AppShellContextValue {
  const context = useContext(AppShellContext);
  if (!context) {
    throw new Error('useAppShell must be used within an AppShellProvider');
  }
  return context;
}

/**
 * Export the context for testing purposes
 */
export { AppShellContext };
