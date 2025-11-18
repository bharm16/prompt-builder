/**
 * Video Concept Builder (Refactored)
 *
 * Main orchestration component for the Video Concept Builder.
 * This component is now ~300 lines (down from 1925 lines) thanks to proper separation of concerns.
 *
 * Architecture:
 * - State management: useVideoConceptState (useReducer-based)
 * - API calls: Centralized in VideoConceptApi
 * - Business logic: Extracted to utils/
 * - Configuration: Extracted to config/
 * - Custom hooks: Extracted to hooks/
 * - UI components: Extracted to components/
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Sparkles, ArrowRight, Brain, BookOpen, Wand2, Info } from 'lucide-react';

// State and Hooks
import { useVideoConceptState } from './hooks/useVideoConceptState';
import { useElementSuggestions } from './hooks/useElementSuggestions';
import { useConflictDetection } from './hooks/useConflictDetection';
import { useRefinements } from './hooks/useRefinements';
import { useTechnicalParams } from './hooks/useTechnicalParams';
import { useCompatibilityScores } from './hooks/useCompatibilityScores';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

// API
import { VideoConceptApi } from './api/videoConceptApi';

// Utils
import { validatePrompt, calculateGroupProgress } from './utils/validation';
import { formatLabel } from './utils/formatting';
import { buildComposedElements } from './utils/subjectDescriptors';

// Config
import { ELEMENT_CONFIG } from './config/elementConfig';
import { ELEMENT_CARD_ORDER, PRIMARY_ELEMENT_KEYS, isSubjectDescriptorKey } from './config/constants';
import { TEMPLATE_LIBRARY } from './config/templates';

// Components
import { ProgressHeader } from './components/ProgressHeader';
import { ConceptPreview } from './components/ConceptPreview';
import { ElementCard } from './components/ElementCard';
import { ConflictsAlert } from './components/ConflictsAlert';
import { RefinementSuggestions } from './components/RefinementSuggestions';
import { TechnicalBlueprint } from './components/TechnicalBlueprint';
import { VideoGuidancePanel } from './components/VideoGuidancePanel';
import { TemplateSelector } from './components/TemplateSelector';
import SuggestionsPanel from '../SuggestionsPanel';

// Utils for descriptor categories
import { detectDescriptorCategoryClient } from '../../utils/subjectDescriptorCategories';
import { SUBJECT_DESCRIPTOR_KEYS } from './config/constants';

export default function VideoConceptBuilder({
  onConceptComplete,
  initialConcept = '',
}) {
  // ===========================
  // STATE MANAGEMENT
  // ===========================
  const [state, dispatch] = useVideoConceptState(initialConcept);
  const {
    mode,
    concept,
    elements,
    ui,
    suggestions,
    conflicts,
    refinements,
    technicalParams,
    compatibilityScores,
    validationScore,
    elementHistory,
    composedElements,
  } = state;

  // ===========================
  // CUSTOM HOOKS
  // ===========================
  const { fetchSuggestions, clearSuggestions } = useElementSuggestions(
    dispatch,
    composedElements,
    concept,
    conflicts.items
  );

  const detectConflicts = useConflictDetection(dispatch, composedElements);
  const fetchRefinements = useRefinements(dispatch);
  const fetchTechnicalParams = useTechnicalParams(dispatch);
  const checkCompatibility = useCompatibilityScores(dispatch, composedElements);

  // ===========================
  // COMPUTED VALUES
  // ===========================
  const groupProgress = useMemo(
    () => calculateGroupProgress(elements),
    [elements]
  );

  const conceptPreviewText = useMemo(() => {
    const orderedKeys = ['subject', 'action', 'location', 'time', 'mood', 'style', 'event'];
    const parts = orderedKeys
      .map((key) => composedElements[key])
      .filter(Boolean);
    return parts.join(' • ');
  }, [composedElements]);

  const filledCount = Object.values(elements).filter((v) => v).length;
  const totalElementSlots = Object.keys(elements).length;
  const completionPercent = Math.round((filledCount / Math.max(totalElementSlots, 1)) * 100);
  const isReadyToGenerate = filledCount >= 3;

  // Detect categories for filled descriptors
  const descriptorCategories = useMemo(() => {
    const categories = {};
    SUBJECT_DESCRIPTOR_KEYS.forEach(key => {
      const value = elements[key];
      if (value && value.trim()) {
        const detection = detectDescriptorCategoryClient(value);
        if (detection.confidence > 0.5) {
          categories[key] = detection;
        }
      }
    });
    return categories;
  }, [elements]);

  // ===========================
  // EVENT HANDLERS
  // ===========================
  const handleElementChange = useCallback(
    (key, value) => {
      dispatch({ type: 'SET_ELEMENT', payload: { key, value } });

      // Trigger compatibility check
      checkCompatibility(key, value);
    },
    [dispatch, checkCompatibility]
  );

  const handleSuggestionClick = useCallback(
    (suggestion) => {
      if (ui.activeElement) {
        dispatch({
          type: 'ADD_TO_HISTORY',
          payload: {
            element: ui.activeElement,
            value: suggestion.text,
          },
        });

        handleElementChange(ui.activeElement, suggestion.text);
        clearSuggestions();
      }
    },
    [ui.activeElement, handleElementChange, dispatch, clearSuggestions]
  );

  const handleCompleteScene = async () => {
    const emptyElements = ELEMENT_CARD_ORDER.filter((key) => !composedElements[key]);
    if (emptyElements.length === 0) return;

    dispatch({ type: 'SUGGESTIONS_LOADING' });

    try {
      const suggestedElements = await VideoConceptApi.completeScene(composedElements, concept);
      dispatch({ type: 'APPLY_ELEMENTS', payload: suggestedElements });
    } catch (error) {
      console.error('Error completing scene:', error);
    } finally {
      dispatch({ type: 'SUGGESTIONS_LOADED', payload: [] });
    }
  };

  const handleParseConcept = async () => {
    if (!concept) return;

    dispatch({ type: 'SUGGESTIONS_LOADING' });

    try {
      const parsedElements = await VideoConceptApi.parseConcept(concept);
      dispatch({ type: 'APPLY_ELEMENTS', payload: parsedElements });
      dispatch({ type: 'SET_MODE', payload: 'element' });
    } catch (error) {
      console.error('Error parsing concept:', error);
    } finally {
      dispatch({ type: 'SUGGESTIONS_LOADED', payload: [] });
    }
  };

  const handleLoadTemplate = (templateKey) => {
    const template = TEMPLATE_LIBRARY[templateKey];
    if (template) {
      dispatch({ type: 'APPLY_ELEMENTS', payload: template.elements });
      dispatch({ type: 'SET_SHOW_TEMPLATES', payload: false });
    }
  };

  const handleGenerateTemplate = async (exportFormat = 'detailed') => {
    const filledElements = Object.entries(composedElements)
      .filter(
        ([key, value]) =>
          value &&
          key !== 'subjectDescriptors' &&
          !isSubjectDescriptorKey(key)
      )
      .map(([key, value]) => `${formatLabel(key)}: ${value}`)
      .join(', ');

    const finalConcept = concept || filledElements;
    let params = technicalParams.data;

    if (!params || Object.keys(params).length === 0) {
      const latest = await fetchTechnicalParams(composedElements);
      if (latest && Object.keys(latest).length > 0) {
        params = latest;
      } else {
        params = {};
      }
    }

    onConceptComplete(finalConcept, composedElements, {
      format: exportFormat,
      technicalParams: params || {},
      validationScore: validationScore,
      history: elementHistory,
      subjectDescriptors: composedElements.subjectDescriptors || [],
    });
  };

  // ===========================
  // KEYBOARD SHORTCUTS
  // ===========================
  useKeyboardShortcuts({
    onSuggestionSelect: handleSuggestionClick,
    onEscape: clearSuggestions,
    onRefresh: () => fetchSuggestions(ui.activeElement),
    activeElement: ui.activeElement,
    suggestions: suggestions.items,
  });

  // ===========================
  // SIDE EFFECTS
  // ===========================
  // Debounced validation and conflict detection
  useEffect(() => {
    const timer = setTimeout(() => {
      detectConflicts(composedElements);

      const validation = validatePrompt(elements, conflicts.items);
      dispatch({ type: 'SET_VALIDATION_SCORE', payload: validation });

      fetchRefinements(composedElements);
      fetchTechnicalParams(composedElements);
    }, 300);

    return () => clearTimeout(timer);
  }, [elements]); // eslint-disable-line react-hooks/exhaustive-deps

  // ===========================
  // SUGGESTIONS PANEL DATA
  // ===========================
  const suggestionsPanelData = useMemo(() => {
    const activeElementConfig = ui.activeElement ? ELEMENT_CONFIG[ui.activeElement] : null;

    const baseData = {
      suggestions: suggestions.items,
      isLoading: suggestions.isLoading,
      enableCustomRequest: false,
      panelClassName:
        'flex w-full flex-col gap-4 rounded-3xl border border-neutral-200/70 bg-white/90 px-4 py-6 shadow-[0_18px_60px_-35px_rgba(15,23,42,0.45)] backdrop-blur-sm lg:w-[22rem] lg:flex-shrink-0 lg:sticky lg:top-4 lg:max-h-[calc(100vh-4rem)]',
      inactiveState: {
        icon: Sparkles,
        title: 'Adaptive suggestions',
        description:
          'Select an element to see AI completions tuned to your in-progress concept.',
        tips: [
          { icon: Info, text: 'Context signals update live as you edit.' },
          { icon: ArrowRight, text: 'Press 1-8 to apply a suggestion instantly.' },
        ],
      },
      emptyState: {
        icon: Sparkles,
        title: 'No suggestions available',
        description: 'Refresh or adjust nearby details to unlock new directions.',
      },
      showCopyAction: true,
    };

    if (!ui.activeElement) {
      return {
        ...baseData,
        show: false,
        onSuggestionClick: handleSuggestionClick,
      };
    }

    return {
      ...baseData,
      show: true,
      onSuggestionClick: handleSuggestionClick,
      onClose: clearSuggestions,
      onRefresh: () => fetchSuggestions(ui.activeElement),
      selectedText: elements[ui.activeElement] || '',
      contextLabel: 'Element',
      contextValue: activeElementConfig?.label || '',
      contextSecondaryValue: elements[ui.activeElement] || '',
      contextIcon: activeElementConfig?.icon || null,
      showContextBadge: true,
      contextBadgeText: 'Context-aware',
      keyboardHint:
        suggestions.items.length > 0
          ? `Use number keys 1-${Math.min(suggestions.items.length, 8)} for quick selection`
          : null,
    };
  }, [
    ui.activeElement,
    elements,
    suggestions.items,
    suggestions.isLoading,
    fetchSuggestions,
    handleSuggestionClick,
    clearSuggestions,
  ]);

  // ===========================
  // RENDER
  // ===========================
  return (
    <div className="flex w-full flex-col gap-6 lg:flex-row lg:items-start">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Professional Header */}
        <div className="rounded-3xl border border-neutral-200/80 bg-white/90 px-6 py-6 shadow-[0_25px_70px_-45px_rgba(15,23,42,0.55)] backdrop-blur-sm sm:px-8 sm:py-8">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-neutral-600">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1">
                  <Sparkles className="h-3.5 w-3.5 text-neutral-500" />
                  AI-guided workflow
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1">
                  <Info className="h-3.5 w-3.5 text-neutral-500" />
                  {completionPercent}% filled
                </span>
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-neutral-900 tracking-tight sm:text-3xl">
                  Video Concept Builder
                </h1>
                <p className="mt-1 text-sm text-neutral-600">
                  Structure production-ready AI video prompts with contextual guardrails and live guidance.
                </p>
              </div>
            </div>

            <ProgressHeader
              completionPercent={completionPercent}
              groupProgress={groupProgress}
            />

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-100/80 p-1 text-sm font-medium text-neutral-600 shadow-inner">
                <button
                  onClick={() => dispatch({ type: 'SET_MODE', payload: 'element' })}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 transition-colors ${
                    mode === 'element'
                      ? 'bg-white text-neutral-900 shadow-sm'
                      : 'text-neutral-500 hover:text-neutral-900'
                  }`}
                >
                  <Sparkles className="h-4 w-4" />
                  Element Builder
                </button>
                <button
                  onClick={() => dispatch({ type: 'SET_MODE', payload: 'concept' })}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 transition-colors ${
                    mode === 'concept'
                      ? 'bg-white text-neutral-900 shadow-sm'
                      : 'text-neutral-500 hover:text-neutral-900'
                  }`}
                >
                  <Brain className="h-4 w-4" />
                  Describe Concept
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => dispatch({ type: 'TOGGLE_TEMPLATES' })}
                  className="btn-ghost btn-sm border border-transparent text-neutral-700 hover:border-neutral-200 hover:bg-white"
                >
                  <BookOpen className="h-4 w-4" />
                  Templates
                </button>
                <button
                  onClick={handleCompleteScene}
                  disabled={filledCount === 0}
                  className="btn-ghost btn-sm border border-transparent text-neutral-700 hover:border-neutral-200 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Wand2 className="h-4 w-4" />
                  Auto-complete
                </button>
                <button
                  onClick={() => handleGenerateTemplate('detailed')}
                  disabled={!isReadyToGenerate}
                  className="btn-primary btn-sm shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                  title={
                    isReadyToGenerate
                      ? 'Generate optimized prompt'
                      : 'Fill at least 3 elements to continue'
                  }
                >
                  Generate Prompt
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <ConceptPreview text={conceptPreviewText} />

          {ui.showTemplates && <TemplateSelector onLoadTemplate={handleLoadTemplate} />}

          <VideoGuidancePanel
            showGuidance={ui.showGuidance}
            onToggle={() => dispatch({ type: 'TOGGLE_GUIDANCE' })}
          />

          {/* Concept Mode */}
          {mode === 'concept' && (
            <div className="rounded-3xl border border-neutral-200/70 bg-white/90 px-6 py-6 shadow-sm">
              <label className="mb-3 block text-sm font-semibold text-neutral-900">
                Describe your video concept
              </label>
              <textarea
                value={concept}
                onChange={(e) => dispatch({ type: 'SET_CONCEPT', payload: e.target.value })}
                placeholder="Example: A sleek sports car drifting through a neon-lit Tokyo street at night, dramatic lighting, shot on anamorphic lenses..."
                className="textarea min-h-[140px] rounded-2xl border-neutral-200 bg-neutral-50 text-sm"
              />
              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleParseConcept}
                  disabled={!concept}
                  className="btn-primary btn-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Brain className="h-4 w-4" />
                  Parse into elements
                </button>
              </div>
            </div>
          )}

          <ConflictsAlert
            conflicts={conflicts.items}
            isLoading={conflicts.isLoading}
          />

          <RefinementSuggestions
            refinements={refinements.data}
            isLoading={refinements.isLoading}
            elementConfig={ELEMENT_CONFIG}
            onApplyRefinement={handleElementChange}
          />

          <TechnicalBlueprint
            technicalParams={technicalParams.data}
            isLoading={technicalParams.isLoading}
          />

          {/* Bento Grid - Element Cards */}
          {mode === 'element' && (
            <div className="rounded-3xl border border-neutral-200/70 bg-white/90 px-5 py-6 shadow-sm">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {ELEMENT_CARD_ORDER.map((key) => (
                  <ElementCard
                    key={key}
                    elementKey={key}
                    config={ELEMENT_CONFIG[key]}
                    value={elements[key]}
                    isActive={ui.activeElement === key}
                    compatibility={compatibilityScores[key]}
                    elements={elements}
                    compatibilityScores={compatibilityScores}
                    descriptorCategories={descriptorCategories}
                    elementConfig={ELEMENT_CONFIG}
                    onValueChange={handleElementChange}
                    onFetchSuggestions={fetchSuggestions}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <SuggestionsPanel suggestionsData={suggestionsPanelData} />

      {/* Custom CSS */}
      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
