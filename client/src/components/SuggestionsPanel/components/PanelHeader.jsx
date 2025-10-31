/**
 * PanelHeader Component
 *
 * Header section for SuggestionsPanel including title, actions, and context display.
 * Following VideoConceptBuilder pattern: components/ProgressHeader.jsx (76 lines)
 */

import { Sparkles, X, RefreshCw, Info } from 'lucide-react';

export function PanelHeader({
  panelTitle = 'AI Suggestions',
  onRefresh = null,
  onClose = null,
  hasActiveSuggestions = false,
  contextValue = '',
  contextLabel = 'For',
  contextSecondaryValue = '',
  contextIcon: ContextIcon = null,
  showContextBadge = false,
  contextBadgeText = 'Context-aware',
  contextBadgeIcon: ContextBadgeIcon = null,
  isPlaceholder = false,
}) {
  return (
    <header className="flex-shrink-0 px-4 py-3.5 border-b border-neutral-200 bg-gradient-to-b from-neutral-50/50 to-white backdrop-blur-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="p-1.5 bg-gradient-to-br from-neutral-100 to-neutral-50 rounded-lg shadow-sm ring-1 ring-neutral-200/50">
            <Sparkles className="h-3.5 w-3.5 text-neutral-700" aria-hidden="true" />
          </div>
          <h3 id="suggestions-title" className="text-[13px] font-semibold text-neutral-900 tracking-tight">
            {panelTitle}
          </h3>
        </div>
        <div className="flex items-center gap-1">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-all duration-150"
              title="Refresh suggestions"
              aria-label="Refresh suggestions"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-all duration-150"
              title="Close suggestions"
              aria-label="Close suggestions"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {hasActiveSuggestions && contextValue && (
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider">
              {contextLabel}
            </span>
            {showContextBadge && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                {ContextBadgeIcon ? <ContextBadgeIcon className="h-3 w-3" aria-hidden="true" /> : null}
                {contextBadgeText}
              </span>
            )}
          </div>
          <div className="flex items-start gap-2">
            {ContextIcon ? (
              <div className="p-1.5 bg-neutral-100 rounded-md">
                <ContextIcon className="h-3.5 w-3.5 text-neutral-600" aria-hidden="true" />
              </div>
            ) : null}
            <div className="flex-1 min-w-0">
              <p className="text-[12px] text-neutral-900 font-medium leading-tight break-words">
                {contextValue}
              </p>
              {contextSecondaryValue && (
                <p className="text-[11px] text-neutral-500 leading-tight break-words">
                  {contextSecondaryValue}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {isPlaceholder && hasActiveSuggestions && (
        <div className="mt-3 flex items-start gap-3 bg-blue-50 border-l-4 border-blue-500 p-3 rounded-r-lg">
          <div className="p-1 bg-blue-100 rounded-lg">
            <Info className="h-3.5 w-3.5 flex-shrink-0 text-blue-700" aria-hidden="true" />
          </div>
          <p className="text-[12px] leading-relaxed break-words text-blue-900 font-medium">
            Context-aware values to replace your placeholder.
          </p>
        </div>
      )}
    </header>
  );
}
