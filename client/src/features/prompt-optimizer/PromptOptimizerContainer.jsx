import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Search,
  FileText,
  Lightbulb,
  GraduationCap,
  Video,
  Plus,
  PanelLeft,
  Settings as SettingsIcon,
  Keyboard,
  MessageSquare,
  X,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, getPromptByUuid } from '../../config/firebase';
import { PromptInput } from './PromptInput';
import { PromptCanvas } from './PromptCanvas';
import { HistorySidebar } from '../history/HistorySidebar';
import PromptImprovementForm from '../../PromptImprovementForm';
import CreativeBrainstormEnhanced from '../../components/CreativeBrainstormEnhanced';
import { ToastProvider, useToast } from '../../components/Toast';
import Settings, { useSettings } from '../../components/Settings';
import KeyboardShortcuts, { useKeyboardShortcuts } from '../../components/KeyboardShortcuts';
import { usePromptOptimizer } from '../../hooks/usePromptOptimizer';
import { usePromptHistory } from '../../hooks/usePromptHistory';
import { PromptContext } from '../../utils/PromptContext';
import { detectAndApplySceneChange } from '../../utils/detectSceneChange';

function PromptOptimizerContent() {
  // Force light mode immediately
  React.useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  const navigate = useNavigate();
  const { uuid } = useParams();
  const toast = useToast();
  const { settings, updateSetting, resetSettings } = useSettings();

  // Mode configuration
  const modes = [
    {
      id: 'optimize',
      name: 'Standard Prompt',
      icon: MessageSquare,
      description: 'Optimize any prompt',
    },
    {
      id: 'reasoning',
      name: 'Reasoning Prompt',
      icon: Lightbulb,
      description: 'Deep thinking & verification',
    },
    {
      id: 'research',
      name: 'Deep Research',
      icon: Search,
      description: 'Create research plans',
    },
    {
      id: 'socratic',
      name: 'Socratic Learning',
      icon: GraduationCap,
      description: 'Learning journeys',
    },
    {
      id: 'video',
      name: 'Video Prompt',
      icon: Video,
      description: 'Generate AI video prompts',
    },
  ];

  const aiNames = ['Claude AI', 'ChatGPT', 'Gemini'];

  // Auth state
  const [user, setUser] = useState(null);

  // UI state
  const [selectedMode, setSelectedMode] = useState('optimize');
  const [showHistory, setShowHistory] = useState(true);
  const [showResults, setShowResults] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showImprover, setShowImprover] = useState(false);
  const [showBrainstorm, setShowBrainstorm] = useState(false);
  const [currentAIIndex, setCurrentAIIndex] = useState(0);

  // Enhancement suggestions state
  const [suggestionsData, setSuggestionsData] = useState(null);
  const [conceptElements, setConceptElements] = useState(null);
  const [promptContext, setPromptContext] = useState(null); // NEW: Store PromptContext
  const [currentPromptUuid, setCurrentPromptUuid] = useState(null);

  // Refs
  const debounceTimerRef = useRef(null);
  const lastRequestRef = useRef(null);

  // Custom hooks
  const promptOptimizer = usePromptOptimizer(selectedMode);
  const promptHistory = usePromptHistory(user);

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // Load prompt from URL parameter if present
  useEffect(() => {
    const loadPromptFromUrl = async () => {
      if (uuid && !currentPromptUuid) {
        try {
          const promptData = await getPromptByUuid(uuid);
          if (promptData) {
            promptOptimizer.setSkipAnimation(true);
            promptOptimizer.setInputPrompt(promptData.input);
            promptOptimizer.setOptimizedPrompt(promptData.output);
            promptOptimizer.setDisplayedPrompt(promptData.output);
            setSelectedMode(promptData.mode || 'optimize');
            setCurrentPromptUuid(promptData.uuid);
            setShowResults(true);

            if (promptData.brainstormContext) {
              try {
                const contextData =
                  typeof promptData.brainstormContext === 'string'
                    ? JSON.parse(promptData.brainstormContext)
                    : promptData.brainstormContext;
                const restoredContext = PromptContext.fromJSON(contextData);
                setPromptContext(restoredContext);
              } catch (contextError) {
                console.error('Failed to restore prompt context from shared link:', contextError);
                setPromptContext(null);
              }
            } else {
              setPromptContext(null);
            }
          } else {
            toast.error('Prompt not found');
            navigate('/', { replace: true });
          }
        } catch (error) {
          console.error('Error loading prompt from URL:', error);
          toast.error('Failed to load prompt');
          navigate('/', { replace: true });
        }
      }
    };

    loadPromptFromUrl();
  }, [uuid, currentPromptUuid, navigate, toast, promptOptimizer, setSelectedMode]);

  // Cycle through AI names
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentAIIndex((prev) => (prev + 1) % aiNames.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [aiNames.length]);

  // Typewriter animation for results
  useEffect(() => {
    if (!promptOptimizer.optimizedPrompt || !showResults) {
      promptOptimizer.setDisplayedPrompt('');
      return;
    }

    if (promptOptimizer.skipAnimation) {
      promptOptimizer.setDisplayedPrompt(promptOptimizer.optimizedPrompt);
      return;
    }

    promptOptimizer.setDisplayedPrompt('');
    let currentIndex = 0;

    const intervalId = setInterval(() => {
      if (currentIndex <= promptOptimizer.optimizedPrompt.length) {
        const text = promptOptimizer.optimizedPrompt.slice(0, currentIndex);
        promptOptimizer.setDisplayedPrompt(text);
        currentIndex += 3;
      } else {
        clearInterval(intervalId);
      }
    }, 5);

    return () => clearInterval(intervalId);
  }, [promptOptimizer.optimizedPrompt, showResults, promptOptimizer.skipAnimation]);

  // Handle optimization
  const handleOptimize = async (promptToOptimize, context) => {
    const prompt = promptToOptimize || promptOptimizer.inputPrompt;
    const ctx = context || promptOptimizer.improvementContext;

    const serializedContext = promptContext
      ? typeof promptContext.toJSON === 'function'
        ? promptContext.toJSON()
        : {
            elements: promptContext.elements,
            metadata: promptContext.metadata,
          }
      : null;

    const brainstormContextData = serializedContext
      ? {
          elements: serializedContext.elements,
          metadata: serializedContext.metadata,
        }
      : null;

    console.log('handleOptimize called with:', {
      prompt,
      ctx,
      selectedMode,
      hasBrainstormContext: Boolean(brainstormContextData),
    });

    const result = await promptOptimizer.optimize(prompt, ctx, brainstormContextData);
    console.log('optimize result:', result);
    if (result) {
      const uuid = await promptHistory.saveToHistory(
        prompt,
        result.optimized,
        result.score,
        selectedMode,
        serializedContext
      );
      setCurrentPromptUuid(uuid);
      setShowResults(true);
      setShowHistory(true);
      if (uuid) {
        navigate(`/prompt/${uuid}`, { replace: true });
      }
    }
  };

  // Handle improvement flow
  const handleImproveFirst = () => {
    if (!promptOptimizer.inputPrompt.trim()) {
      toast.warning('Please enter a prompt first');
      return;
    }
    setShowImprover(true);
  };

  const handleImprovementComplete = async (enhancedPrompt, context) => {
    setShowImprover(false);
    promptOptimizer.setImprovementContext(context);
    promptOptimizer.setInputPrompt(enhancedPrompt);
    handleOptimize(enhancedPrompt, context);
  };

  // Handle brainstorm flow
  const handleConceptComplete = async (finalConcept, elements, metadata) => {
    setConceptElements(elements);

    // Create PromptContext from brainstorm data
    const context = new PromptContext(elements, metadata);
    setPromptContext(context);

    const serializedContext = context.toJSON();

    // Prepare brainstormContext for backend
    const brainstormContextData = {
      elements,
      metadata
    };

    promptOptimizer.setInputPrompt(finalConcept);
    setShowBrainstorm(false);

    setTimeout(async () => {
      // Pass brainstormContext to optimize function
      const result = await promptOptimizer.optimize(finalConcept, null, brainstormContextData);
      if (result) {
        const uuid = await promptHistory.saveToHistory(
          finalConcept,
          result.optimized,
          result.score,
          selectedMode,
          serializedContext
        );
        setCurrentPromptUuid(uuid);
        setShowResults(true);
        setShowHistory(true);
        toast.success('Video prompt generated successfully!');
        if (uuid) {
          navigate(`/prompt/${uuid}`, { replace: true });
        }
      }
    }, 100);
  };

  const handleSkipBrainstorm = () => {
    setShowBrainstorm(false);
    setConceptElements({ skipped: true });
  };

  // Handle create new
  const handleCreateNew = () => {
    promptOptimizer.resetPrompt();
    setShowResults(false);
    setSuggestionsData(null);
    setConceptElements(null);
    setPromptContext(null); // Clear context
    setCurrentPromptUuid(null);
    navigate('/', { replace: true });
  };

  // Load from history
  const loadFromHistory = (entry) => {
    promptOptimizer.setSkipAnimation(true);
    promptOptimizer.setInputPrompt(entry.input);
    promptOptimizer.setOptimizedPrompt(entry.output);
    promptOptimizer.setDisplayedPrompt(entry.output);
    setSelectedMode(entry.mode);
    setCurrentPromptUuid(entry.uuid || null);
    setShowResults(true);

    if (entry.brainstormContext) {
      try {
        const contextData =
          typeof entry.brainstormContext === 'string'
            ? JSON.parse(entry.brainstormContext)
            : entry.brainstormContext;
        const restoredContext = PromptContext.fromJSON(contextData);
        setPromptContext(restoredContext);
      } catch (contextError) {
        console.error('Failed to restore prompt context from history entry:', contextError);
        setPromptContext(null);
      }
    } else {
      setPromptContext(null);
    }

    // Update URL if there's a UUID
    if (entry.uuid) {
      navigate(`/prompt/${entry.uuid}`, { replace: true });
    }
  };

  // Fetch enhancement suggestions
  const fetchEnhancementSuggestions = async (
    highlightedText,
    originalText,
    fullPrompt,
    selectionRange,
    selectionOffsets
  ) => {
    // Only enable ML suggestions for video mode
    if (selectedMode !== 'video') {
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (
      suggestionsData?.selectedText === highlightedText &&
      suggestionsData?.show
    ) {
      return;
    }

    const performFetch = async () => {
      // Track a unique request id so we ignore stale responses.
      const requestId = Symbol('suggestions');
      lastRequestRef.current = requestId;

      const rangeSnapshot = selectionRange ? selectionRange.cloneRange() : null;
      const hasValidOffsets =
        selectionOffsets &&
        typeof selectionOffsets.start === 'number' &&
        typeof selectionOffsets.end === 'number';
      const offsetsSnapshot = hasValidOffsets
        ? {
            start: selectionOffsets.start,
            end: selectionOffsets.end,
          }
        : null;
      const exactSelectionText =
        offsetsSnapshot && fullPrompt
          ? fullPrompt.slice(offsetsSnapshot.start, offsetsSnapshot.end)
          : originalText;

      const closeSuggestions = () => {
        setSuggestionsData(null);
        if (typeof window !== 'undefined' && window.getSelection) {
          const selection = window.getSelection();
          if (selection && selection.removeAllRanges) {
            selection.removeAllRanges();
          }
        }
      };

      const applySuggestion = async (suggestion) => {
        try {
          const suggestionText =
            typeof suggestion === 'string' ? suggestion : suggestion?.text || '';

          if (!suggestionText) {
            toast.error('Suggestion is missing text to apply');
            return;
          }

          const latestPrompt = promptOptimizer.displayedPrompt;

          if (!latestPrompt) {
            toast.error('Unable to apply suggestion to an empty prompt');
            return;
          }

          if (rangeSnapshot && typeof window !== 'undefined' && window.getSelection) {
            try {
              const selection = window.getSelection();
              if (selection && selection.removeAllRanges && selection.addRange) {
                selection.removeAllRanges();
                const rangeToApply = rangeSnapshot.cloneRange
                  ? rangeSnapshot.cloneRange()
                  : rangeSnapshot;
                selection.addRange(rangeToApply);
              }
            } catch (rangeError) {
              console.warn('Unable to restore previous selection range:', rangeError);
            }
          }

          let startIndex = offsetsSnapshot?.start ?? -1;
          let endIndex = offsetsSnapshot?.end ?? -1;
          let replacementSource = exactSelectionText || highlightedText || originalText || '';
          let currentSlice =
            startIndex >= 0 && endIndex >= 0
              ? latestPrompt.slice(startIndex, endIndex)
              : '';

          const hasValidSlice =
            startIndex >= 0 &&
            endIndex >= 0 &&
            startIndex <= endIndex &&
            currentSlice &&
            latestPrompt.length >= endIndex;

          if (!hasValidSlice || currentSlice !== replacementSource) {
            const fallbackText = replacementSource;
            if (fallbackText) {
              const fallbackStart = latestPrompt.indexOf(fallbackText);
              if (fallbackStart !== -1) {
                startIndex = fallbackStart;
                endIndex = fallbackStart + fallbackText.length;
                currentSlice = latestPrompt.slice(startIndex, endIndex);
              }
            }
          }

          let updatedPrompt = latestPrompt;
          const finalStartValid =
            startIndex >= 0 &&
            endIndex >= 0 &&
            startIndex <= endIndex &&
            latestPrompt.length >= endIndex;

          const replacedText =
            finalStartValid && currentSlice
              ? currentSlice
              : replacementSource;

          if (finalStartValid && currentSlice) {
            updatedPrompt =
              latestPrompt.slice(0, startIndex) +
              suggestionText +
              latestPrompt.slice(endIndex);
          } else if (replacementSource) {
            updatedPrompt = latestPrompt.replace(replacementSource, suggestionText);
          }

          try {
            const finalPrompt = await detectAndApplySceneChange({
              originalPrompt: latestPrompt,
              updatedPrompt,
              oldValue: replacedText || replacementSource,
              newValue: suggestionText,
            });

            promptOptimizer.setOptimizedPrompt(finalPrompt);
            promptOptimizer.setDisplayedPrompt(finalPrompt);
            closeSuggestions();
            toast.success('Suggestion applied');
          } catch (error) {
            console.error('Error detecting scene change:', error);
            promptOptimizer.setOptimizedPrompt(updatedPrompt);
            promptOptimizer.setDisplayedPrompt(updatedPrompt);
            closeSuggestions();
            toast.success('Suggestion applied');
          }
        } catch (error) {
          console.error('Error applying suggestion:', error);
          toast.error('Failed to apply suggestion');
        } finally {
          if (typeof window !== 'undefined' && window.getSelection) {
            const selection = window.getSelection();
            if (selection && selection.removeAllRanges) {
              selection.removeAllRanges();
            }
          }
        }
      };

      const highlightIndex = fullPrompt.indexOf(highlightedText);
      const contextBefore = fullPrompt
        .substring(Math.max(0, highlightIndex - 300), highlightIndex)
        .trim();
      const contextAfter = fullPrompt
        .substring(
          highlightIndex + highlightedText.length,
          Math.min(
            fullPrompt.length,
            highlightIndex + highlightedText.length + 300
          )
        )
        .trim();

      // Set loading state
      setSuggestionsData({
        show: true,
        selectedText: highlightedText,
        originalText: exactSelectionText,
        suggestions: [],
        isLoading: true,
        isPlaceholder: false,
        fullPrompt: fullPrompt,
        selectionRange: rangeSnapshot,
        selectionOffsets: offsetsSnapshot,
        setSuggestions: (newSuggestions, newIsPlaceholder) => {
          setSuggestionsData((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              suggestions: newSuggestions,
              isPlaceholder:
                newIsPlaceholder !== undefined
                  ? newIsPlaceholder
                  : prev.isPlaceholder,
              isLoading: false,
            };
          });
        },
        onSuggestionClick: applySuggestion,
        onClose: closeSuggestions,
      });

      try {
        const response = await fetch(
          '/api/get-enhancement-suggestions',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': 'dev-key-12345',
            },
            body: JSON.stringify({
              highlightedText,
              contextBefore,
              contextAfter,
              fullPrompt,
              originalUserPrompt: promptOptimizer.inputPrompt,
              brainstormContext: promptContext ? promptContext.toJSON() : null,
            }),
          }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch suggestions');
        }

        const data = await response.json();

        // Ignore if a newer request has started
        if (lastRequestRef.current !== requestId) {
          return;
        }

        setSuggestionsData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            suggestions: data.suggestions || [],
            isLoading: false,
            isPlaceholder: data.isPlaceholder || false,
          };
        });
      } catch (error) {
        console.error('Error fetching suggestions:', error);
        // Only surface the error if this is still the latest request
        if (lastRequestRef.current === requestId) {
          toast.error('Failed to load suggestions');
          closeSuggestions();
        }
      }
    };

    // Immediate fetch for click on a highlighted word; debounce for text selection drags.
    if (selectionRange) {
      performFetch();
    } else {
      debounceTimerRef.current = setTimeout(performFetch, 300);
    }
  };

  const currentMode = modes.find((m) => m.id === selectedMode) || modes[0];

  // Keyboard shortcuts
  useKeyboardShortcuts({
    openShortcuts: () => setShowShortcuts(true),
    openSettings: () => setShowSettings(true),
    createNew: handleCreateNew,
    optimize: () => !promptOptimizer.isProcessing && showResults === false && handleOptimize(),
    improveFirst: handleImproveFirst,
    canCopy: () => showResults && promptOptimizer.displayedPrompt,
    copy: () => {
      navigator.clipboard.writeText(promptOptimizer.displayedPrompt);
      toast.success('Copied to clipboard!');
    },
    export: () => showResults && toast.info('Use export button in canvas'),
    toggleSidebar: () => setShowHistory(!showHistory),
    switchMode: (index) => {
      if (modes[index]) {
        setSelectedMode(modes[index].id);
        toast.info(`Switched to ${modes[index].name}`);
      }
    },
    applySuggestion: (index) => {
      if (suggestionsData?.suggestions[index]) {
        suggestionsData.onSuggestionClick(suggestionsData.suggestions[index]);
      }
    },
    closeModal: () => {
      if (showSettings) setShowSettings(false);
      else if (showShortcuts) setShowShortcuts(false);
      else if (showImprover) setShowImprover(false);
      else if (showBrainstorm) setShowBrainstorm(false);
      else if (suggestionsData) setSuggestionsData(null);
    },
  });

  return (
    <div
      className="h-screen overflow-hidden gradient-neutral transition-colors duration-300"
      style={{ '--sidebar-width': showHistory ? '18rem' : '0px' }}
    >
      {/* Skip to main content */}
      <a href="#main-content" className="sr-only-focusable top-4 left-4">
        Skip to main content
      </a>

      {/* Settings Modal */}
      <Settings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        updateSetting={updateSetting}
        resetSettings={resetSettings}
        onClearAllData={promptHistory.clearHistory}
      />

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcuts
        isOpen={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />

      {/* Creative Brainstorm Modal */}
      {showBrainstorm && (
        <div className="modal-backdrop" onClick={handleSkipBrainstorm}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="brainstorm-title"
          >
            <div className="modal-content-xl max-h-[90vh] overflow-y-auto">
              <button
                onClick={handleSkipBrainstorm}
                className="absolute right-4 top-4 z-10 rounded-lg p-2 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                aria-label="Close concept builder"
                title="Close (Esc)"
              >
                <X className="h-6 w-6" />
              </button>
              <div className="p-6">
                <CreativeBrainstormEnhanced
                  onConceptComplete={handleConceptComplete}
                  initialConcept={promptOptimizer.inputPrompt}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Improvement Form Modal */}
      {showImprover && (
        <div className="modal-backdrop" onClick={() => setShowImprover(false)}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="improvement-title"
          >
            <div className="my-8 w-full max-w-3xl">
              <button
                onClick={() => setShowImprover(false)}
                className="mb-4 btn-ghost text-white hover:text-neutral-200"
                aria-label="Close improvement form"
              >
                <X className="h-5 w-5" />
                <span>Close</span>
              </button>
              <PromptImprovementForm
                initialPrompt={promptOptimizer.inputPrompt}
                onComplete={handleImprovementComplete}
              />
            </div>
          </div>
        </div>
      )}

      {/* Top Action Buttons */}
      <div className="fixed left-6 top-6 z-fixed flex items-center gap-2">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="btn-icon-secondary shadow-lg hover-scale ripple"
          aria-label={showHistory ? 'Hide history sidebar' : 'Show history sidebar'}
          aria-expanded={showHistory}
        >
          <PanelLeft className="h-5 w-5" />
        </button>
        <button
          onClick={handleCreateNew}
          className="btn-icon-secondary shadow-lg hover-scale ripple"
          aria-label="Create new prompt"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      {/* History Sidebar */}
      <HistorySidebar
        showHistory={showHistory}
        user={user}
        history={promptHistory.history}
        filteredHistory={promptHistory.filteredHistory}
        isLoadingHistory={promptHistory.isLoadingHistory}
        searchQuery={promptHistory.searchQuery}
        onSearchChange={promptHistory.setSearchQuery}
        onLoadFromHistory={loadFromHistory}
        onCreateNew={handleCreateNew}
        modes={modes}
      />

      {/* Main Content */}
      <main
        id="main-content"
        className={`relative flex h-screen flex-col items-center px-4 sm:px-6 py-8 transition-all duration-300 ${showHistory ? 'ml-72' : 'ml-0'} ${showResults ? 'justify-start' : 'justify-center overflow-y-auto'}`}
      >
        {/* Hero Section with Input */}
        {!showResults && (
          <>
            {promptOptimizer.isProcessing ? (
              /* Adaptive Skeleton Loader - matches actual content structure */
              <div className="w-full max-w-4xl mx-auto">
                <div
                  className="relative overflow-hidden p-8 bg-gradient-to-r from-neutral-100 via-neutral-50 to-neutral-100 border border-neutral-200 rounded-xl animate-pulse"
                  style={{
                    animationDuration: '1.5s',
                  }}
                >
                  {/* Shimmer effect */}
                  <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent" />

                  <div className="relative space-y-6">
                    {/* Mode-specific skeleton structures matching actual output templates */}
                    {selectedMode === 'video' ? (
                      /* Video mode: Main paragraph + Technical Specs + Alternative Approaches */
                      <>
                        {/* Main descriptive paragraph (100-150 words) */}
                        <div className="space-y-2">
                          <div className="h-3 bg-neutral-200/70 rounded-md w-full" />
                          <div className="h-3 bg-neutral-200/70 rounded-md w-full" />
                          <div className="h-3 bg-neutral-200/70 rounded-md w-11/12" />
                          <div className="h-3 bg-neutral-200/70 rounded-md w-full" />
                          <div className="h-3 bg-neutral-200/70 rounded-md w-10/12" />
                          <div className="h-3 bg-neutral-200/70 rounded-md w-full" />
                          <div className="h-3 bg-neutral-200/70 rounded-md w-9/12" />
                        </div>
                        {/* TECHNICAL SPECS */}
                        <div className="space-y-3 pt-2">
                          <div className="h-4 bg-neutral-200/70 rounded-md w-40" />
                          <div className="space-y-2 ml-2">
                            <div className="h-3 bg-neutral-200/60 rounded-md w-48" />
                            <div className="h-3 bg-neutral-200/60 rounded-md w-52" />
                            <div className="h-3 bg-neutral-200/60 rounded-md w-44" />
                            <div className="h-3 bg-neutral-200/60 rounded-md w-36" />
                          </div>
                        </div>
                        {/* ALTERNATIVE APPROACHES (2 variations) */}
                        <div className="space-y-3 pt-2">
                          <div className="h-4 bg-neutral-200/70 rounded-md w-56" />
                          <div className="space-y-2 ml-2">
                            <div className="h-3 bg-neutral-200/60 rounded-md w-44" />
                            <div className="h-3 bg-neutral-200/60 rounded-md w-full" />
                            <div className="h-3 bg-neutral-200/60 rounded-md w-5/6" />
                          </div>
                          <div className="space-y-2 ml-2">
                            <div className="h-3 bg-neutral-200/60 rounded-md w-48" />
                            <div className="h-3 bg-neutral-200/60 rounded-md w-full" />
                            <div className="h-3 bg-neutral-200/60 rounded-md w-4/5" />
                          </div>
                        </div>
                      </>
                    ) : selectedMode === 'research' ? (
                      /* Research mode: RESEARCH OBJECTIVE + 7 major sections */
                      <>
                        {/* RESEARCH OBJECTIVE */}
                        <div className="space-y-2">
                          <div className="h-4 bg-neutral-200/70 rounded-md w-52" />
                          <div className="h-3 bg-neutral-200/60 rounded-md w-full" />
                        </div>
                        {/* CORE RESEARCH QUESTIONS (5-7 questions) */}
                        <div className="space-y-2">
                          <div className="h-4 bg-neutral-200/70 rounded-md w-60" />
                          <div className="ml-2 space-y-1.5">
                            {[...Array(6)].map((_, i) => (
                              <div key={i} className="h-3 bg-neutral-200/60 rounded-md" style={{width: `${85 + (i % 3) * 5}%`}} />
                            ))}
                          </div>
                        </div>
                        {/* METHODOLOGY */}
                        <div className="space-y-2">
                          <div className="h-4 bg-neutral-200/70 rounded-md w-44" />
                          <div className="h-3 bg-neutral-200/60 rounded-md w-full" />
                          <div className="h-3 bg-neutral-200/60 rounded-md w-11/12" />
                        </div>
                        {/* INFORMATION SOURCES */}
                        <div className="space-y-2">
                          <div className="h-4 bg-neutral-200/70 rounded-md w-56" />
                          <div className="ml-2 space-y-1.5">
                            <div className="h-3 bg-neutral-200/60 rounded-md w-4/5" />
                            <div className="h-3 bg-neutral-200/60 rounded-md w-3/4" />
                            <div className="h-3 bg-neutral-200/60 rounded-md w-5/6" />
                          </div>
                        </div>
                        {/* SUCCESS METRICS + SYNTHESIS FRAMEWORK + DELIVERABLE FORMAT */}
                        <div className="space-y-3">
                          <div className="h-4 bg-neutral-200/70 rounded-md w-48" />
                          <div className="h-3 bg-neutral-200/60 rounded-md w-full" />
                        </div>
                      </>
                    ) : selectedMode === 'socratic' ? (
                      /* Socratic mode: 8 sections with question lists */
                      <>
                        {/* LEARNING OBJECTIVE */}
                        <div className="space-y-2">
                          <div className="h-4 bg-neutral-200/70 rounded-md w-52" />
                          <div className="h-3 bg-neutral-200/60 rounded-md w-full" />
                        </div>
                        {/* PRIOR KNOWLEDGE CHECK (2-3 questions) */}
                        <div className="space-y-2">
                          <div className="h-4 bg-neutral-200/70 rounded-md w-60" />
                          <div className="ml-2 space-y-1.5">
                            {[...Array(3)].map((_, i) => (
                              <div key={i} className="h-3 bg-neutral-200/60 rounded-md" style={{width: `${80 + i * 5}%`}} />
                            ))}
                          </div>
                        </div>
                        {/* FOUNDATION QUESTIONS (3-4 questions) */}
                        <div className="space-y-2">
                          <div className="h-4 bg-neutral-200/70 rounded-md w-56" />
                          <div className="ml-2 space-y-1.5">
                            {[...Array(4)].map((_, i) => (
                              <div key={i} className="h-3 bg-neutral-200/60 rounded-md" style={{width: `${85 + (i % 2) * 5}%`}} />
                            ))}
                          </div>
                        </div>
                        {/* DEEPENING QUESTIONS (4-5 questions) */}
                        <div className="space-y-2">
                          <div className="h-4 bg-neutral-200/70 rounded-md w-58" />
                          <div className="ml-2 space-y-1.5">
                            {[...Array(5)].map((_, i) => (
                              <div key={i} className="h-3 bg-neutral-200/60 rounded-md w-full" />
                            ))}
                          </div>
                        </div>
                        {/* APPLICATION & SYNTHESIS + METACOGNITIVE REFLECTION */}
                        <div className="space-y-2">
                          <div className="h-4 bg-neutral-200/70 rounded-md w-60" />
                          <div className="ml-2 space-y-1.5">
                            <div className="h-3 bg-neutral-200/60 rounded-md w-11/12" />
                            <div className="h-3 bg-neutral-200/60 rounded-md w-10/12" />
                          </div>
                        </div>
                      </>
                    ) : selectedMode === 'reasoning' ? (
                      /* Reasoning mode: OBJECTIVE + 6 major sections with nested structure */
                      <>
                        {/* OBJECTIVE */}
                        <div className="space-y-2">
                          <div className="h-4 bg-neutral-200/70 rounded-md w-40" />
                          <div className="h-3 bg-neutral-200/60 rounded-md w-full" />
                        </div>
                        {/* PROBLEM STATEMENT */}
                        <div className="space-y-2">
                          <div className="h-4 bg-neutral-200/70 rounded-md w-56" />
                          <div className="h-3 bg-neutral-200/60 rounded-md w-full" />
                          <div className="h-3 bg-neutral-200/60 rounded-md w-11/12" />
                        </div>
                        {/* GIVEN CONSTRAINTS */}
                        <div className="space-y-2">
                          <div className="h-4 bg-neutral-200/70 rounded-md w-52" />
                          <div className="ml-2 space-y-1.5">
                            <div className="h-3 bg-neutral-200/60 rounded-md w-4/5" />
                            <div className="h-3 bg-neutral-200/60 rounded-md w-5/6" />
                          </div>
                        </div>
                        {/* PROBLEM DECOMPOSITION */}
                        <div className="space-y-2">
                          <div className="h-4 bg-neutral-200/70 rounded-md w-64" />
                          <div className="ml-2 space-y-1.5">
                            {[...Array(4)].map((_, i) => (
                              <div key={i} className="h-3 bg-neutral-200/60 rounded-md" style={{width: `${82 + i * 4}%`}} />
                            ))}
                          </div>
                        </div>
                        {/* REASONING APPROACH (4 phases) */}
                        <div className="space-y-3">
                          <div className="h-4 bg-neutral-200/70 rounded-md w-60" />
                          <div className="ml-2 space-y-2">
                            <div className="h-3 bg-neutral-200/60 rounded-md w-56" />
                            <div className="ml-3 space-y-1">
                              <div className="h-2.5 bg-neutral-200/50 rounded-md w-full" />
                              <div className="h-2.5 bg-neutral-200/50 rounded-md w-5/6" />
                            </div>
                          </div>
                        </div>
                        {/* VERIFICATION CRITERIA (4 levels) */}
                        <div className="space-y-2">
                          <div className="h-4 bg-neutral-200/70 rounded-md w-58" />
                          <div className="ml-2 space-y-1.5">
                            <div className="h-3 bg-neutral-200/60 rounded-md w-48" />
                            <div className="h-3 bg-neutral-200/60 rounded-md w-52" />
                          </div>
                        </div>
                      </>
                    ) : (
                      /* Standard mode: GOAL + 7 structured sections */
                      <>
                        {/* GOAL */}
                        <div className="space-y-2">
                          <div className="h-4 bg-neutral-200/70 rounded-md w-32" />
                          <div className="h-3 bg-neutral-200/60 rounded-md w-full" />
                        </div>
                        {/* CONTEXT */}
                        <div className="space-y-2">
                          <div className="h-4 bg-neutral-200/70 rounded-md w-36" />
                          <div className="h-3 bg-neutral-200/60 rounded-md w-full" />
                          <div className="h-3 bg-neutral-200/60 rounded-md w-11/12" />
                        </div>
                        {/* REQUIREMENTS */}
                        <div className="space-y-2">
                          <div className="h-4 bg-neutral-200/70 rounded-md w-48" />
                          <div className="ml-2 space-y-1.5">
                            {[...Array(4)].map((_, i) => (
                              <div key={i} className="h-3 bg-neutral-200/60 rounded-md" style={{width: `${80 + i * 4}%`}} />
                            ))}
                          </div>
                        </div>
                        {/* INSTRUCTIONS */}
                        <div className="space-y-2">
                          <div className="h-4 bg-neutral-200/70 rounded-md w-48" />
                          <div className="ml-2 space-y-1.5">
                            {[...Array(5)].map((_, i) => (
                              <div key={i} className="h-3 bg-neutral-200/60 rounded-md" style={{width: `${85 + (i % 3) * 3}%`}} />
                            ))}
                          </div>
                        </div>
                        {/* SUCCESS CRITERIA */}
                        <div className="space-y-2">
                          <div className="h-4 bg-neutral-200/70 rounded-md w-52" />
                          <div className="ml-2 space-y-1.5">
                            <div className="h-3 bg-neutral-200/60 rounded-md w-5/6" />
                            <div className="h-3 bg-neutral-200/60 rounded-md w-4/5" />
                          </div>
                        </div>
                        {/* OUTPUT FORMAT */}
                        <div className="space-y-2">
                          <div className="h-4 bg-neutral-200/70 rounded-md w-48" />
                          <div className="h-3 bg-neutral-200/60 rounded-md w-3/4" />
                        </div>
                        {/* AVOID */}
                        <div className="space-y-2">
                          <div className="h-4 bg-neutral-200/70 rounded-md w-32" />
                          <div className="ml-2 space-y-1.5">
                            <div className="h-3 bg-neutral-200/60 rounded-md w-2/3" />
                            <div className="h-3 bg-neutral-200/60 rounded-md w-3/4" />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <PromptInput
                inputPrompt={promptOptimizer.inputPrompt}
                onInputChange={promptOptimizer.setInputPrompt}
                selectedMode={selectedMode}
                onModeChange={setSelectedMode}
                onOptimize={handleOptimize}
                onShowBrainstorm={() => setShowBrainstorm(true)}
                isProcessing={promptOptimizer.isProcessing}
                modes={modes}
                aiNames={aiNames}
                currentAIIndex={currentAIIndex}
              />
            )}
          </>
        )}

        {/* Results Section - Canvas Style */}
        {showResults && promptOptimizer.displayedPrompt && !promptOptimizer.isProcessing && (
          <PromptCanvas
            inputPrompt={promptOptimizer.inputPrompt}
            displayedPrompt={promptOptimizer.displayedPrompt}
            optimizedPrompt={promptOptimizer.optimizedPrompt}
            qualityScore={promptOptimizer.qualityScore}
            selectedMode={selectedMode}
            currentMode={currentMode}
            promptUuid={currentPromptUuid}
            promptContext={promptContext}
            onDisplayedPromptChange={promptOptimizer.setDisplayedPrompt}
            onSkipAnimation={promptOptimizer.setSkipAnimation}
            suggestionsData={suggestionsData}
            onFetchSuggestions={fetchEnhancementSuggestions}
            onCreateNew={handleCreateNew}
          />
        )}

        {/* Privacy Policy Footer - Only show on home page */}
        {!showResults && (
          <footer className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
            <a
              href="/privacy-policy"
              className="text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
            >
              Privacy Policy
            </a>
          </footer>
        )}
      </main>
    </div>
  );
}

// Main export
export default function PromptOptimizerContainer() {
  return <PromptOptimizerContent />;
}
