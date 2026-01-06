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

import React, { useState, useEffect, memo } from 'react';
import { useDebugLogger } from '@hooks/useDebugLogger';

// Hooks
import { useSuggestionsState } from './hooks/useSuggestionsState';
import { useCustomRequest } from './hooks/useCustomRequest';

// Components
import { PanelHeader } from './components/PanelHeader';
import { CategoryTabs } from './components/CategoryTabs';
import { CustomRequestForm } from './components/CustomRequestForm';
import { SuggestionsList } from './components/SuggestionsList';
import { LoadingState, EmptyState, ErrorState, InactiveState } from './components/PanelStates';

// Utils
import { cn } from '@/utils/cn';

// Utils

// Config
import {
  DEFAULT_INACTIVE_STATE,
  DEFAULT_EMPTY_STATE,
  DEFAULT_ERROR_STATE,
  DEFAULT_PANEL_CONFIG,
} from './config/panelConfig';
import type { EmptyStateConfig, ErrorStateConfig, InactiveStateConfig, PanelIcon } from './components/types';
import type { SuggestionItem } from './hooks/types';

// Styles
import './SuggestionsPanel.css';

const EMPTY_SUGGESTIONS: SuggestionItem[] = [];

interface SuggestionsPanelProps {
  suggestionsData?: {
    show?: boolean;
    suggestions?: SuggestionItem[];
    isLoading?: boolean;
    isError?: boolean;
    errorMessage?: string | null;
    onSuggestionClick?: (suggestion: SuggestionItem | string) => void | Promise<void>;
    onClose?: () => void;
    onRefresh?: () => void;
    onRetry?: () => void;
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
    contextIcon?: PanelIcon;
    showContextBadge?: boolean;
    contextBadgeText?: string;
    contextBadgeIcon?: PanelIcon;
    keyboardHint?: string;
    emptyState?: EmptyStateConfig;
    errorState?: ErrorStateConfig;
    inactiveState?: InactiveStateConfig;
    footer?: React.ReactNode;
    showCategoryTabs?: boolean;
    showCopyAction?: boolean;
    initialCategory?: string | null;
    currentPrompt?: string;
    variant?: 'default' | 'tokenEditor';
    tokenEditorLayout?: 'full' | 'listOnly';
  };
}

