import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactElement,
} from "react";
import { FEATURES } from "@/config/features.config";
import { dispatchPromptFocusIntent } from "@features/workspace-shell/events";
import type { PromptHistoryEntry } from "@/features/prompt-optimizer/types/domain/prompt-session";
import { ToolRail } from "./components/ToolRail";
import { ToolPanel } from "./components/ToolPanel";
import { SessionsPanel } from "./components/panels/SessionsPanel";
import { GenerationControlsPanel } from "./components/panels/GenerationControlsPanel";
import { CharactersPanel } from "./components/panels/CharactersPanel";
import { StylesPanel } from "./components/panels/StylesPanel";
import { useToolSidebarState } from "./hooks/useToolSidebarState";
import type { ToolPanelType, ToolSidebarProps } from "./types";
import { useSidebarSessionsDomain, useSidebarWorkspaceDomain } from "./context";

/**
 * ToolSidebar - Main orchestrator for the Runway-style sidebar
 *
 * Layout: 60px rail + 400px panel (always visible side-by-side)
 *
 * Data flows through SidebarDataContext, set by SidebarDataProvider
 * in the prompt-optimizer workspace tree.
 *
 * Requirement 16.1-16.4: Tool panel integration with Create and Studio tools
 */
export function ToolSidebar(props: ToolSidebarProps): ReactElement {
  const { user, forceDefaultPanel } = props;
  const sessions = useSidebarSessionsDomain();
  const workspace = useSidebarWorkspaceDomain();
  const onSessionCreateNew = sessions?.onCreateNew;
  const onSessionLoadFromHistory = sessions?.onLoadFromHistory;

  const stateOptions = useMemo(
    () => ({ forceDefault: forceDefaultPanel }),
    [forceDefaultPanel],
  );
  const { activePanel, setActivePanel } = useToolSidebarState(
    "studio",
    stateOptions,
  );
  const isCanvasFirstLayout = FEATURES.CANVAS_FIRST_LAYOUT;
  const activePanelRef = useRef(activePanel);
  useEffect(() => {
    activePanelRef.current = activePanel;
  }, [activePanel]);

  const handlePanelChange = useCallback(
    (panel: ToolPanelType): void => {
      const previousPanel = activePanelRef.current;
      setActivePanel(panel);

      if (
        isCanvasFirstLayout &&
        panel === "studio" &&
        previousPanel !== "studio"
      ) {
        dispatchPromptFocusIntent({ source: "tool-rail" });
      }
    },
    [isCanvasFirstLayout, setActivePanel],
  );
  const handleSessionsBack = useCallback((): void => {
    setActivePanel("studio");
  }, [setActivePanel]);
  const handleStudioBack = useCallback((): void => {
    setActivePanel("sessions");
  }, [setActivePanel]);
  const handleSessionsActionComplete = useCallback((): void => {
    setActivePanel("studio");
    if (isCanvasFirstLayout) {
      dispatchPromptFocusIntent({ source: "tool-rail" });
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
    [handleSessionsActionComplete, onSessionLoadFromHistory],
  );

  const renderPanelContent = (panel: ToolPanelType): ReactElement | null => {
    if (panel === "sessions") {
      return (
        <SessionsPanel
          onBack={handleSessionsBack}
          onCreateNew={handleSessionCreateNew}
          onLoadFromHistory={handleSessionLoad}
        />
      );
    }

    if (panel === "studio") {
      return <GenerationControlsPanel onBack={handleStudioBack} />;
    }

    if (panel === "characters") {
      return <CharactersPanel />;
    }

    if (panel === "styles") {
      return <StylesPanel />;
    }

    return null;
  };

  const isOverlayPanelActive = isCanvasFirstLayout && activePanel !== "studio";
  const overlayPanelContent = isOverlayPanelActive
    ? renderPanelContent(activePanel)
    : null;

  return (
    <div className="relative flex h-full overflow-visible">
      <ToolRail
        activePanel={activePanel}
        onPanelChange={handlePanelChange}
        onGalleryToggle={workspace?.toggleGallery}
        user={user}
      />
      {isCanvasFirstLayout ? (
        overlayPanelContent ? (
          <div
            className="absolute left-full top-0 z-20 h-full w-[400px] border-r border-tool-rail-border bg-[linear-gradient(180deg,#11131A_0%,#0D0F16_100%)] text-white shadow-[24px_0_80px_rgba(0,0,0,0.45)]"
            data-testid="tool-sidebar-overlay-panel"
          >
            <div className="flex h-full flex-col bg-[rgba(15,18,26,0.7)]">
              <div
                key={activePanel}
                className="motion-presence-panel h-full ps-animate-fade-in"
                data-motion-state="entered"
              >
                {overlayPanelContent}
              </div>
            </div>
          </div>
        ) : null
      ) : (
        <ToolPanel activePanel={activePanel}>
          <div
            key={activePanel}
            className="motion-presence-panel h-full ps-animate-fade-in"
            data-motion-state="entered"
          >
            {renderPanelContent(activePanel)}
          </div>
        </ToolPanel>
      )}
    </div>
  );
}
