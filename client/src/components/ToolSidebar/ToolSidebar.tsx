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
  SidebarAssetsContextProvider,
  SidebarGenerationContextProvider,
  SidebarPromptEditingContextProvider,
  SidebarSessionsContextProvider,
  useSidebarAssetsDomain,
  useSidebarGenerationDomain,
  useSidebarPromptEditingDomain,
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
  const sessionsFromContext = useSidebarSessionsDomain();
  const promptEditingFromContext = useSidebarPromptEditingDomain();
  const generationFromContext = useSidebarGenerationDomain();
  const assetsFromContext = useSidebarAssetsDomain();

  const resolvedSessions = props.sessions ?? sessionsFromContext;
  const resolvedPromptEditing = props.promptEditing ?? promptEditingFromContext;
  const resolvedGeneration = props.generation ?? generationFromContext;
  const resolvedAssets = props.assets ?? assetsFromContext;

  const { activePanel, setActivePanel } = useToolSidebarState('studio');

  return (
    <SidebarSessionsContextProvider value={resolvedSessions}>
      <SidebarPromptEditingContextProvider value={resolvedPromptEditing}>
        <SidebarGenerationContextProvider value={resolvedGeneration}>
          <SidebarAssetsContextProvider value={resolvedAssets}>
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
          </SidebarAssetsContextProvider>
        </SidebarGenerationContextProvider>
      </SidebarPromptEditingContextProvider>
    </SidebarSessionsContextProvider>
  );
}
