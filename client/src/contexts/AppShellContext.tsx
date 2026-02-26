/**
 * AppShell Context
 *
 * Provides shared state for workspace handoff data.
 */

import React, { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { ConvergenceHandoff } from '@features/convergence/types';

/**
 * Context value interface for AppShell
 */
export interface AppShellContextValue {
  /** Handoff data when switching into the main workspace */
  convergenceHandoff: ConvergenceHandoff | null;
  /** Set the convergence handoff data */
  setConvergenceHandoff: (handoff: ConvergenceHandoff | null) => void;
}

/**
 * Props for AppShellProvider
 */
export interface AppShellProviderProps {
  children: ReactNode;
}

/**
 * AppShell context - null when used outside provider
 */
const AppShellContext = createContext<AppShellContextValue | null>(null);

/**
 * AppShell Provider Component
 */
export function AppShellProvider({ children }: AppShellProviderProps): React.ReactElement {
  const [convergenceHandoff, setConvergenceHandoff] = useState<ConvergenceHandoff | null>(null);

  const value: AppShellContextValue = useMemo(
    () => ({
      convergenceHandoff,
      setConvergenceHandoff,
    }),
    [convergenceHandoff]
  );

  return <AppShellContext.Provider value={value}>{children}</AppShellContext.Provider>;
}

/**
 * Hook to access AppShell context
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
