/**
 * PanelHeader Component
 *
 * Header section for SuggestionsPanel including title, actions, and context display.
 * Following VideoConceptBuilder pattern: components/ProgressHeader.tsx
 */

import { X, RefreshCw } from '@promptstudio/system/components/ui';
import { Button } from '@promptstudio/system/components/ui/button';
import type { PanelIcon } from './types';

interface PanelHeaderProps {
  panelTitle?: string;
  onRefresh?: (() => void);
  onClose?: (() => void);
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
  panelTitle = '',
  onRefresh,
  onClose,
  hasActiveSuggestions = false,
  contextValue = '',
  contextLabel = 'For',
  contextSecondaryValue,
  contextIcon: ContextIcon,
  showContextBadge = false,
  contextBadgeText = 'Context-aware',
  contextBadgeIcon: ContextBadgeIcon,
  isPlaceholder = false,
}: PanelHeaderProps): React.ReactElement {
  return (
    <header className="flex-shrink-0 px-3 py-3 bg-app border-b border-transparent">
      <div className="flex items-center justify-end gap-2">
        <div className="flex items-center gap-1">
          {onRefresh && (
            <Button
              onClick={onRefresh}
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-md p-0 text-muted transition-colors duration-150 hover:bg-surface-1 hover:text-foreground"
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
              className="h-6 w-6 rounded-md p-0 text-muted transition-colors duration-150 hover:bg-surface-1 hover:text-foreground"
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
              <span className="inline-flex items-center gap-1 px-2 py-1 text-label-12 rounded-md bg-surface-1 text-foreground border border-border">
                {ContextBadgeIcon ? <ContextBadgeIcon className="h-3 w-3" aria-hidden="true" /> : null}
                {contextBadgeText}
              </span>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <div className="flex items-start gap-2">
              {ContextIcon ? (
                <div className="p-1 bg-surface-1 rounded-md border border-border flex-shrink-0">
                  <ContextIcon className="h-3 w-3 text-muted" aria-hidden="true" />
                </div>
              ) : null}
              <div className="flex-1 min-w-0">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-label-12 font-medium text-muted uppercase tracking-wide">
                      Editing:
                    </span>
                    <span className="text-label-12 text-foreground break-words font-medium">
                      "{contextValue}"
                    </span>
                  </div>
                  {contextSecondaryValue && (
                    <div className="flex items-center gap-2">
                      <span className="text-label-12 font-medium text-muted uppercase tracking-wide">
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
