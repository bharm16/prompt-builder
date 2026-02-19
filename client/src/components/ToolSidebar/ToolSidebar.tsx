import { useCallback, useEffect, useMemo, useRef, type ReactElement } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@promptstudio/system/components/ui/sheet';
import { FEATURES } from '@/config/features.config';
import { dispatchPromptFocusIntent } from '@/features/prompt-optimizer/CanvasWorkspace/events';
import type { PromptHistoryEntry } from '@/features/prompt-optimizer/types/domain/prompt-session';
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
  useSidebarWorkspaceDomain,
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
  const hasDomainOverrides =
    props.sessions !== undefined ||
    props.promptInteraction !== undefined ||
    props.generation !== undefined ||
    props.assets !== undefined ||
    props.workspace !== undefined;
  const sidebarDataFromContext = useSidebarData();
  const sessionsFromContext = useSidebarSessionsDomain();
  const promptInteractionFromContext = useSidebarPromptInteractionDomain();
  const generationFromContext = useSidebarGenerationDomain();
  const assetsFromContext = useSidebarAssetsDomain();
  const workspaceFromContext = useSidebarWorkspaceDomain();

  const resolvedSessions = props.sessions ?? sessionsFromContext ?? sidebarDataFromContext?.sessions ?? null;
  const resolvedPromptInteraction =
    props.promptInteraction ??
    promptInteractionFromContext ??
    sidebarDataFromContext?.promptInteraction ??
    null;
  const resolvedGeneration =
    props.generation ?? generationFromContext ?? sidebarDataFromContext?.generation ?? null;
  const resolvedAssets = props.assets ?? assetsFromContext ?? sidebarDataFromContext?.assets ?? null;
  const resolvedWorkspace =
    props.workspace ?? workspaceFromContext ?? sidebarDataFromContext?.workspace ?? null;
  const onSessionCreateNew = resolvedSessions?.onCreateNew;
  const onSessionLoadFromHistory = resolvedSessions?.onLoadFromHistory;
  const sidebarContextValue = useMemo(
    () => ({
      sessions: resolvedSessions,
      promptInteraction: resolvedPromptInteraction,
      generation: resolvedGeneration,
      assets: resolvedAssets,
      workspace: resolvedWorkspace,
    }),
    [
      resolvedAssets,
      resolvedGeneration,
      resolvedPromptInteraction,
      resolvedSessions,
      resolvedWorkspace,
    ]
  );

  const { activePanel, setActivePanel } = useToolSidebarState('studio');
  const isCanvasFirstLayout = FEATURES.CANVAS_FIRST_LAYOUT;
  const activePanelRef = useRef(activePanel);
  useEffect(() => {
    activePanelRef.current = activePanel;
  }, [activePanel]);

  const handlePanelChange = useCallback(
    (panel: ToolPanelType): void => {
      const previousPanel = activePanelRef.current;
      setActivePanel(panel);

      if (isCanvasFirstLayout && panel === 'studio' && previousPanel !== 'studio') {
        dispatchPromptFocusIntent({ source: 'tool-rail' });
      }
    },
    [isCanvasFirstLayout, setActivePanel]
  );
  const handleSheetOpenChange = useCallback(
    (open: boolean): void => {
      if (!open) {
        setActivePanel('studio');
      }
    },
    [setActivePanel]
  );
  const handleSessionsBack = useCallback((): void => {
    setActivePanel('studio');
  }, [setActivePanel]);
  const handleStudioBack = useCallback((): void => {
    setActivePanel('sessions');
  }, [setActivePanel]);
  const handleSessionsActionComplete = useCallback((): void => {
    setActivePanel('studio');
    if (isCanvasFirstLayout) {
      dispatchPromptFocusIntent({ source: 'tool-rail' });
    }
  }, [isCanvasFirstLayout, setActivePanel]);
  const handleSessionCreateNew = useCallback((): void => {
    onSessionCreateNew?.();
    handleSessionsActionComplete();
  }, [handleSessionsActionComplete, onSessionCreateNew]);
  const handleSessionLoad = useCallback(
    (entry: PromptHistoryEntry): void => {
      onSessionLoadFromHistory?.(entry);
      handleSessionsActionComplete();
    },
    [handleSessionsActionComplete, onSessionLoadFromHistory]
  );

  const renderPanelContent = (panel: ToolPanelType): ReactElement | null => {
    if (panel === 'sessions') {
      return (
        <SessionsPanel
          onBack={handleSessionsBack}
          onCreateNew={handleSessionCreateNew}
          onLoadFromHistory={handleSessionLoad}
        />
      );
    }

    if (panel === 'studio') {
      return <GenerationControlsPanel onBack={handleStudioBack} />;
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
  const sheetTitle = useMemo((): string => {
    switch (activePanel) {
      case 'sessions':
        return 'Sessions';
      case 'characters':
        return 'Characters';
      case 'styles':
        return 'Styles';
      case 'apps':
        return 'Apps';
      case 'studio':
      default:
        return 'Studio';
    }
  }, [activePanel]);
  const sidebarContent = (
    <div className="flex h-full">
      <ToolRail
        activePanel={activePanel}
        onPanelChange={handlePanelChange}
        user={user}
      />
      {isCanvasFirstLayout ? (
        isSheetPanelActive ? (
          <Sheet
            modal={false}
            open={true}
            onOpenChange={handleSheetOpenChange}
          >
            <SheetContent
              side="left"
              className="w-[400px] border-l border-r border-[#1A1C22] bg-[linear-gradient(180deg,#11131A_0%,#0D0F16_100%)] p-0 text-white sm:max-w-none"
            >
              <SheetTitle className="sr-only">{sheetTitle} panel</SheetTitle>
              <SheetDescription className="sr-only">
                Tool sidebar panel content.
              </SheetDescription>
              <div className="flex h-full flex-col bg-[rgba(15,18,26,0.7)]">
                {renderPanelContent(activePanel)}
              </div>
            </SheetContent>
          </Sheet>
        ) : null
      ) : (
        <ToolPanel activePanel={activePanel}>
          {renderPanelContent(activePanel)}
        </ToolPanel>
      )}
    </div>
  );

  if (hasDomainOverrides) {
    return (
      <SidebarDataContextProvider value={sidebarContextValue}>
        {sidebarContent}
      </SidebarDataContextProvider>
    );
  }

  return sidebarContent;
}
