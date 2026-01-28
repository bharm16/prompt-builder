import React from 'react';
import { useAppShell } from '@/contexts/AppShellContext';
import PromptOptimizerWorkspace from '@/features/prompt-optimizer/PromptOptimizerContainer';
import { GenerationControlsProvider } from '@/features/prompt-optimizer/context/GenerationControlsContext';

/**
 * MainWorkspace - Unified renderer for Studio/Create tools
 */
export function MainWorkspace(): React.ReactElement {
  const { activeTool, convergenceHandoff } = useAppShell();

  return (
    <GenerationControlsProvider>
      <PromptOptimizerWorkspace
        convergenceHandoff={activeTool === 'studio' ? convergenceHandoff : null}
        mode={activeTool}
      />
    </GenerationControlsProvider>
  );
}

MainWorkspace.displayName = 'MainWorkspace';

export default MainWorkspace;
