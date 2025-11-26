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
import { Button } from './Button';

// State and Hooks
import { useVideoConceptState } from './VideoConceptBuilder/hooks/useVideoConceptState';
import { useElementSuggestions } from './VideoConceptBuilder/hooks/useElementSuggestions';
import { useConflictDetection } from './VideoConceptBuilder/hooks/useConflictDetection';
import { useRefinements } from './VideoConceptBuilder/hooks/useRefinements';
import { useTechnicalParams } from './VideoConceptBuilder/hooks/useTechnicalParams';
import { useCompatibilityScores } from './VideoConceptBuilder/hooks/useCompatibilityScores';
import { useKeyboardShortcuts } from './VideoConceptBuilder/hooks/useKeyboardShortcuts';

// API
import { VideoConceptApi } from './VideoConceptBuilder/api/videoConceptApi';

// Utils
import { validatePrompt, calculateGroupProgress } from './VideoConceptBuilder/utils/validation';
import { formatLabel } from './VideoConceptBuilder/utils/formatting';
import { buildComposedElements } from './VideoConceptBuilder/utils/subjectDescriptors';

// Config
import { ELEMENT_CONFIG } from './VideoConceptBuilder/config/elementConfig';
import {
  ELEMENT_CARD_ORDER,
  PRIMARY_ELEMENT_KEYS,
  isSubjectDescriptorKey,
} from './VideoConceptBuilder/config/constants';
import { TEMPLATE_LIBRARY } from './VideoConceptBuilder/config/templates';

// Components
import { ProgressHeader } from './VideoConceptBuilder/components/ProgressHeader';
import { ConceptPreview } from './VideoConceptBuilder/components/ConceptPreview';
import { ElementCard } from './VideoConceptBuilder/components/ElementCard';
import { ConflictsAlert } from './VideoConceptBuilder/components/ConflictsAlert';
import { RefinementSuggestions } from './VideoConceptBuilder/components/RefinementSuggestions';
import { TechnicalBlueprint } from './VideoConceptBuilder/components/TechnicalBlueprint';
import { VideoGuidancePanel } from './VideoConceptBuilder/components/VideoGuidancePanel';
import { TemplateSelector } from './VideoConceptBuilder/components/TemplateSelector';
import SuggestionsPanel from './SuggestionsPanel';

// Utils for descriptor categories
import { detectDescriptorCategoryClient } from '../utils/subjectDescriptorCategories';
import { SUBJECT_DESCRIPTOR_KEYS } from './VideoConceptBuilder/config/constants';
import type { ElementKey, Elements } from './VideoConceptBuilder/hooks/types';
import type {
  CategoryDetection,
  ElementConfig,
} from './VideoConceptBuilder/components/types';

interface VideoConceptBuilderProps {
  onConceptComplete: (
    concept: string,
    elements: Record<string, string>,
    metadata: {
      format: string;
      technicalParams: Record<string, unknown>;
      validationScore: number | null;
      history: Array<{ element: ElementKey; value: string; timestamp: number }>;
      subjectDescriptors: string[];
    }
  ) => void;
  initialConcept?: string;
}

