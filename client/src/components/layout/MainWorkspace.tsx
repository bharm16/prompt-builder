/**
 * MainWorkspace Component
 *
 * Orchestrates the main workspace area, conditionally rendering either
 * the ConvergenceFlow (Create mode) or Studio (prompt editor) based on
 * the active tool selection from AppShellContext.
 *
 * This component ensures:
 * - Proper tool switching between Create and Studio modes
 * - Shared bottom control bar for both tools (via GenerationControlsContext)
 * - Convergence handoff data is passed to Studio for prompt pre-fill
 *
 * @requirement 16.3 - Display Visual Convergence flow when Create is selected
 * @requirement 16.4 - Display advanced prompt editor when Studio is selected
 * @requirement 16.5 - Preserve bottom control bar for both tools
 * @requirement 17.2 - Switch to Studio mode with converged prompt pre-filled
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppShell } from '@/contexts/AppShellContext';
import { AppShell } from '@/components/navigation/AppShell';
import { ConvergenceFlow } from '@/features/convergence/components/ConvergenceFlow';
import PromptOptimizerWorkspace from '@/features/prompt-optimizer/PromptOptimizerContainer';
import { GenerationControlsProvider } from '@/features/prompt-optimizer/context/GenerationControlsContext';
import { getAuthRepository } from '@/repositories';
import { usePromptHistory } from '@hooks/usePromptHistory';
import type { PromptHistoryEntry, User } from '@hooks/usePromptHistory';

function CreateWorkspaceShell(): React.ReactElement {
  const [user, setUser] = useState<User | null>(null);
  const promptHistory = usePromptHistory(user);
  const navigate = useNavigate();
  const { setActiveTool } = useAppShell();

  useEffect(() => {
    const unsubscribe = getAuthRepository().onAuthStateChanged(setUser);
    return () => unsubscribe();
  }, []);

  const handleLoadFromHistory = useCallback(
    (entry: PromptHistoryEntry): void => {
      setActiveTool('studio', { skipWarning: true });
      if (entry.uuid) {
        navigate(`/prompt/${entry.uuid}`);
        return;
      }
      navigate('/');
    },
    [navigate, setActiveTool]
  );

  const handleCreateNew = useCallback((): void => {
    setActiveTool('studio', { skipWarning: true });
    navigate('/');
  }, [navigate, setActiveTool]);

  const handleRename = useCallback(
    (entry: PromptHistoryEntry, title: string): void => {
      if (!entry.uuid) return;
      promptHistory.updateEntryPersisted(entry.uuid, entry.id ?? null, { title });
    },
    [promptHistory]
  );

  return (
    <AppShell
      history={promptHistory.history}
      filteredHistory={promptHistory.filteredHistory}
      isLoadingHistory={promptHistory.isLoadingHistory}
      searchQuery={promptHistory.searchQuery}
      onSearchChange={promptHistory.setSearchQuery}
      onLoadFromHistory={handleLoadFromHistory}
      onCreateNew={handleCreateNew}
      onDelete={promptHistory.deleteFromHistory}
      onRename={handleRename}
    >
      {/* Render ConvergenceFlow when Create tool is active */}
      <ConvergenceFlow />
    </AppShell>
  );
}

/**
 * MainWorkspace - Conditional renderer for Create/Studio tools
 *
 * Wraps both tools with GenerationControlsProvider to ensure the bottom
 * control bar (model selector, aspect ratio, Generate button) is shared
 * between Create and Studio modes.
 *
 * @example
 * ```tsx
 * <MainWorkspace />
 * ```
 */
export function MainWorkspace(): React.ReactElement {
  const { activeTool, convergenceHandoff } = useAppShell();

  return (
    <GenerationControlsProvider>
      {activeTool === 'create' ? (
        <CreateWorkspaceShell />
      ) : (
        // Render Studio (PromptOptimizerWorkspace) when Studio tool is active
        // Pass convergenceHandoff for prompt pre-fill when coming from Create
        <PromptOptimizerWorkspace
          convergenceHandoff={convergenceHandoff}
        />
      )}
    </GenerationControlsProvider>
  );
}

MainWorkspace.displayName = 'MainWorkspace';

export default MainWorkspace;
