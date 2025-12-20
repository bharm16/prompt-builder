/**
 * PanelHeader Component
 *
 * Header section for SuggestionsPanel including title, actions, and context display.
 * Following VideoConceptBuilder pattern: components/ProgressHeader.tsx
 */

import { Sparkles, X, RefreshCw } from 'lucide-react';
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
    <header className="flex-shrink-0 px-geist-3 py-geist-3 bg-geist-background border-b border-geist-accents-2">
      <div className="flex items-center justify-between gap-geist-2">
        {panelTitle && (
          <div className="flex items-center gap-geist-2 min-w-0 flex-1">
            <div className="p-geist-1 bg-geist-accents-1 rounded-geist border border-geist-accents-2">
              <Sparkles className="h-3 w-3 text-geist-accents-6" aria-hidden="true" />
            </div>
            <h3 id="suggestions-title" className="text-label-12 text-geist-foreground">
              {panelTitle}
            </h3>
          </div>
        )}
        {!panelTitle && (
          <div className="flex-1" />
        )}
        <div className="flex items-center gap-geist-1">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-geist-1 text-geist-accents-5 hover:text-geist-foreground hover:bg-geist-accents-1 rounded-geist transition-colors duration-150"
              title="Refresh suggestions"
              aria-label="Refresh suggestions"
            >
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-geist-1 text-geist-accents-5 hover:text-geist-foreground hover:bg-geist-accents-1 rounded-geist transition-colors duration-150"
              title="Close suggestions"
              aria-label="Close suggestions"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {hasActiveSuggestions && contextValue && (
        <div className="mt-geist-3 flex flex-col gap-geist-2">
          <div className="flex items-center gap-geist-2">
            <span className="text-label-12 text-geist-accents-5 uppercase tracking-wider">
              {contextLabel}
            </span>
            {showContextBadge && (
              <span className="inline-flex items-center gap-geist-1 px-geist-2 py-geist-1 text-label-12 rounded-geist bg-geist-accents-1 text-geist-accents-7 border border-geist-accents-2">
                {ContextBadgeIcon ? <ContextBadgeIcon className="h-3 w-3" aria-hidden="true" /> : null}
                {contextBadgeText}
              </span>
            )}
          </div>
          <div className="flex items-start gap-geist-2">
            {ContextIcon ? (
              <div className="p-geist-1 bg-geist-accents-1 rounded-geist border border-geist-accents-2 flex-shrink-0">
                <ContextIcon className="h-3 w-3 text-geist-accents-6" aria-hidden="true" />
              </div>
            ) : null}
            <div className="flex-1 min-w-0">
              <div className="inline-flex items-center gap-geist-2 px-geist-2 py-geist-1 bg-geist-accents-1 border border-geist-accents-2 rounded-geist">
                <p className="text-label-12 text-geist-foreground break-words">
                  {contextValue}
                </p>
              </div>
              {contextSecondaryValue && (
                <p className="mt-geist-1 text-label-12 text-geist-accents-5 break-words">
                  {contextSecondaryValue}
                </p>
              )}
              <p className="mt-geist-1 text-label-12 text-geist-accents-5 break-words">
                Alternatives for this phrase
              </p>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
