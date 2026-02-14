import type { ReactElement } from 'react';
import { ToolRail } from './components/ToolRail';
import { ToolPanel } from './components/ToolPanel';
import { SessionsPanel } from './components/panels/SessionsPanel';
import { GenerationControlsPanel } from './components/panels/GenerationControlsPanel';
import { CharactersPanel } from './components/panels/CharactersPanel';
import { StylesPanel } from './components/panels/StylesPanel';
import { useToolSidebarState } from './hooks/useToolSidebarState';
import type { ToolSidebarProps } from './types';
import {
  SidebarDataContextProvider,
  useSidebarData,
  useSidebarAssetsDomain,
  useSidebarGenerationDomain,
  useSidebarPromptInteractionDomain,
  useSidebarSessionsDomain,
} from './context';

/**
 * ToolSidebar - Main orchestrator for the Runway-style sidebar
 *
 * Layout: 60px rail + 400px panel (always visible side-by-side)
 * 
 * Requirement 16.1-16.4: Tool panel integration with Create and Studio tools
 */
export function ToolSidebar(props: ToolSidebarProps): ReactElement {
  const { user } = props;
  const sidebarDataFromContext = useSidebarData();
  const sessionsFromContext = useSidebarSessionsDomain();
  const promptInteractionFromContext = useSidebarPromptInteractionDomain();
  const generationFromContext = useSidebarGenerationDomain();
  const assetsFromContext = useSidebarAssetsDomain();

  const resolvedSessions = props.sessions ?? sessionsFromContext ?? sidebarDataFromContext?.sessions ?? null;
  const resolvedPromptInteraction =
    props.promptInteraction ??
    promptInteractionFromContext ??
    sidebarDataFromContext?.promptInteraction ??
    null;
  const resolvedGeneration =
    props.generation ?? generationFromContext ?? sidebarDataFromContext?.generation ?? null;
  const resolvedAssets = props.assets ?? assetsFromContext ?? sidebarDataFromContext?.assets ?? null;

  const { activePanel, setActivePanel } = useToolSidebarState('studio');

  return (
    <SidebarDataContextProvider
      value={{
        sessions: resolvedSessions,
        promptInteraction: resolvedPromptInteraction,
        generation: resolvedGeneration,
        assets: resolvedAssets,
      }}
    >
      <div className="flex h-full">
        <ToolRail
          activePanel={activePanel}
          onPanelChange={setActivePanel}
          user={user}
        />
        <ToolPanel activePanel={activePanel}>
          {activePanel === 'sessions' && (
            <SessionsPanel onBack={() => setActivePanel('studio')} />
          )}

          {activePanel === 'studio' && (
            <GenerationControlsPanel onBack={() => setActivePanel('sessions')} />
          )}

          {activePanel === 'characters' && <CharactersPanel />}

          {activePanel === 'apps' && (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <div className="text-sm font-semibold text-[#8B92A5]">Apps</div>
              <div className="mt-2 text-xs text-[#555B6E]">Third-party integrations coming soon.</div>
            </div>
          )}

          {activePanel === 'styles' && <StylesPanel />}
        </ToolPanel>
      </div>
    </SidebarDataContextProvider>
  );
}
