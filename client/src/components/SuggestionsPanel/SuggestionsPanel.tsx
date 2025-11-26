/**
 * SuggestionsPanel (Refactored)
 *
 * Main orchestration component for the Suggestions Panel.
 * This component is ~180 lines (down from 602 lines) thanks to proper separation of concerns.
 *
 * Architecture:
 * - State management: useSuggestionsState (category logic)
 * - API calls: useCustomRequest (custom suggestions)
 * - Business logic: Extracted to utils/
 * - Configuration: Extracted to config/
 * - UI components: Extracted to components/
 *
 * Following VideoConceptBuilder pattern: VideoConceptBuilder.tsx
 */

import React from 'react';
import type { LucideIcon } from 'lucide-react';

// Hooks
import { useSuggestionsState } from './hooks/useSuggestionsState';
import { useCustomRequest } from './hooks/useCustomRequest';

// Components
import { PanelHeader } from './components/PanelHeader';
import { CategoryTabs } from './components/CategoryTabs';
import { CustomRequestForm } from './components/CustomRequestForm';
import { SuggestionsList } from './components/SuggestionsList';
import { LoadingState, EmptyState, InactiveState } from './components/PanelStates';

// Utils

// Config
import {
  DEFAULT_INACTIVE_STATE,
  DEFAULT_EMPTY_STATE,
  DEFAULT_PANEL_CONFIG,
} from './config/panelConfig';
import type { EmptyStateConfig, InactiveStateConfig } from './components/types';
import type { SuggestionItem } from './hooks/types';

interface SuggestionsPanelProps {
  suggestionsData?: {
    show?: boolean;
    suggestions?: SuggestionItem[];
    isLoading?: boolean;
    onSuggestionClick?: (suggestion: SuggestionItem) => void;
    onClose?: () => void;
    onRefresh?: () => void;
    selectedText?: string;
    isPlaceholder?: boolean;
    setSuggestions?: (suggestions: SuggestionItem[], category?: string) => void;
    fullPrompt?: string;
    panelTitle?: string;
    panelClassName?: string;
    enableCustomRequest?: boolean;
    customRequestPlaceholder?: string;
    customRequestHelperText?: string;
    customRequestCtaLabel?: string;
    onCustomRequest?: (request: string) => Promise<SuggestionItem[]>;
    contextLabel?: string;
    contextValue?: string;
    contextSecondaryValue?: string;
    contextIcon?: LucideIcon;
    showContextBadge?: boolean;
    contextBadgeText?: string;
    contextBadgeIcon?: LucideIcon;
    keyboardHint?: string;
    emptyState?: EmptyStateConfig;
    inactiveState?: InactiveStateConfig;
    footer?: React.ReactNode;
    showCategoryTabs?: boolean;
    showCopyAction?: boolean;
    initialCategory?: string | null;
  };
}

