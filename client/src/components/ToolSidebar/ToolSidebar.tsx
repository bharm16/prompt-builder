import { useCallback, type ReactElement } from 'react';
import { Sheet, SheetContent } from '@promptstudio/system/components/ui/sheet';
import { FEATURES } from '@/config/features.config';
import { dispatchPromptFocusIntent } from '@/features/prompt-optimizer/CanvasWorkspace/events';
import { ToolRail } from './components/ToolRail';
import { ToolPanel } from './components/ToolPanel';
import { SessionsPanel } from './components/panels/SessionsPanel';
import { GenerationControlsPanel } from './components/panels/GenerationControlsPanel';
import { CharactersPanel } from './components/panels/CharactersPanel';
import { StylesPanel } from './components/panels/StylesPanel';
import { useToolSidebarState } from './hooks/useToolSidebarState';
import type { ToolPanelType, ToolSidebarProps } from './types';
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
  const isCanvasFirstLayout = FEATURES.CANVAS_FIRST_LAYOUT;

  const handlePanelChange = useCallback(
    (panel: ToolPanelType): void => {
      const previousPanel = activePanel;
      setActivePanel(panel);

      if (isCanvasFirstLayout && panel === 'studio' && previousPanel !== 'studio') {
        dispatchPromptFocusIntent({ source: 'tool-rail' });
      }
    },
    [activePanel, isCanvasFirstLayout, setActivePanel]
  );

  const renderPanelContent = (panel: ToolPanelType): ReactElement | null => {
    if (panel === 'sessions') {
      return <SessionsPanel onBack={() => setActivePanel('studio')} />;
    }

    if (panel === 'studio') {
      return <GenerationControlsPanel onBack={() => setActivePanel('sessions')} />;
    }

    if (panel === 'characters') {
      return <CharactersPanel />;
    }

    if (panel === 'styles') {
      return <StylesPanel />;
    }

    if (panel === 'apps') {
      return (
        <div className="flex h-full flex-col items-center justify-center px-6 text-center">
          <div className="text-sm font-semibold text-[#8B92A5]">Apps</div>
          <div className="mt-2 text-xs text-[#555B6E]">
            Third-party integrations coming soon.
          </div>
        </div>
      );
    }

    return null;
  };

  const isSheetPanelActive = activePanel !== 'studio';

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
          onPanelChange={handlePanelChange}
          user={user}
        />
        {isCanvasFirstLayout ? (
          <Sheet
            open={isSheetPanelActive}
            onOpenChange={(open) => {
              if (!open) {
                setActivePanel('studio');
              }
            }}
          >
            <SheetContent
              side="left"
              className="w-[400px] border-l border-r border-[#1A1C22] bg-[linear-gradient(180deg,#11131A_0%,#0D0F16_100%)] p-0 text-white sm:max-w-none"
            >
              <div className="flex h-full flex-col bg-[rgba(15,18,26,0.7)]">
                {renderPanelContent(activePanel)}
              </div>
            </SheetContent>
          </Sheet>
        ) : (
          <ToolPanel activePanel={activePanel}>
            {renderPanelContent(activePanel)}
          </ToolPanel>
        )}
      </div>
    </SidebarDataContextProvider>
  );
}
