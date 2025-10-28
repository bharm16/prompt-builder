import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { getAuthRepository, getPromptRepository } from '../../repositories';
import { PromptInput } from './PromptInput';
import { PromptCanvas } from './PromptCanvas';
import { HistorySidebar } from '../history/HistorySidebar';
import PromptImprovementForm from '../../PromptImprovementForm';
import WizardVideoBuilder from '../../components/wizard/WizardVideoBuilder';
import { ToastProvider, useToast } from '../../components/Toast';
import Settings, { useSettings } from '../../components/Settings';
import KeyboardShortcuts, { useKeyboardShortcuts } from '../../components/KeyboardShortcuts';
import DebugButton from '../../components/DebugButton';
import { captureException } from '../../config/sentry';
import { usePromptOptimizer } from '../../hooks/usePromptOptimizer';
import { usePromptHistory } from '../../hooks/usePromptHistory';
import { PromptContext } from '../../utils/PromptContext';
import { detectAndApplySceneChange } from '../../utils/detectSceneChange';
import { applySuggestionToPrompt } from './utils/applySuggestion.js';
import { createHighlightSignature } from './hooks/useSpanLabeling.js';

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
  const [currentPromptDocId, setCurrentPromptDocId] = useState(null);
  const [initialHighlights, setInitialHighlights] = useState(null);
  const [initialHighlightsVersion, setInitialHighlightsVersion] = useState(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const latestHighlightRef = useRef(null);
  const persistedSignatureRef = useRef(null);
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const isApplyingHistoryRef = useRef(false);

  const applyInitialHighlightSnapshot = useCallback((snapshot, { bumpVersion = false, markPersisted = false } = {}) => {
    setInitialHighlights(snapshot ?? null);
    if (bumpVersion) {
      setInitialHighlightsVersion((prev) => prev + 1);
    }
    latestHighlightRef.current = snapshot ?? null;
    if (markPersisted) {
      persistedSignatureRef.current = snapshot?.signature ?? null;
    }
  }, []);

  const resetEditStacks = useCallback(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    setCanUndo(false);
    setCanRedo(false);
  }, []);

  // Refs
  const debounceTimerRef = useRef(null);
  const lastRequestRef = useRef(null);
  const lastAppliedKeyRef = useRef(null);
  const skipLoadFromUrlRef = useRef(false);

  // Custom hooks
  const promptOptimizer = usePromptOptimizer(selectedMode);
  const promptHistory = usePromptHistory(user);

  const setDisplayedPromptSilently = useCallback((text) => {
    isApplyingHistoryRef.current = true;
    promptOptimizer.setDisplayedPrompt(text);
    setTimeout(() => {
      isApplyingHistoryRef.current = false;
    }, 0);
  }, [promptOptimizer]);

  // Stabilize promptContext to prevent infinite loops - only change when actual data changes
  const stablePromptContext = useMemo(() => {
    if (!promptContext) return null;
    return promptContext;
  }, [
    promptContext?.elements?.subject,
    promptContext?.elements?.action,
    promptContext?.elements?.location,
    promptContext?.elements?.time,
    promptContext?.elements?.mood,
    promptContext?.elements?.style,
    promptContext?.elements?.event,
    promptContext?.metadata?.format,
    promptContext?.version,
  ]);

  const handleHighlightsPersist = useCallback(async (result) => {
    if (!result || !Array.isArray(result.spans) || !result.signature) {
      return;
    }

    const snapshot = {
      spans: result.spans,
      meta: result.meta ?? null,
      signature: result.signature,
      cacheId: result.cacheId ?? (currentPromptUuid ? String(currentPromptUuid) : null),
      updatedAt: new Date().toISOString(),
    };

    const activeCacheId = currentPromptUuid ? String(currentPromptUuid) : null;
    if (activeCacheId && snapshot.cacheId && snapshot.cacheId !== activeCacheId) {
      return;
    }

    latestHighlightRef.current = snapshot;
    applyInitialHighlightSnapshot(snapshot, { bumpVersion: false, markPersisted: false });

    if (!currentPromptUuid) {
      return;
    }

    if (result.source === 'network' || result.source === 'cache-fallback') {
      promptHistory.updateEntryHighlight(currentPromptUuid, snapshot);
    }

    if (!user || !currentPromptDocId || result.source !== 'network') {
      return;
    }

    if (persistedSignatureRef.current === result.signature) {
      return;
    }

    try {
      const promptRepository = getPromptRepository();
      await promptRepository.updateHighlights(currentPromptDocId, {
        highlightCache: snapshot,
        versionEntry: {
          versionId: `v-${Date.now()}`,
          signature: result.signature,
          spansCount: result.spans.length,
          timestamp: new Date().toISOString(),
        },
      });
      persistedSignatureRef.current = result.signature;
    } catch (error) {
      console.error('Failed to persist highlight snapshot:', error);
    }
  }, [applyInitialHighlightSnapshot, currentPromptDocId, currentPromptUuid, promptHistory, user]);

  const handleDisplayedPromptChange = useCallback(
    (newText) => {
      const currentText = promptOptimizer.displayedPrompt;
      if (isApplyingHistoryRef.current) {
        isApplyingHistoryRef.current = false;
        promptOptimizer.setDisplayedPrompt(newText);
        return;
      }

      if (currentText !== newText) {
        undoStackRef.current = [...undoStackRef.current, {
          text: currentText,
          highlight: latestHighlightRef.current,
        }].slice(-100);
        redoStackRef.current = [];
        setCanUndo(true);
        setCanRedo(false);
      }

      promptOptimizer.setDisplayedPrompt(newText);
    },
    [promptOptimizer]
  );

  const handleUndo = useCallback(() => {
    if (!undoStackRef.current.length) {
      return;
    }

    const previous = undoStackRef.current.pop();
    const currentSnapshot = {
      text: promptOptimizer.displayedPrompt,
      highlight: latestHighlightRef.current,
    };
    redoStackRef.current = [...redoStackRef.current, currentSnapshot].slice(-100);
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(redoStackRef.current.length > 0);

    isApplyingHistoryRef.current = true;
    setDisplayedPromptSilently(previous.text);
    promptOptimizer.setOptimizedPrompt(previous.text);
    applyInitialHighlightSnapshot(previous.highlight ?? null, { bumpVersion: true, markPersisted: false });
    setTimeout(() => {
      isApplyingHistoryRef.current = false;
    }, 0);
  }, [applyInitialHighlightSnapshot, promptOptimizer, setDisplayedPromptSilently]);

  const handleRedo = useCallback(() => {
    if (!redoStackRef.current.length) {
      return;
    }

    const next = redoStackRef.current.pop();
    undoStackRef.current = [...undoStackRef.current, {
      text: promptOptimizer.displayedPrompt,
      highlight: latestHighlightRef.current,
    }].slice(-100);

    setCanUndo(true);
    setCanRedo(redoStackRef.current.length > 0);

    isApplyingHistoryRef.current = true;
    setDisplayedPromptSilently(next.text);
    promptOptimizer.setOptimizedPrompt(next.text);
    applyInitialHighlightSnapshot(next.highlight ?? null, { bumpVersion: true, markPersisted: false });
    setTimeout(() => {
      isApplyingHistoryRef.current = false;
    }, 0);
  }, [applyInitialHighlightSnapshot, promptOptimizer, setDisplayedPromptSilently]);

  // Listen for auth state changes
  useEffect(() => {
    const authRepository = getAuthRepository();
    const unsubscribe = authRepository.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // Load prompt from URL parameter if present
  useEffect(() => {
    const loadPromptFromUrl = async () => {
      if (!uuid) {
        // Don't reset the flag here either - only reset it explicitly in loadFromHistory
        return;
      }

      // Skip if we're already on this prompt or if we explicitly set the skip flag
      if (skipLoadFromUrlRef.current || currentPromptUuid === uuid) {
        // Don't reset the flag here - let the timeout in loadFromHistory handle it
        // Resetting it here causes the effect to run again after navigation completes
        return;
      }

      try {
        const promptRepository = getPromptRepository();
        const promptData = await promptRepository.getByUuid(uuid);
        if (promptData) {
          promptOptimizer.setInputPrompt(promptData.input);
          promptOptimizer.setOptimizedPrompt(promptData.output);
          setDisplayedPromptSilently(promptData.output);
          setSelectedMode(promptData.mode || 'optimize');
          setCurrentPromptUuid(promptData.uuid);
          setCurrentPromptDocId(promptData.id || null);
          setShowResults(true);
          const preloadHighlight = promptData.highlightCache
            ? {
                ...promptData.highlightCache,
                signature:
                  promptData.highlightCache.signature ?? createHighlightSignature(promptData.output ?? ''),
              }
            : null;
          applyInitialHighlightSnapshot(preloadHighlight, { bumpVersion: true, markPersisted: true });
          resetEditStacks();

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
    };

    loadPromptFromUrl();
  }, [
    uuid,
    currentPromptUuid,
    navigate,
    toast,
    promptOptimizer,
    setSelectedMode,
    setDisplayedPromptSilently,
    applyInitialHighlightSnapshot,
    resetEditStacks,
    setCurrentPromptDocId,
  ]);


  // Cycle through AI names
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentAIIndex((prev) => (prev + 1) % aiNames.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [aiNames.length]);

  // Display optimized prompt immediately (no animation)
  useEffect(() => {
    if (showResults && promptOptimizer.optimizedPrompt) {
      setDisplayedPromptSilently(promptOptimizer.optimizedPrompt);
    } else {
      setDisplayedPromptSilently('');
    }
  }, [promptOptimizer.optimizedPrompt, showResults]);

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
    if (result) {
      const saveResult = await promptHistory.saveToHistory(
        prompt,
        result.optimized,
        result.score,
        selectedMode,
        serializedContext
      );

      if (saveResult?.uuid) {
        skipLoadFromUrlRef.current = true; // Prevent URL effect from re-loading
        setCurrentPromptUuid(saveResult.uuid);
        setCurrentPromptDocId(saveResult.id ?? null);
        setShowResults(true);
        setShowHistory(true);
        applyInitialHighlightSnapshot(null, { bumpVersion: true, markPersisted: false });
        resetEditStacks();
        persistedSignatureRef.current = null;
        if (saveResult.uuid) {
          navigate(`/prompt/${saveResult.uuid}`, { replace: true });
        }
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

    // Create PromptContext from brainstorm data and ensure it persists
    const context = new PromptContext(elements, metadata);
    setPromptContext(context);

    console.log('[DEBUG] Context created in handleConceptComplete:', {
      context: context.toJSON(),
      elements,
      metadata,
      timestamp: new Date().toISOString()
    });

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
        const saveResult = await promptHistory.saveToHistory(
          finalConcept,
          result.optimized,
          result.score,
          selectedMode,
          serializedContext
        );
        if (saveResult?.uuid) {
          setDisplayedPromptSilently(result.optimized);

          skipLoadFromUrlRef.current = true; // Prevent URL effect from re-loading
          setCurrentPromptUuid(saveResult.uuid);
          setCurrentPromptDocId(saveResult.id ?? null);
          setShowResults(true);
          setShowHistory(true);
          toast.success('Video prompt generated successfully!');
          applyInitialHighlightSnapshot(null, { bumpVersion: true, markPersisted: false });
          resetEditStacks();
          persistedSignatureRef.current = null;
          navigate(`/prompt/${saveResult.uuid}`, { replace: true });
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
    skipLoadFromUrlRef.current = true;
    promptOptimizer.resetPrompt();
    setShowResults(false);
    setSuggestionsData(null);
    setConceptElements(null);
    setPromptContext(null); // Clear context
    setCurrentPromptUuid(null);
    setCurrentPromptDocId(null);
    applyInitialHighlightSnapshot(null, { bumpVersion: true, markPersisted: false });
    persistedSignatureRef.current = null;
    resetEditStacks();
    navigate('/', { replace: true });
  };

  // Load from history
  const loadFromHistory = (entry) => {
    console.log('[History] Loading entry:', {
      id: entry.id,
      mode: entry.mode,
      hasHighlightCache: !!entry.highlightCache,
      spansCount: entry.highlightCache?.spans?.length || 0,
      hasSignature: !!entry.highlightCache?.signature,
    });
    
    // Set skip flag to prevent URL loader from interfering
    skipLoadFromUrlRef.current = true;
    
    // Set UUID FIRST before any other updates to prevent race conditions
    // This ensures currentPromptUuid matches the URL before navigation
    setCurrentPromptUuid(entry.uuid || null);
    setCurrentPromptDocId(entry.id || null);

    promptOptimizer.setInputPrompt(entry.input);
    promptOptimizer.setOptimizedPrompt(entry.output);
    setDisplayedPromptSilently(entry.output);
    setSelectedMode(entry.mode);
    setShowResults(true);
    const preloadedHighlight = entry.highlightCache
      ? {
          ...entry.highlightCache,
          signature:
            entry.highlightCache.signature ?? createHighlightSignature(entry.output ?? ''),
        }
      : null;
    
    if (preloadedHighlight) {
      console.log('[History] Applying highlights:', {
        spansCount: preloadedHighlight.spans?.length,
        signature: preloadedHighlight.signature?.slice(0, 8),
      });
    } else {
      console.log('[History] No highlights to apply');
    }
    
    applyInitialHighlightSnapshot(preloadedHighlight, { bumpVersion: true, markPersisted: true });
    resetEditStacks();

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

    // Navigate to update URL - skipLoadFromUrlRef is already set above
    // to prevent the URL change from triggering the loadPromptFromUrl effect
    if (entry.uuid) {
      navigate(`/prompt/${entry.uuid}`, { replace: true });
    } else {
      // Navigate to root to clear the URL when no UUID exists
      navigate('/', { replace: true });
    }
    
    // Reset skip flag after navigation and render cycle completes
    // Use requestAnimationFrame twice to ensure we're past all React updates
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        skipLoadFromUrlRef.current = false;
      });
    });
  };

  // Fetch enhancement suggestions
  const fetchEnhancementSuggestions = async (payload = {}) => {
    const {
      highlightedText,
      originalText,
      displayedPrompt: payloadPrompt,
      range,
      offsets,
      metadata: rawMetadata = null,
      trigger = 'highlight',
    } = payload;

    const trimmedHighlight = (highlightedText || '').trim();
    const rawPrompt = payloadPrompt ?? promptOptimizer.displayedPrompt ?? '';
    const normalizedPrompt = rawPrompt.normalize('NFC');
    const metadata = rawMetadata
      ? {
          ...rawMetadata,
          span: rawMetadata.span ? { ...rawMetadata.span } : null,
        }
      : null;

    console.log('[DEBUG] fetchEnhancementSuggestions called with:', {
      highlightedText: trimmedHighlight,
      hasPromptContext: !!promptContext,
      contextElements: promptContext?.elements,
      metadata,
      trigger,
      timestamp: new Date().toISOString(),
    });

    if (selectedMode !== 'video' || !trimmedHighlight) {
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (suggestionsData?.selectedText === trimmedHighlight && suggestionsData?.show) {
      return;
    }

    const performFetch = async () => {
      const requestId = Symbol('suggestions');
      lastRequestRef.current = requestId;

      const rangeSnapshot = range?.cloneRange ? range.cloneRange() : range ?? null;
      const offsetsSnapshot = offsets &&
        typeof offsets.start === 'number' &&
        typeof offsets.end === 'number'
        ? { start: offsets.start, end: offsets.end }
        : null;

      const exactSelectionText =
        offsetsSnapshot
          ? rawPrompt.slice(offsetsSnapshot.start, offsetsSnapshot.end)
          : (originalText ?? trimmedHighlight);

      const closeSuggestions = () => {
        setSuggestionsData(null);
        if (typeof window !== 'undefined' && window.getSelection) {
          const selection = window.getSelection();
          if (selection && selection.removeAllRanges) {
            selection.removeAllRanges();
          }
        }
        lastAppliedKeyRef.current = null;
      };

      const spanMeta = metadata?.span ?? null;
      const idempotencyKey = spanMeta?.idempotencyKey || metadata?.idempotencyKey || null;

      const applySuggestion = async (suggestion) => {
        try {
          const suggestionText =
            typeof suggestion === 'string' ? suggestion : suggestion?.text || '';

          if (!suggestionText) {
            toast.error('Suggestion is missing text to apply');
            return;
          }

          const latestPromptRaw = promptOptimizer.displayedPrompt ?? '';
          if (!latestPromptRaw) {
            toast.error('Unable to apply suggestion to an empty prompt');
            return;
          }

          if (idempotencyKey && lastAppliedKeyRef.current === idempotencyKey) {
            toast.info('Suggestion already applied');
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

          const application = applySuggestionToPrompt({
            prompt: latestPromptRaw,
            suggestionText,
            highlight: trimmedHighlight,
            spanMeta,
            metadata,
            offsets: offsetsSnapshot,
          });

          if (!application.updatedPrompt) {
            toast.info('No changes applied');
            return;
          }

          const { updatedPrompt, replacementTarget, idempotencyKey: appliedKey } = application;

          if (updatedPrompt === latestPromptRaw) {
            toast.info('No changes applied');
            return;
          }

          try {
            const finalPrompt = await detectAndApplySceneChange({
              originalPrompt: latestPromptRaw,
              updatedPrompt,
              oldValue: replacementTarget,
              newValue: suggestionText,
            });

            undoStackRef.current = [...undoStackRef.current, {
              text: promptOptimizer.displayedPrompt,
              highlight: latestHighlightRef.current,
            }].slice(-100);
            redoStackRef.current = [];
            setCanUndo(true);
            setCanRedo(false);

            promptOptimizer.setOptimizedPrompt(finalPrompt);
            setDisplayedPromptSilently(finalPrompt);
            lastAppliedKeyRef.current = appliedKey || idempotencyKey || null;
            closeSuggestions();
            toast.success('Suggestion applied');
          } catch (error) {
            console.error('Error detecting scene change:', error);
            undoStackRef.current = [...undoStackRef.current, {
              text: promptOptimizer.displayedPrompt,
              highlight: latestHighlightRef.current,
            }].slice(-100);
            redoStackRef.current = [];
            setCanUndo(true);
            setCanRedo(false);

            promptOptimizer.setOptimizedPrompt(updatedPrompt);
            setDisplayedPromptSilently(updatedPrompt);
            lastAppliedKeyRef.current = appliedKey || idempotencyKey || null;
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

      const normalizedHighlight = trimmedHighlight.normalize('NFC');
      const highlightIndex = typeof spanMeta?.start === 'number'
        ? spanMeta.start
        : normalizedPrompt.indexOf(normalizedHighlight);

      const contextBefore = spanMeta?.leftCtx
        ? spanMeta.leftCtx
        : rawPrompt.substring(Math.max(0, highlightIndex - 300), Math.max(0, highlightIndex)).trim();
      const contextAfter = spanMeta?.rightCtx
        ? spanMeta.rightCtx
        : rawPrompt.substring(
            Math.max(0, highlightIndex + trimmedHighlight.length),
            Math.min(rawPrompt.length, highlightIndex + trimmedHighlight.length + 300)
          ).trim();

      const formatCategoryLabel = (value) => {
        if (!value || typeof value !== 'string') return null;
        return value
          .split(/[_-]+|\s+/)
          .filter(Boolean)
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' ');
      };

      const highlightCategory =
        metadata?.category && metadata.category.trim().length > 0
          ? metadata.category.trim()
          : null;
      const highlightCategoryConfidence =
        Number.isFinite(metadata?.confidence)
          ? Math.min(1, Math.max(0, metadata.confidence))
          : null;

      setSuggestionsData({
        show: true,
        selectedText: trimmedHighlight,
        originalText: exactSelectionText,
        suggestions: [],
        isLoading: true,
        isPlaceholder: false,
        fullPrompt: rawPrompt,
        selectionRange: rangeSnapshot,
        selectionOffsets: offsetsSnapshot,
        contextSecondaryValue: formatCategoryLabel(highlightCategory),
        highlightMetadata: metadata,
        setSuggestions: (newSuggestions, newIsPlaceholder) => {
          setSuggestionsData((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              suggestions: newSuggestions,
              isPlaceholder:
                newIsPlaceholder !== undefined ? newIsPlaceholder : prev.isPlaceholder,
              isLoading: false,
            };
          });
        },
        onSuggestionClick: applySuggestion,
        onClose: closeSuggestions,
      });

      try {
        const brainstormContextData = promptContext
          ? {
              elements: promptContext.elements,
              metadata: promptContext.metadata,
              version: promptContext.version || '1.0',
            }
          : null;

        const response = await fetch('/api/get-enhancement-suggestions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': 'dev-key-12345',
          },
          body: JSON.stringify({
            highlightedText: trimmedHighlight,
            contextBefore,
            contextAfter,
            fullPrompt: rawPrompt,
            originalUserPrompt: promptOptimizer.inputPrompt,
            brainstormContext: brainstormContextData,
            highlightedCategory: highlightCategory,
            highlightedCategoryConfidence: highlightCategoryConfidence,
            highlightedPhrase: metadata?.phrase || null,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to fetch suggestions');
        }

        const data = await response.json();
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
        if (lastRequestRef.current === requestId) {
          toast.error('Failed to load suggestions');
          closeSuggestions();
        }
      }
    };

    const immediate = trigger === 'highlight';
    if (immediate) {
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

      {/* Creative Brainstorm - Full Page Wizard UI */}
      {showBrainstorm && (
        <div
          className="fixed inset-0 z-[100] bg-gray-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="wizard-title"
        >
          <button
            onClick={handleSkipBrainstorm}
            className="fixed right-6 top-6 z-[110] rounded-lg p-2 text-gray-500 hover:text-gray-700 hover:bg-white hover:shadow-md transition-all duration-200"
            aria-label="Close wizard"
            title="Close (Esc)"
          >
            <X className="h-6 w-6" />
          </button>
          <WizardVideoBuilder
            onConceptComplete={handleConceptComplete}
            initialConcept={promptOptimizer.inputPrompt}
          />
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

      {/* Top Action Buttons - Hidden when wizard is open */}
      {!showBrainstorm && (
        <div className="fixed left-6 top-6 z-fixed flex flex-col gap-2">
          <button
            onClick={handleCreateNew}
            className="btn-icon-secondary shadow-lg hover-scale ripple"
            aria-label="Create new prompt"
          >
            <Plus className="h-5 w-5" />
          </button>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="btn-icon-secondary shadow-lg hover-scale ripple"
            aria-label={showHistory ? 'Hide history sidebar' : 'Show history sidebar'}
            aria-expanded={showHistory}
          >
            <PanelLeft className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* History Sidebar - Hidden when wizard is open */}
      {!showBrainstorm && (
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
      )}

      {/* Main Content - Hidden when wizard is open */}
      {!showBrainstorm && (
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
        {showResults && !promptOptimizer.isProcessing && (
          <PromptCanvas
            key={
              currentPromptUuid
                ? `prompt-${currentPromptUuid}`
                : `prompt-${createHighlightSignature(promptOptimizer.displayedPrompt ?? '')}`
            }
            inputPrompt={promptOptimizer.inputPrompt}
            displayedPrompt={promptOptimizer.displayedPrompt}
            optimizedPrompt={promptOptimizer.optimizedPrompt}
            qualityScore={promptOptimizer.qualityScore}
            selectedMode={selectedMode}
            currentMode={currentMode}
            promptUuid={currentPromptUuid}
            promptContext={stablePromptContext}
            onDisplayedPromptChange={handleDisplayedPromptChange}
            suggestionsData={suggestionsData}
            onFetchSuggestions={fetchEnhancementSuggestions}
            onCreateNew={handleCreateNew}
            initialHighlights={initialHighlights}
            initialHighlightsVersion={initialHighlightsVersion}
            onHighlightsPersist={handleHighlightsPersist}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={canUndo}
            canRedo={canRedo}
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
      )}

      {/* Debug Button - Show in development or with ?debug=true */}
      {(process.env.NODE_ENV === 'development' ||
        new URLSearchParams(window.location.search).get('debug') === 'true') && (
        <DebugButton
          inputPrompt={promptOptimizer.inputPrompt}
          displayedPrompt={promptOptimizer.displayedPrompt}
          optimizedPrompt={promptOptimizer.optimizedPrompt}
          selectedMode={selectedMode}
          promptContext={stablePromptContext}
        />
      )}
    </div>
  );
}

// Main export
export default function PromptOptimizerContainer() {
  return <PromptOptimizerContent />;
}
