import React, { useEffect, useMemo, useState } from 'react';
import {
  Sparkles,
  X,
  Info,
  Loader2,
  RefreshCw,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

const DEFAULT_INACTIVE_STATE = {
  icon: Sparkles,
  title: 'Ready to enhance',
  description: 'Highlight any part of your prompt to see AI-powered suggestions for improvement.',
};

const DEFAULT_EMPTY_STATE = {
  icon: Sparkles,
  title: 'No suggestions available',
  description: 'Try selecting a different section or use a custom request above.',
};

export function SuggestionsPanel({ suggestionsData = {} }) {
  const [customRequest, setCustomRequest] = useState('');
  const [isCustomLoading, setIsCustomLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState(null);

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
    panelTitle = suggestionsData.panelTitle || 'AI Suggestions',
    panelClassName = suggestionsData.panelClassName ||
      'w-80 flex-shrink-0 flex flex-col bg-white border-l border-neutral-200 overflow-hidden pt-20',
    enableCustomRequest = suggestionsData.enableCustomRequest !== false,
    customRequestPlaceholder = suggestionsData.customRequestPlaceholder ||
      'Make it more cinematic, brighter, tense, etc.',
    customRequestHelperText = suggestionsData.customRequestHelperText ||
      'Describe the tone, detail, or direction you want to see.',
    customRequestCtaLabel = suggestionsData.customRequestCtaLabel || 'Get Suggestions',
    onCustomRequest,
    contextLabel = suggestionsData.contextLabel || 'For',
    contextValue = suggestionsData.contextValue || selectedText,
    contextSecondaryValue = suggestionsData.contextSecondaryValue,
    contextIcon: ContextIcon = suggestionsData.contextIcon,
    showContextBadge = suggestionsData.showContextBadge || false,
    contextBadgeText = suggestionsData.contextBadgeText || 'Context-aware',
    contextBadgeIcon: ContextBadgeIcon = CheckCircle,
    keyboardHint = suggestionsData.keyboardHint,
    emptyState = suggestionsData.emptyState || DEFAULT_EMPTY_STATE,
    inactiveState = suggestionsData.inactiveState || DEFAULT_INACTIVE_STATE,
    footer = suggestionsData.footer,
    showCategoryTabs = suggestionsData.showCategoryTabs !== false,
    showCopyAction = suggestionsData.showCopyAction !== false,
    initialCategory = suggestionsData.initialCategory,
  } = suggestionsData;

  const hasCategories =
    suggestions?.length > 0 && suggestions[0]?.category !== undefined;
  const isGroupedFormat =
    suggestions?.length > 0 && suggestions[0]?.suggestions !== undefined;

  const categories = useMemo(() => {
    if (!suggestions || suggestions.length === 0) return [];

    if (isGroupedFormat) {
      return suggestions;
    }

    if (hasCategories) {
      const grouped = {};
      suggestions.forEach((suggestion) => {
        const cat = suggestion.category || 'Other';
        if (!grouped[cat]) {
          grouped[cat] = { category: cat, suggestions: [] };
        }
        grouped[cat].suggestions.push(suggestion);
      });
      return Object.values(grouped);
    }

    return [{ category: 'Suggestions', suggestions }];
  }, [suggestions, hasCategories, isGroupedFormat]);

  useEffect(() => {
    if (categories.length === 0) {
      if (activeCategory) setActiveCategory(null);
      return;
    }

    const preferredCategory = initialCategory &&
      categories.some((cat) => cat.category === initialCategory)
      ? initialCategory
      : categories[0].category;

    if (!activeCategory || !categories.some((cat) => cat.category === activeCategory)) {
      setActiveCategory(preferredCategory);
    }
  }, [categories, activeCategory, initialCategory]);

  const currentSuggestions = useMemo(() => {
    if (!categories || categories.length === 0) return [];
    if (!activeCategory) return categories[0]?.suggestions || [];

    const current = categories.find((cat) => cat.category === activeCategory);
    return current?.suggestions || categories[0]?.suggestions || [];
  }, [categories, activeCategory]);

  const hasActiveSuggestions = show;

  const handleCustomRequest = async () => {
    if (!customRequest.trim()) return;

    setIsCustomLoading(true);
    try {
      if (typeof onCustomRequest === 'function') {
        const result = await onCustomRequest(customRequest.trim());
        if (Array.isArray(result) && setSuggestions) {
          setSuggestions(result, undefined);
        }
      } else if (setSuggestions) {
        const fetchFn = typeof fetch !== 'undefined' ? fetch : null;
        if (!fetchFn) {
          throw new Error('Fetch API unavailable');
        }

        const response = await fetchFn('/api/get-custom-suggestions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': 'dev-key-12345',
          },
          body: JSON.stringify({
            highlightedText: selectedText,
            customRequest: customRequest.trim(),
            fullPrompt: fullPrompt || '',
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to fetch custom suggestions');
        }

        const data = await response.json();
        setSuggestions(data.suggestions || [], undefined);
      }
    } catch (error) {
      console.error('Error fetching custom suggestions:', error);
      if (setSuggestions) {
        setSuggestions(
          [{ text: 'Failed to load custom suggestions. Please try again.' }],
          undefined,
        );
      }
    } finally {
      setIsCustomLoading(false);
      setCustomRequest('');
    }
  };

  const handleSuggestionSelect = (suggestion) => {
    const payload =
      typeof suggestion === 'string' ? { text: suggestion } : suggestion;
    onSuggestionClick(payload || {});
  };

  const renderCompatibility = (compatibility) => {
    if (typeof compatibility !== 'number') return null;

    const percent = Math.round(compatibility * 100);
    let tone = 'text-neutral-500 bg-neutral-100 border border-neutral-200';
    let IconComponent = null;

    if (compatibility >= 0.8) {
      tone = 'text-emerald-600 bg-emerald-50 border border-emerald-200';
      IconComponent = CheckCircle;
    } else if (compatibility < 0.6) {
      tone = 'text-amber-600 bg-amber-50 border border-amber-200';
      IconComponent = AlertCircle;
    }

    return (
      <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${tone}`}>
        {IconComponent ? <IconComponent className="h-3.5 w-3.5" aria-hidden="true" /> : null}
        <span>{percent}% fit</span>
      </div>
    );
  };

  const computedKeyboardHint = keyboardHint ||
    (hasActiveSuggestions && currentSuggestions.length > 0
      ? `Use number keys 1-${Math.min(currentSuggestions.length, 8)} for quick selection`
      : null);

  const inactive = inactiveState || DEFAULT_INACTIVE_STATE;
  const empty = emptyState || DEFAULT_EMPTY_STATE;

  const InactiveIcon = inactive.icon || Sparkles;
  const EmptyIcon = empty.icon || Sparkles;

  return (
    <aside className={panelClassName} role="complementary" aria-labelledby="suggestions-title">
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
                  {ContextBadgeIcon ? (
                    <ContextBadgeIcon className="h-3 w-3" aria-hidden="true" />
                  ) : null}
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
      </header>

      {hasActiveSuggestions && (
        <>
          {isPlaceholder && !isLoading && suggestions.length > 0 && (
            <div className="flex-shrink-0 flex items-start gap-3 bg-blue-50 border-l-4 border-blue-500 p-4 border-b border-neutral-200">
              <div className="p-1 bg-blue-100 rounded-lg">
                <Info className="h-3.5 w-3.5 flex-shrink-0 text-blue-700" aria-hidden="true" />
              </div>
              <p className="text-[12px] leading-relaxed break-words text-blue-900 font-medium">
                Context-aware values to replace your placeholder.
              </p>
            </div>
          )}

          {showCategoryTabs && !isLoading && categories.length > 1 && (
            <div className="flex-shrink-0 flex flex-wrap gap-2 p-4 border-b border-neutral-200 bg-gradient-to-b from-neutral-50/50 to-white">
              {categories.map((cat) => (
                <button
                  key={cat.category}
                  onClick={() => setActiveCategory(cat.category)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-lg transition-all duration-150 ${
                    activeCategory === cat.category
                      ? 'bg-neutral-900 text-white shadow-sm'
                      : 'bg-white text-neutral-700 hover:bg-neutral-100 border border-neutral-300 hover:border-neutral-400'
                  }`}
                  aria-pressed={activeCategory === cat.category}
                  aria-label={`Category: ${cat.category} (${cat.suggestions.length} options)`}
                >
                  <span>{cat.category}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      activeCategory === cat.category
                        ? 'bg-white/20'
                        : 'bg-neutral-200 text-neutral-600'
                    }`}
                  >
                    {cat.suggestions.length}
                  </span>
                </button>
              ))}
            </div>
          )}

          {enableCustomRequest && (
            <div className="flex-shrink-0 p-4 border-b border-neutral-200 bg-gradient-to-b from-white to-neutral-50/30 space-y-3">
              <div className="space-y-1">
                <label
                  htmlFor="custom-request"
                  className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wide"
                >
                  Need something specific?
                </label>
                <p className="text-[12px] text-neutral-500 leading-relaxed">
                  {customRequestHelperText}
                </p>
              </div>
              <textarea
                id="custom-request"
                value={customRequest}
                onChange={(e) => setCustomRequest(e.target.value)}
                placeholder={customRequestPlaceholder}
                className="w-full h-20 text-[13px] text-neutral-900 bg-white border border-neutral-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-400"
                maxLength={500}
              />
              <button
                onClick={handleCustomRequest}
                disabled={isCustomLoading || !customRequest.trim()}
                className={`inline-flex items-center justify-center gap-2 w-full px-3 py-2 text-[13px] font-semibold rounded-lg transition-all duration-150 ${
                  isCustomLoading || !customRequest.trim()
                    ? 'bg-neutral-200 text-neutral-500 cursor-not-allowed'
                    : 'bg-neutral-900 text-white hover:bg-neutral-800 shadow-sm'
                }`}
                aria-busy={isCustomLoading}
                aria-live="polite"
              >
                {isCustomLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                    <span>{customRequestCtaLabel}</span>
                  </>
                )}
              </button>
            </div>
          )}
        </>
      )}

      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {hasActiveSuggestions ? (
          <>
            {isLoading && (
              <div className="p-4 space-y-3" role="status" aria-live="polite">
                {Array.from({ length: (() => {
                  const textLength = contextValue?.length || selectedText?.length || 0;
                  if (isPlaceholder) return 4;
                  if (textLength < 20) return 6;
                  if (textLength < 100) return 5;
                  return 4;
                })() }).map((_, i) => (
                  <div
                    key={i}
                    className="relative overflow-hidden p-4 bg-gradient-to-r from-neutral-100 via-neutral-50 to-neutral-100 border border-neutral-200 rounded-xl animate-pulse"
                    style={{ animationDelay: `${i * 75}ms`, animationDuration: '1.5s' }}
                  >
                    <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent" />
                    <div className="relative space-y-2.5">
                      <div
                        className={`h-4 bg-neutral-200/70 rounded-md ${
                          i % 4 === 0
                            ? 'w-3/4'
                            : i % 4 === 1
                              ? 'w-2/3'
                              : i % 4 === 2
                                ? 'w-4/5'
                                : 'w-5/6'
                        }`}
                      />
                      {isPlaceholder ? (
                        <>
                          <div
                            className={`h-3 bg-neutral-200/50 rounded-md ${
                              i % 2 === 0 ? 'w-full' : 'w-11/12'
                            }`}
                          />
                          <div
                            className={`h-3 bg-neutral-200/50 rounded-md ${
                              i % 3 === 0 ? 'w-5/6' : 'w-4/5'
                            }`}
                          />
                        </>
                      ) : (
                        <>
                          <div
                            className={`h-3 bg-neutral-200/50 rounded-md ${
                              i % 2 === 0 ? 'w-full' : 'w-11/12'
                            }`}
                          />
                          {i % 3 !== 2 && (
                            <div
                              className={`h-3 bg-neutral-200/50 rounded-md ${
                                i % 2 === 0 ? 'w-5/6' : 'w-4/5'
                              }`}
                            />
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
                <p className="text-center text-[13px] text-neutral-500 font-medium mt-6">
                  {isPlaceholder ? 'Finding relevant values...' : 'Analyzing context...'}
                </p>
              </div>
            )}

            {!isLoading && currentSuggestions.length > 0 && (
              <div
                className="flex-1 min-h-0 space-y-3 overflow-y-auto p-4 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-neutral-100 [&::-webkit-scrollbar-thumb]:bg-neutral-300 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-neutral-400"
                role="list"
                aria-label="Suggestion options"
                style={{ scrollbarWidth: 'thin', scrollbarColor: '#d1d5db #f3f4f6' }}
              >
                {currentSuggestions.map((suggestion, index) => {
                  const suggestionObj =
                    typeof suggestion === 'string' ? { text: suggestion } : suggestion;
                  const suggestionText = suggestionObj?.text || '';

                  return (
                    <div
                      key={`${suggestionText}-${index}`}
                      className="group relative animate-[slideIn_0.3s_ease-out_forwards] opacity-0"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <button
                        onClick={() => handleSuggestionSelect(suggestionObj)}
                        className="w-full p-3.5 text-left rounded-xl border border-neutral-200 bg-white hover:border-neutral-300 hover:shadow-md transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-400 active:scale-[0.98]"
                        role="listitem"
                        aria-label={`Suggestion ${index + 1}: ${suggestionText.substring(0, 50)}...`}
                      >
                        {index < 8 && (
                          <kbd className="absolute top-3 right-3 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-400 bg-neutral-100 border border-neutral-200 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                            {index + 1}
                          </kbd>
                        )}

                        <div className="space-y-2 pr-6">
                          <div className="flex items-start justify-between gap-2">
                            <div className="text-[14px] font-semibold text-neutral-900 break-words leading-snug whitespace-pre-wrap">
                              {suggestionText}
                            </div>
                            {renderCompatibility(suggestionObj?.compatibility)}
                          </div>
                          {isPlaceholder && suggestionObj?.explanation ? (
                            <div className="text-[12px] leading-relaxed text-neutral-600 break-words">
                              {suggestionObj.explanation}
                            </div>
                          ) : suggestionObj?.explanation ? (
                            <div className="text-[12px] leading-relaxed text-neutral-600 break-words">
                              {suggestionObj.explanation}
                            </div>
                          ) : null}
                        </div>

                        {showCopyAction && suggestionText && (
                          <div className="mt-3 pt-3 border-t border-neutral-100 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                if (typeof navigator !== 'undefined' && navigator?.clipboard) {
                                  navigator.clipboard.writeText(suggestionText);
                                }
                              }}
                              className="text-[11px] font-medium text-neutral-600 hover:text-neutral-900 transition-colors duration-150 cursor-pointer"
                              role="button"
                              tabIndex="0"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  if (typeof navigator !== 'undefined' && navigator?.clipboard) {
                                    navigator.clipboard.writeText(suggestionText);
                                  }
                                }
                              }}
                            >
                              Copy
                            </span>
                            <span className="text-neutral-300">•</span>
                            <span className="text-[11px] text-neutral-500">Click to apply</span>
                          </div>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {!isLoading && currentSuggestions.length === 0 && (
              <div className="flex flex-1 items-center justify-center py-12">
                <div className="px-4 text-center max-w-[240px]">
                  <div className="relative inline-flex mb-4">
                    <div className="absolute inset-0 bg-neutral-200/50 rounded-full blur-xl animate-pulse" />
                    <div className="relative p-3 bg-gradient-to-br from-neutral-100 to-neutral-50 rounded-2xl shadow-sm ring-1 ring-neutral-200/50">
                      <EmptyIcon className="h-8 w-8 text-neutral-400" aria-hidden="true" />
                    </div>
                  </div>
                  <p className="text-[14px] text-neutral-900 font-semibold mb-2">{empty.title}</p>
                  <p className="text-[12px] text-neutral-600 leading-relaxed">{empty.description}</p>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-6">
            <div className="text-center max-w-[240px]">
              <div className="relative inline-flex mb-4">
                <div className="absolute inset-0 bg-neutral-200/50 rounded-full blur-xl animate-pulse" />
                <div className="relative p-3 bg-gradient-to-br from-neutral-100 to-neutral-50 rounded-2xl shadow-sm ring-1 ring-neutral-200/50">
                  <InactiveIcon className="h-8 w-8 text-neutral-400" aria-hidden="true" />
                </div>
              </div>
              <h4 className="text-[14px] font-semibold text-neutral-900 mb-2">{inactive.title}</h4>
              <p className="text-[12px] text-neutral-600 leading-relaxed">{inactive.description}</p>
              {Array.isArray(inactive.tips) && inactive.tips.length > 0 && (
                <div className="mt-4 space-y-2 text-left">
                  {inactive.tips.map((tip, index) => {
                    const TipIcon = tip.icon || Info;
                    return (
                      <div
                        key={`${tip.text}-${index}`}
                        className="flex items-start gap-2 p-2 bg-neutral-50 rounded-lg border border-neutral-200/60"
                      >
                        <TipIcon className="h-3.5 w-3.5 text-neutral-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                        <span className="text-[11px] text-neutral-600 leading-relaxed">{tip.text}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {hasActiveSuggestions && footer}

      {computedKeyboardHint && hasActiveSuggestions && (
        <div className="px-4 py-3 text-center text-[11px] text-neutral-500 border-t border-neutral-200 bg-neutral-50/60">
          {computedKeyboardHint}
        </div>
      )}

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
