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

import React from 'react';
import { useAppShell } from '@/contexts/AppShellContext';
import { ConvergenceFlow } from '@/features/convergence/components/ConvergenceFlow';
import PromptOptimizerWorkspace from '@/features/prompt-optimizer/PromptOptimizerContainer';
import { GenerationControlsProvider } from '@/features/prompt-optimizer/context/GenerationControlsContext';

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
        // Render ConvergenceFlow when Create tool is active
        <ConvergenceFlow />
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
