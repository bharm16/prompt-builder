/**
 * PanelHeader Component
 *
 * Header section for SuggestionsPanel including title, actions, and context display.
 */

import { X, RefreshCw } from "@promptstudio/system/components/ui";
import { Button } from "@promptstudio/system/components/ui/button";
import type { PanelIcon } from "./types";

interface PanelHeaderProps {
  panelTitle?: string;
  onRefresh?: () => void;
  onClose?: () => void;
  hasActiveSuggestions?: boolean;
  contextValue?: string;
  contextLabel?: string;
  contextSecondaryValue?: string;
  contextIcon?: PanelIcon;
  showContextBadge?: boolean;
  contextBadgeText?: string;
  contextBadgeIcon?: PanelIcon;
  isPlaceholder?: boolean;
}

export function PanelHeader({
  panelTitle = "",
  onRefresh,
  onClose,
  hasActiveSuggestions = false,
  contextValue = "",
  contextLabel = "For",
  contextSecondaryValue,
  contextIcon: ContextIcon,
  showContextBadge = false,
  contextBadgeText = "Context-aware",
  contextBadgeIcon: ContextBadgeIcon,
  isPlaceholder = false,
}: PanelHeaderProps): React.ReactElement {
  return (
    <header className="bg-app flex-shrink-0 border-b border-transparent px-3 py-3">
      <div className="flex items-center justify-end gap-2">
        <div className="flex items-center gap-1">
          {onRefresh && (
            <Button
              onClick={onRefresh}
              variant="ghost"
              size="icon"
              className="text-muted hover:bg-surface-1 hover:text-foreground h-6 w-6 rounded-md p-0 transition-colors duration-150"
              title="Refresh suggestions"
              aria-label="Refresh suggestions"
            >
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
            </Button>
          )}
          {onClose && (
            <Button
              onClick={onClose}
              variant="ghost"
              size="icon"
              className="text-muted hover:bg-surface-1 hover:text-foreground h-6 w-6 rounded-md p-0 transition-colors duration-150"
              title="Close suggestions"
              aria-label="Close suggestions"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>

      {hasActiveSuggestions && contextValue && (
        <div className="mt-2 flex flex-col gap-2">
          {showContextBadge && (
            <div className="flex items-center gap-2">
              <span className="text-label-12 bg-surface-1 text-foreground border-border inline-flex items-center gap-1 rounded-md border px-2 py-1">
                {ContextBadgeIcon ? (
                  <ContextBadgeIcon className="h-3 w-3" aria-hidden="true" />
                ) : null}
                {contextBadgeText}
              </span>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <div className="flex items-start gap-2">
              {ContextIcon ? (
                <div className="bg-surface-1 border-border flex-shrink-0 rounded-md border p-1">
                  <ContextIcon
                    className="text-muted h-3 w-3"
                    aria-hidden="true"
                  />
                </div>
              ) : null}
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-label-12 text-muted font-medium uppercase tracking-wide">
                      Editing:
                    </span>
                    <span className="text-label-12 text-foreground break-words font-medium">
                      "{contextValue}"
                    </span>
                  </div>
                  {contextSecondaryValue && (
                    <div className="flex items-center gap-2">
                      <span className="text-label-12 text-muted font-medium uppercase tracking-wide">
                        Category:
                      </span>
                      <span className="text-label-12 text-foreground break-words capitalize">
                        {contextSecondaryValue}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