export default function VideoConceptBuilder({
  onConceptComplete,
  initialConcept = '',
}: VideoConceptBuilderProps): React.ReactElement {
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
    conflicts.items as Array<{ message: string; resolution?: string; suggestion?: string; severity?: string }>
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
    const orderedKeys: ElementKey[] = [
      'subject',
      'action',
      'location',
      'time',
      'mood',
      'style',
      'event',
    ];
    const parts = orderedKeys
      .map((key) => composedElements[key])
      .filter(Boolean);
    return parts.join(' • ');
  }, [composedElements]);

  const filledCount = Object.values(elements).filter((v) => v).length;
  const totalElementSlots = Object.keys(elements).length;
  const completionPercent = Math.round(
    (filledCount / Math.max(totalElementSlots, 1)) * 100
  );
  const isReadyToGenerate = filledCount >= 3;

  // Detect categories for filled descriptors
  const descriptorCategories = useMemo(() => {
    const categories: Record<string, CategoryDetection> = {};
    SUBJECT_DESCRIPTOR_KEYS.forEach((key) => {
      const value = elements[key];
      if (value && value.trim()) {
        const detection = detectDescriptorCategoryClient(value);
        if (detection.confidence > 0.5 && detection.colors && detection.label) {
          categories[key] = {
            label: detection.label,
            confidence: detection.confidence,
            colors: detection.colors,
          };
        }
      }
    });
    return categories;
  }, [elements]);

  // ===========================
  // EVENT HANDLERS
  // ===========================
  const handleElementChange = useCallback(
    (key: ElementKey, value: string): void => {
      dispatch({ type: 'SET_ELEMENT', payload: { key, value } });

      // Trigger compatibility check
      checkCompatibility(key, value);
    },
    [dispatch, checkCompatibility]
  );

  const handleSuggestionClick = useCallback(
    (suggestion: { text?: string } | string): void => {
      if (!ui.activeElement) return;
      
      const suggestionText =
        typeof suggestion === 'string' ? suggestion : suggestion.text;
      
      if (suggestionText) {
        dispatch({
          type: 'ADD_TO_HISTORY',
          payload: {
            element: ui.activeElement,
            value: suggestionText,
          },
        });

        handleElementChange(ui.activeElement, suggestionText);
        clearSuggestions();
      }
    },
    [ui.activeElement, handleElementChange, dispatch, clearSuggestions]
  );

  const handleCompleteScene = async (): Promise<void> => {
    const emptyElements = ELEMENT_CARD_ORDER.filter(
      (key) => !composedElements[key]
    );
    if (emptyElements.length === 0) return;

    dispatch({ type: 'SUGGESTIONS_LOADING' });

    try {
      const suggestedElements = await VideoConceptApi.completeScene(
        composedElements,
        concept
      );
      dispatch({ type: 'APPLY_ELEMENTS', payload: suggestedElements });
    } catch (error) {
      console.error('Error completing scene:', error);
    } finally {
      dispatch({ type: 'SUGGESTIONS_LOADED', payload: [] });
    }
  };

  const handleParseConcept = async (): Promise<void> => {
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

  const handleLoadTemplate = (templateKey: string): void => {
    const template = (TEMPLATE_LIBRARY as Record<string, { name: string; elements: Partial<Elements> }>)[templateKey];
    if (template) {
      dispatch({ type: 'APPLY_ELEMENTS', payload: template.elements });
      dispatch({ type: 'SET_SHOW_TEMPLATES', payload: false });
    }
  };

  const handleGenerateTemplate = async (
    exportFormat = 'detailed'
  ): Promise<void> => {
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
      const latest = await fetchTechnicalParams(elements);
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
      subjectDescriptors:
        Array.isArray(composedElements.subjectDescriptors)
          ? (composedElements.subjectDescriptors as string[])
          : [],
    });
  };

  // ===========================
  // KEYBOARD SHORTCUTS
  // ===========================
  useKeyboardShortcuts({
    onSuggestionSelect: handleSuggestionClick,
    onEscape: clearSuggestions,
    onRefresh: () => {
      if (ui.activeElement) {
        fetchSuggestions(ui.activeElement);
      }
    },
    activeElement: ui.activeElement,
    suggestions: suggestions.items,
  });

  // ===========================
  // SIDE EFFECTS
  // ===========================
  // Debounced validation and conflict detection
  useEffect(() => {
    const timer = setTimeout(() => {
      detectConflicts(elements);

      const validation = validatePrompt(elements, conflicts.items);
      dispatch({
        type: 'SET_VALIDATION_SCORE',
        payload: typeof validation === 'number' ? validation : validation.score,
      });

      fetchRefinements(elements as Elements);
      fetchTechnicalParams(elements as Elements);
    }, 300);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elements]);

  // ===========================
  // SUGGESTIONS PANEL DATA
  // ===========================
  const suggestionsPanelData = useMemo(() => {
    const activeElementConfig = ui.activeElement
      ? ELEMENT_CONFIG[ui.activeElement]
      : null;

    const baseData = {
      suggestions: suggestions.items.map((item) =>
        typeof item === 'string' ? { text: item } : (item as { text?: string })
      ) as Array<{ text?: string; category?: string; suggestions?: unknown[]; compatibility?: number; explanation?: string }>,
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
        onSuggestionClick: handleSuggestionClick as (suggestion: { text?: string }) => void,
      } as typeof baseData & { show: boolean; onSuggestionClick: (suggestion: { text?: string }) => void };
    }

    return {
      ...baseData,
      show: true,
      onSuggestionClick: handleSuggestionClick as (suggestion: { text?: string }) => void,
      onClose: clearSuggestions,
      onRefresh: () => {
        if (ui.activeElement) {
          fetchSuggestions(ui.activeElement);
        }
      },
      selectedText: elements[ui.activeElement] || '',
      contextLabel: 'Element',
      contextValue: activeElementConfig?.label || '',
      contextSecondaryValue: elements[ui.activeElement] || '',
      contextIcon: activeElementConfig?.icon || undefined,
      showContextBadge: true,
      contextBadgeText: 'Context-aware',
      keyboardHint:
        suggestions.items.length > 0
          ? `Use number keys 1-${Math.min(suggestions.items.length, 8)} for quick selection`
          : undefined,
    } as typeof baseData & {
      show: boolean;
      onSuggestionClick: (suggestion: { text?: string }) => void;
      onClose: () => void;
      onRefresh: () => void;
      selectedText: string;
      contextLabel: string;
      contextValue: string;
      contextSecondaryValue: string;
      contextIcon?: typeof Sparkles;
      showContextBadge: boolean;
      contextBadgeText: string;
      keyboardHint?: string;
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
              <div className="flex flex-wrap items-center gap-geist-3 text-label-12 text-geist-accents-6">
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
                <h1 className="text-heading-32 sm:text-heading-40 text-geist-foreground">
                  Video Concept Builder
                </h1>
                <p className="mt-geist-1 text-copy-14 text-geist-accents-6">
                  Structure production-ready AI video prompts with contextual
                  guardrails and live guidance.
                </p>
              </div>
            </div>

            <ProgressHeader
              completionPercent={completionPercent}
              groupProgress={groupProgress}
            />

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-100/80 p-1 text-sm font-medium text-neutral-600 shadow-inner">
                <Button
                  onClick={() => dispatch({ type: 'SET_MODE', payload: 'element' })}
                  variant={mode === 'element' ? 'tertiary' : 'ghost'}
                  shape="rounded"
                  prefix={<Sparkles className="h-4 w-4" />}
                  className={mode === 'element' ? 'bg-white text-neutral-900 shadow-sm' : ''}
                >
                  Element Builder
                </Button>
                <Button
                  onClick={() => dispatch({ type: 'SET_MODE', payload: 'concept' })}
                  variant={mode === 'concept' ? 'tertiary' : 'ghost'}
                  shape="rounded"
                  prefix={<Brain className="h-4 w-4" />}
                  className={mode === 'concept' ? 'bg-white text-neutral-900 shadow-sm' : ''}
                >
                  Describe Concept
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={() => dispatch({ type: 'TOGGLE_TEMPLATES' })}
                  variant="ghost"
                  size="small"
                  prefix={<BookOpen className="h-4 w-4" />}
                >
                  Templates
                </Button>
                <Button
                  onClick={handleCompleteScene}
                  disabled={filledCount === 0}
                  variant="ghost"
                  size="small"
                  prefix={<Wand2 className="h-4 w-4" />}
                >
                  Auto-complete
                </Button>
                <Button
                  onClick={() => handleGenerateTemplate('detailed')}
                  disabled={!isReadyToGenerate}
                  variant="primary"
                  size="small"
                  suffix={<ArrowRight className="h-4 w-4" />}
                  title={
                    isReadyToGenerate
                      ? 'Generate optimized prompt'
                      : 'Fill at least 3 elements to continue'
                  }
                >
                  Generate Prompt
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <ConceptPreview text={conceptPreviewText} />

          {ui.showTemplates && (
            <TemplateSelector onLoadTemplate={handleLoadTemplate} />
          )}

          <VideoGuidancePanel
            showGuidance={ui.showGuidance}
            onToggle={() => dispatch({ type: 'TOGGLE_GUIDANCE' })}
          />

          {/* Concept Mode */}
          {mode === 'concept' && (
            <div className="rounded-3xl border border-neutral-200/70 bg-white/90 px-6 py-6 shadow-sm">
              <label className="mb-geist-3 block text-label-14 text-geist-foreground">
                Describe your video concept
              </label>
              <textarea
                value={concept}
                onChange={(e) =>
                  dispatch({ type: 'SET_CONCEPT', payload: e.target.value })
                }
                placeholder="Example: A sleek sports car drifting through a neon-lit Tokyo street at night, dramatic lighting, shot on anamorphic lenses..."
                className="textarea min-h-[140px] rounded-geist-lg border-geist-accents-2 bg-geist-accents-1 text-copy-14"
              />
              <div className="mt-4 flex justify-end">
                <Button
                  onClick={handleParseConcept}
                  disabled={!concept}
                  variant="primary"
                  size="small"
                  prefix={<Brain className="h-4 w-4" />}
                >
                  Parse into elements
                </Button>
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
            elementConfig={ELEMENT_CONFIG as unknown as Record<string, ElementConfig>}
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
                {ELEMENT_CARD_ORDER.map((key) => {
                  const elementKey = key as ElementKey;
                  return (
                    <ElementCard
                      key={elementKey}
                      elementKey={elementKey}
                      config={ELEMENT_CONFIG[elementKey] as ElementConfig}
                      value={elements[elementKey]}
                      isActive={ui.activeElement === elementKey}
                      compatibility={compatibilityScores[elementKey]}
                      elements={elements}
                      compatibilityScores={compatibilityScores}
                      descriptorCategories={descriptorCategories}
                      elementConfig={ELEMENT_CONFIG as unknown as Record<string, ElementConfig>}
                      onValueChange={handleElementChange}
                      onFetchSuggestions={fetchSuggestions}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <SuggestionsPanel suggestionsData={suggestionsPanelData as Parameters<typeof SuggestionsPanel>[0]['suggestionsData']} />

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

