/**
 * PanelHeader Component
 *
 * Header section for SuggestionsPanel including title, actions, and context display.
 * Following VideoConceptBuilder pattern: components/ProgressHeader.tsx
 */

import { Star as Sparkles, X, RefreshCw } from '@geist-ui/icons';
import type { Icon } from '@geist-ui/icons';

interface PanelHeaderProps {
  panelTitle?: string;
  onRefresh?: (() => void);
  onClose?: (() => void);
  hasActiveSuggestions?: boolean;
  contextValue?: string;
  contextLabel?: string;
  contextSecondaryValue?: string;
  contextIcon?: Icon;
  showContextBadge?: boolean;
  contextBadgeText?: string;
  contextBadgeIcon?: Icon;
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
    <header className="flex-shrink-0 px-geist-4 py-geist-4 bg-gradient-to-b from-geist-accents-1/50 to-geist-background backdrop-blur-sm">
      <div className="flex items-center justify-between gap-geist-2">
        {panelTitle && (
          <div className="flex items-center gap-geist-3 min-w-0 flex-1">
            <div className="p-geist-2 bg-gradient-to-br from-geist-accents-2 to-geist-accents-1 rounded-geist-lg shadow-geist-small ring-1 ring-geist-accents-2/50">
              <Sparkles size={14} color="currentColor" aria-hidden="true" />
            </div>
            <h3 id="suggestions-title" className="text-label-14 text-geist-foreground">
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
              className="p-geist-2 text-geist-accents-5 hover:text-geist-foreground hover:bg-geist-accents-1 rounded-geist transition-all duration-150"
              title="Refresh suggestions"
              aria-label="Refresh suggestions"
            >
              <RefreshCw size={14} aria-hidden="true" />
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-geist-2 text-geist-accents-5 hover:text-geist-foreground hover:bg-geist-accents-1 rounded-geist transition-all duration-150"
              title="Close suggestions"
              aria-label="Close suggestions"
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {hasActiveSuggestions && contextValue && (
        <div className="mt-geist-3 flex flex-col gap-geist-3">
          <div className="flex items-center gap-geist-2">
            <span className="text-label-12 text-geist-accents-6 uppercase tracking-wider">
              {contextLabel}
            </span>
            {showContextBadge && (
              <span className="inline-flex items-center gap-geist-1 px-geist-2 py-geist-1 text-label-12 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                {ContextBadgeIcon ? <ContextBadgeIcon size={12} aria-hidden="true" /> : null}
                {contextBadgeText}
              </span>
            )}
          </div>
          <div className="flex items-start gap-geist-3">
            {ContextIcon ? (
              <div className="p-geist-2 bg-orange-50 rounded-geist border border-orange-200/50 flex-shrink-0">
                <ContextIcon size={14} color="#ea580c" aria-hidden="true" />
              </div>
            ) : null}
            <div className="flex-1 min-w-0">
              <div className="inline-flex items-center gap-geist-2 px-geist-3 py-geist-2 bg-orange-50 border border-orange-200/60 rounded-geist shadow-geist-small">
                <p className="text-label-14 text-orange-900 leading-tight break-words">
                  {contextValue}
                </p>
              </div>
              {contextSecondaryValue && (
                <p className="mt-geist-2 text-label-12 text-geist-accents-6 leading-tight break-words">
                  {contextSecondaryValue}
                </p>
              )}
              <p className="mt-geist-2 text-label-12 text-geist-accents-5 italic leading-tight">
                Alternatives for this phrase
              </p>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