export function SuggestionsPanel({
  suggestionsData = {},
}: SuggestionsPanelProps): React.ReactElement {
  // ===========================
  // PROPS DESTRUCTURING
  // ===========================
  const {
    show = false,
    suggestions = [],
    isLoading = false,
    onSuggestionClick = () => {},
    onClose,
    onRefresh,
    selectedText = '',
    isPlaceholder = false,
    setSuggestions,
    fullPrompt = '',
    panelTitle = suggestionsData.panelTitle || DEFAULT_PANEL_CONFIG.panelTitle,
    panelClassName =
      suggestionsData.panelClassName || DEFAULT_PANEL_CONFIG.panelClassName,
    enableCustomRequest = suggestionsData.enableCustomRequest !== false,
    customRequestPlaceholder =
      suggestionsData.customRequestPlaceholder ||
      DEFAULT_PANEL_CONFIG.customRequestPlaceholder,
    customRequestHelperText =
      suggestionsData.customRequestHelperText ||
      DEFAULT_PANEL_CONFIG.customRequestHelperText,
    customRequestCtaLabel =
      suggestionsData.customRequestCtaLabel ||
      DEFAULT_PANEL_CONFIG.customRequestCtaLabel,
    onCustomRequest: onCustomRequestProp,
    contextLabel =
      suggestionsData.contextLabel || DEFAULT_PANEL_CONFIG.contextLabel,
    contextValue = suggestionsData.contextValue || selectedText,
    contextSecondaryValue = suggestionsData.contextSecondaryValue,
    contextIcon: ContextIcon = suggestionsData.contextIcon,
    showContextBadge =
      suggestionsData.showContextBadge !== undefined
        ? suggestionsData.showContextBadge
        : DEFAULT_PANEL_CONFIG.showContextBadge,
    contextBadgeText =
      suggestionsData.contextBadgeText ||
      DEFAULT_PANEL_CONFIG.contextBadgeText,
    contextBadgeIcon: ContextBadgeIcon =
      suggestionsData.contextBadgeIcon || DEFAULT_PANEL_CONFIG.contextBadgeIcon,
    keyboardHint = suggestionsData.keyboardHint,
    emptyState = suggestionsData.emptyState || DEFAULT_EMPTY_STATE,
    inactiveState =
      suggestionsData.inactiveState || DEFAULT_INACTIVE_STATE,
    footer = suggestionsData.footer,
    showCategoryTabs = suggestionsData.showCategoryTabs !== false,
    showCopyAction = suggestionsData.showCopyAction !== false,
    initialCategory = suggestionsData.initialCategory,
  } = suggestionsData;

  // ===========================
  // STATE MANAGEMENT
  // ===========================
  const { categories, activeCategory, currentSuggestions, dispatch, actions } =
    useSuggestionsState(suggestions, initialCategory);

  const { customRequest, setCustomRequest, handleCustomRequest, isCustomLoading } =
    useCustomRequest({
      selectedText,
      fullPrompt,
      ...(onCustomRequestProp ? { onCustomRequest: onCustomRequestProp } : {}),
      ...(setSuggestions ? { setSuggestions } : {}),
    });

  // ===========================
  // HANDLERS
  // ===========================
  const handleCategoryChange = (category: string): void => {
    dispatch({ type: actions.SET_ACTIVE_CATEGORY, payload: category });
  };

  // ===========================
  // COMPUTED VALUES
  // ===========================
  const hasActiveSuggestions = show;

  // ===========================
  // RENDER
  // ===========================
  return (
    <aside
      className={panelClassName}
      role="complementary"
      {...(panelTitle ? { 'aria-labelledby': 'suggestions-title' } : {})}
    >
      <PanelHeader
        panelTitle={panelTitle}
        {...(onRefresh ? { onRefresh } : {})}
        {...(onClose ? { onClose } : {})}
        hasActiveSuggestions={hasActiveSuggestions}
        contextValue={contextValue}
        contextLabel={contextLabel}
        {...(contextSecondaryValue ? { contextSecondaryValue } : {})}
        {...(ContextIcon ? { contextIcon: ContextIcon } : {})}
        showContextBadge={showContextBadge}
        contextBadgeText={contextBadgeText}
        {...(ContextBadgeIcon ? { contextBadgeIcon: ContextBadgeIcon } : {})}
        isPlaceholder={isPlaceholder}
      />

      {hasActiveSuggestions && (
        <>
          {showCategoryTabs && (
            <CategoryTabs
              categories={categories}
              activeCategory={activeCategory}
              onCategoryChange={handleCategoryChange}
            />
          )}

          {enableCustomRequest && (
            <CustomRequestForm
              customRequest={customRequest}
              onCustomRequestChange={setCustomRequest}
              onSubmit={handleCustomRequest}
              isLoading={isCustomLoading}
              placeholder={customRequestPlaceholder}
              helperText={customRequestHelperText}
              ctaLabel={customRequestCtaLabel}
            />
          )}
        </>
      )}

      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {hasActiveSuggestions ? (
          <>
            {isLoading && (
              <LoadingState
                contextValue={contextValue}
                selectedText={selectedText}
                isPlaceholder={isPlaceholder}
              />
            )}

            {!isLoading && currentSuggestions.length > 0 && (
              <SuggestionsList
                suggestions={currentSuggestions}
                onSuggestionClick={onSuggestionClick}
                isPlaceholder={isPlaceholder}
                showCopyAction={showCopyAction}
              />
            )}

            {!isLoading && currentSuggestions.length === 0 && (
              <EmptyState emptyState={emptyState} />
            )}
          </>
        ) : (
          <InactiveState inactiveState={inactiveState} />
        )}
      </div>

      {hasActiveSuggestions && footer}

      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes shimmer {
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </aside>
  );
}
export default SuggestionsPanel;