const SuggestionsPanel = memo(function SuggestionsPanel({
  suggestionsData = {},
}: SuggestionsPanelProps): React.ReactElement {
  // Debug logging
  const debug = useDebugLogger('SuggestionsPanel', {
    show: suggestionsData.show,
    suggestionCount: suggestionsData.suggestions?.length ?? 0,
  });

  // ===========================
  // PROPS DESTRUCTURING
  // ===========================
  const {
    show = false,
    suggestions = EMPTY_SUGGESTIONS,
    isLoading = false,
    isError = false,
    errorMessage,
    onSuggestionClick = () => {},
    onClose,
    onRefresh,
    onRetry,
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
    errorState = suggestionsData.errorState || DEFAULT_ERROR_STATE,
    inactiveState =
      suggestionsData.inactiveState || DEFAULT_INACTIVE_STATE,
    footer = suggestionsData.footer,
    showCategoryTabs = suggestionsData.showCategoryTabs !== false,
    showCopyAction = suggestionsData.showCopyAction !== false,
    initialCategory = suggestionsData.initialCategory,
    currentPrompt = suggestionsData.currentPrompt || fullPrompt || '',
    variant = suggestionsData.variant || 'default',
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
    debug.logAction('categoryChange', { category, previousCategory: activeCategory });
    dispatch({ type: actions.SET_ACTIVE_CATEGORY, payload: category });
  };

  // Log panel open/close
  useEffect(() => {
    if (show) {
      debug.logEffect('Panel opened', {
        suggestionCount: suggestions.length,
        hasSelectedText: !!selectedText,
      });
    } else {
      debug.logEffect('Panel closed');
    }
  }, [show, suggestions.length, selectedText, debug]);

  // Pulse animation when panel opens with selection
  useEffect(() => {
    if (show && selectedText) {
      // Trigger pulse animation
      const panelElement = document.querySelector('[role="complementary"]');
      if (panelElement) {
        panelElement.classList.add('suggestions-panel--pulse');
        setTimeout(() => {
          panelElement.classList.remove('suggestions-panel--pulse');
        }, 300);
      }
    }
  }, [show, selectedText]);

  // ===========================
  // COMPUTED VALUES
  // ===========================
  const hasActiveSuggestions = show;

  // ===========================
  // RENDER
  // ===========================
  // Check if we should show hover preview (from props)
  const hoverPreview = (suggestionsData as Record<string, unknown>)?.hoverPreview as boolean | undefined;

  if (variant === 'tokenEditor') {
    const showTokenEditorHeader = (suggestionsData as Record<string, unknown>)?.tokenEditorHeader !== false;
    const tokenEditorLayout =
      ((suggestionsData as Record<string, unknown>)?.tokenEditorLayout as
        | 'full'
        | 'listOnly'
        | undefined) || 'full';

    if (tokenEditorLayout === 'listOnly') {
      return (
        <aside
          className={`${panelClassName} ${hoverPreview ? 'suggestions-panel--hover-preview' : ''}`}
          role="complementary"
          aria-label="Refine suggestions"
        >
          <div className="flex flex-col">
            {hasActiveSuggestions && isLoading && (
              <div className="text-label-12 text-geist-accents-5" role="status" aria-live="polite">
                Loading alternatives…
              </div>
            )}

            {hasActiveSuggestions && !isLoading && isError && (
              <div className="space-y-2">
                <div className="text-label-12 text-geist-accents-5">
                  {typeof errorMessage === 'string' && errorMessage.trim()
                    ? errorMessage
                    : 'Failed to load alternatives.'}
                </div>
                {onRetry && (
                  <button
                    type="button"
                    onClick={onRetry}
                    className="inline-flex items-center justify-center px-geist-3 py-geist-1.5 text-label-12 rounded-geist border border-geist-accents-2 bg-geist-background text-geist-foreground hover:bg-geist-accents-1 transition-colors"
                  >
                    Retry
                  </button>
                )}
              </div>
            )}

            {hasActiveSuggestions && !isLoading && !isError && currentSuggestions.length > 0 && (
              <SuggestionsList
                suggestions={currentSuggestions}
                onSuggestionClick={onSuggestionClick}
                isPlaceholder={isPlaceholder}
                showCopyAction={false}
                variant="tokenEditor"
              />
            )}

            {hasActiveSuggestions && !isLoading && !isError && currentSuggestions.length === 0 && (
              <div className="text-label-12 text-geist-accents-5">No alternatives yet.</div>
            )}

            {hasActiveSuggestions && enableCustomRequest && (
              <>
                <div className="suggestions-panel__divider" aria-hidden="true" />
                <CustomRequestForm
                  customRequest={customRequest}
                  onCustomRequestChange={setCustomRequest}
                  onSubmit={handleCustomRequest}
                  isLoading={isCustomLoading}
                  placeholder={customRequestPlaceholder}
                  helperText={customRequestHelperText}
                  ctaLabel={customRequestCtaLabel}
                  variant="tokenEditor"
                />
              </>
            )}
          </div>
        </aside>
      );
    }

    return (
      <aside
        className={`${panelClassName} ${hoverPreview ? 'suggestions-panel--hover-preview' : ''}`}
        role="complementary"
        aria-label="Refine suggestions"
      >
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {showTokenEditorHeader ? (
            <div className="px-geist-4 pt-geist-3 pb-geist-2">
              <div className="text-[12px] font-medium text-geist-accents-5 uppercase tracking-[0.08em]">
                Suggestions
              </div>
            </div>
          ) : null}

          <div className="flex-1 min-h-0 overflow-hidden">
            {!hasActiveSuggestions ? (
              <div className="px-geist-4 pb-geist-4 text-label-12 text-geist-accents-5">
                Select a token to load alternatives.
              </div>
            ) : isLoading ? (
              <div
                className="px-geist-4 pb-geist-4 text-label-12 text-geist-accents-5"
                role="status"
                aria-live="polite"
              >
                Loading alternatives…
              </div>
            ) : isError ? (
              <div className="px-geist-4 pb-geist-4 space-y-2">
                <div className="text-label-12 text-geist-accents-5">
                  {typeof errorMessage === 'string' && errorMessage.trim()
                    ? errorMessage
                    : 'Failed to load alternatives.'}
                </div>
                {onRetry && (
                  <button
                    type="button"
                    onClick={onRetry}
                    className="inline-flex items-center justify-center px-geist-3 py-geist-1.5 text-label-12 rounded-geist border border-geist-accents-2 bg-geist-background text-geist-foreground hover:bg-geist-accents-1 transition-colors"
                  >
                    Retry
                  </button>
                )}
              </div>
            ) : currentSuggestions.length > 0 ? (
              <SuggestionsList
                suggestions={currentSuggestions}
                onSuggestionClick={onSuggestionClick}
                isPlaceholder={isPlaceholder}
                showCopyAction={false}
                variant="tokenEditor"
              />
            ) : (
              <div className="px-geist-4 pb-geist-4 text-label-12 text-geist-accents-5">
                No alternatives yet.
              </div>
            )}
          </div>

          {hasActiveSuggestions && enableCustomRequest && (
            <CustomRequestForm
              customRequest={customRequest}
              onCustomRequestChange={setCustomRequest}
              onSubmit={handleCustomRequest}
              isLoading={isCustomLoading}
              placeholder={customRequestPlaceholder}
              helperText={customRequestHelperText}
              ctaLabel={customRequestCtaLabel}
              variant="tokenEditor"
            />
          )}
        </div>
      </aside>
    );
  }

  return (
    <aside
      className={`${panelClassName} ${hoverPreview ? 'suggestions-panel--hover-preview' : ''}`}
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

            {!isLoading && isError && (
              <ErrorState
                errorState={errorState}
                {...(typeof errorMessage === 'string' ? { errorMessage } : {})}
                {...(onRetry ? { onRetry } : {})}
              />
            )}

            {!isLoading && !isError && currentSuggestions.length > 0 && (
              <SuggestionsList
                suggestions={currentSuggestions}
                onSuggestionClick={onSuggestionClick}
                isPlaceholder={isPlaceholder}
                showCopyAction={showCopyAction}
              />
            )}

            {!isLoading && !isError && currentSuggestions.length === 0 && (
              <EmptyState emptyState={emptyState} />
            )}
          </>
        ) : (
          <InactiveState inactiveState={inactiveState} />
        )}
      </div>

      {hasActiveSuggestions && footer}
    </aside>
  );
});

SuggestionsPanel.displayName = 'SuggestionsPanel';

export { SuggestionsPanel };
export default SuggestionsPanel;
