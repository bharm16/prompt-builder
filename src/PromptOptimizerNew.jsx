import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Search,
  FileText,
  Lightbulb,
  User,
  Copy,
  Check,
  Download,
  Clock,
  X,
  GraduationCap,
  Edit,
  PanelLeft,
  Plus,
  Video,
  LogIn,
  LogOut,
  Settings as SettingsIcon,
  Keyboard,
  Shuffle,
  Zap,
  MessageSquare,
} from 'lucide-react';
import {
  auth,
  signInWithGoogle,
  signOutUser,
  savePromptToFirestore,
  getUserPrompts,
  checkUserPromptsRaw,
  deleteUserPromptsRaw,
} from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import PromptImprovementForm from './PromptImprovementForm';
import PromptEnhancementEditor, {
  SuggestionsPanel,
} from './components/PromptEnhancementEditor';
import CreativeBrainstormEnhanced from './components/CreativeBrainstormEnhanced';
import { ToastProvider, useToast } from './components/Toast';
import Settings, { useSettings } from './components/Settings';
import KeyboardShortcuts, { useKeyboardShortcuts } from './components/KeyboardShortcuts';
import ModeSelector from './components/ModeSelector';
import EmptyState, { HistoryEmptyState } from './components/EmptyState';

// Main component wrapped with ToastProvider
function ModernPromptOptimizerContent() {
  // Force light mode immediately
  React.useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  const toast = useToast();
  const { settings, updateSetting, resetSettings } = useSettings();

  // State management
  const [inputPrompt, setInputPrompt] = useState('');
  const [selectedMode, setSelectedMode] = useState('optimize');
  const [isProcessing, setIsProcessing] = useState(false);
  const [optimizedPrompt, setOptimizedPrompt] = useState('');
  const [displayedPrompt, setDisplayedPrompt] = useState('');
  const [copied, setCopied] = useState(false);
  const [qualityScore, setQualityScore] = useState(null);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(true);
  const [showResults, setShowResults] = useState(false);
  const [currentAIIndex, setCurrentAIIndex] = useState(0);
  const [skipAnimation, setSkipAnimation] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Auth state
  const [user, setUser] = useState(null);
  const [showAuthMenu, setShowAuthMenu] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // UI state
  const [showSettings, setShowSettings] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Prompt improvement state
  const [showImprover, setShowImprover] = useState(false);
  const [improvementContext, setImprovementContext] = useState(null);

  // Enhancement suggestions state
  const [suggestionsData, setSuggestionsData] = useState(null);

  // Creative brainstorm state
  const [showBrainstorm, setShowBrainstorm] = useState(false);
  const [conceptElements, setConceptElements] = useState(null);

  // Input editing state
  const [isEditingInput, setIsEditingInput] = useState(false);
  const [editedInput, setEditedInput] = useState('');

  // Refs
  const authMenuRef = useRef(null);
  const exportMenuRef = useRef(null);
  const editorRef = useRef(null);

  const aiNames = ['Claude AI', 'ChatGPT', 'Gemini'];

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

  const quickActions = [
    {
      label: 'Research Topic',
      icon: Search,
      mode: 'research',
      prompt: 'impact of AI on healthcare',
      category: 'research',
      description: 'Deep dive into any subject',
    },
    {
      label: 'Analyze Data',
      icon: FileText,
      mode: 'optimize',
      prompt: 'analyze customer feedback data and identify trends',
      category: 'research',
      description: 'Extract insights from data',
    },
    {
      label: 'Draft Document',
      icon: FileText,
      mode: 'optimize',
      prompt: 'write a business plan for a coffee shop',
      category: 'writing',
      description: 'Create professional documents',
    },
    {
      label: 'Brainstorm Ideas',
      icon: Lightbulb,
      mode: 'optimize',
      prompt: 'brainstorm innovative product ideas for sustainable living',
      category: 'creative',
      description: 'Generate creative concepts',
    },
    {
      label: 'Learn Something',
      icon: GraduationCap,
      mode: 'socratic',
      prompt: 'quantum computing basics',
      category: 'learning',
      description: 'Interactive learning journey',
    },
    {
      label: 'Random Prompt',
      icon: Shuffle,
      mode: 'optimize',
      prompt: 'random',
      category: 'creative',
      description: 'Try a surprise prompt',
    },
  ];

  const randomPrompts = [
    'explain how blockchain technology works',
    'write a marketing strategy for a new mobile app',
    'compare different project management methodologies',
    'create a step-by-step guide for making sourdough bread',
    'analyze the impact of remote work on productivity',
    'design a workout plan for beginners',
    'explain the basics of investing in stocks',
    'write a product description for wireless headphones',
    'create a social media content calendar',
    'explain machine learning in simple terms',
    'write a proposal for a sustainability initiative',
    'analyze customer retention strategies',
    'create a lesson plan for teaching coding to kids',
    'write an email newsletter about tech trends',
    'explain how search engines rank websites',
    'create a budget plan for small businesses',
    'analyze different leadership styles',
    'write a guide for starting a podcast',
    'explain the psychology of habit formation',
    'create a content strategy for a blog',
  ];

  // Handle clicks outside auth menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (authMenuRef.current && !authMenuRef.current.contains(event.target)) {
        setShowAuthMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle clicks outside export menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
        setShowExportMenu(false);
      }
    };

    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showExportMenu]);

  // Load localStorage history on mount and ensure light mode
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('promptHistory');
      if (savedHistory) {
        const parsedHistory = JSON.parse(savedHistory);
        setHistory(parsedHistory);
      }
    } catch (error) {
      console.error('Error loading history from localStorage:', error);
      localStorage.removeItem('promptHistory'); // Clear corrupted data
    }

    // Force remove dark class if settings say dark mode is off
    if (!settings.darkMode) {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.darkMode]);

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log('Auth state changed:', currentUser ? currentUser.uid : 'Not signed in');
      setUser(currentUser);
      if (currentUser) {
        // Expose functions to window for debugging and migration
        window.checkAllPrompts = async () => {
          try {
            const prompts = await checkUserPromptsRaw(currentUser.uid);
            console.log('Your prompts:', prompts);
            return prompts;
          } catch (error) {
            console.error('Failed to check prompts:', error);
          }
        };

        window.deleteOldPrompts = async () => {
          try {
            const count = await deleteUserPromptsRaw(currentUser.uid);
            console.log(`✓ Deleted ${count} old prompts from Firebase`);
            localStorage.removeItem('promptHistory');
            console.log('✓ Cleared localStorage');
            setHistory([]);
            alert(`Deleted ${count} old prompts from Firebase and cleared localStorage. Page will reload.`);
            window.location.reload();
          } catch (error) {
            console.error('Failed to delete prompts:', error);
            alert('Failed to delete prompts. Check console for details.');
          }
        };

        // Clear localStorage on mount when user is signed in
        localStorage.removeItem('promptHistory');
        console.log('Cleared localStorage on mount');

        // Wait a bit to ensure auth tokens are ready
        setTimeout(async () => {
          await loadHistoryFromFirestore(currentUser.uid);
        }, 500);
      } else {
        delete window.deleteOldPrompts;
        try {
          const savedHistory = localStorage.getItem('promptHistory');
          if (savedHistory) {
            const parsedHistory = JSON.parse(savedHistory);
            setHistory(parsedHistory);
          }
        } catch (error) {
          console.error('Error loading history from localStorage:', error);
          localStorage.removeItem('promptHistory');
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Load history from Firestore
  const loadHistoryFromFirestore = async (userId) => {
    console.log('Loading history from Firestore for user:', userId);
    setIsLoadingHistory(true);
    try {
      const prompts = await getUserPrompts(userId, 10);
      console.log('Successfully loaded prompts from Firestore:', prompts.length);
      setHistory(prompts);

      // Also update localStorage with the latest from Firestore
      if (prompts.length > 0) {
        try {
          localStorage.setItem('promptHistory', JSON.stringify(prompts));
        } catch (e) {
          console.warn('Could not save to localStorage:', e);
        }
      }
    } catch (error) {
      console.error('Error loading history from Firestore:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        name: error.name
      });

      // Try to load from localStorage as fallback
      try {
        const savedHistory = localStorage.getItem('promptHistory');
        if (savedHistory) {
          const parsedHistory = JSON.parse(savedHistory);
          console.log('Loaded history from localStorage fallback:', parsedHistory.length);
          setHistory(parsedHistory);
        }
        // Don't show error toast - having no history is normal
      } catch (localError) {
        console.error('Error loading from localStorage fallback:', localError);
      }
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Cycle through AI names
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentAIIndex((prev) => (prev + 1) % aiNames.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [aiNames.length]);

  // Typewriter animation for results
  useEffect(() => {
    if (!optimizedPrompt || !showResults) {
      setDisplayedPrompt('');
      return;
    }

    if (skipAnimation) {
      setDisplayedPrompt(optimizedPrompt);
      return;
    }

    setDisplayedPrompt('');
    let currentIndex = 0;

    const intervalId = setInterval(() => {
      if (currentIndex <= optimizedPrompt.length) {
        const text = optimizedPrompt.slice(0, currentIndex);
        setDisplayedPrompt(text);
        currentIndex += 3;
      } else {
        clearInterval(intervalId);
      }
    }, 5);

    return () => clearInterval(intervalId);
  }, [optimizedPrompt, showResults, skipAnimation]);

  // Update contentEditable div when displayedPrompt changes
  useEffect(() => {
    if (editorRef.current && editorRef.current.textContent !== displayedPrompt) {
      editorRef.current.textContent = displayedPrompt;
    }
  }, [displayedPrompt]);

  // Handle Google Sign In
  const handleSignIn = async () => {
    try {
      const user = await signInWithGoogle();
      toast.success(`Welcome, ${user.displayName}!`);
    } catch (error) {
      console.error('Sign in failed:', error);
      toast.error('Failed to sign in. Please try again.');
    }
  };

  // Handle Sign Out
  const handleSignOut = async () => {
    try {
      await signOutUser();
      setHistory([]);
      toast.success('Signed out successfully');
    } catch (error) {
      console.error('Sign out failed:', error);
      toast.error('Failed to sign out');
    }
  };

  const saveToHistory = async (input, output, score) => {
    const newEntry = {
      input,
      output,
      score,
      mode: selectedMode,
    };

    if (user) {
      try {
        const docId = await savePromptToFirestore(user.uid, newEntry);
        const entryWithId = {
          id: docId,
          timestamp: new Date().toISOString(),
          ...newEntry,
        };
        setHistory((prevHistory) => [entryWithId, ...prevHistory].slice(0, 10));
      } catch (error) {
        console.error('Error saving to Firestore:', error);
        toast.error('Failed to save to cloud');
      }
    } else {
      try {
        const entryWithLocalId = {
          id: Date.now(),
          timestamp: new Date().toISOString(),
          ...newEntry,
        };
        setHistory((prevHistory) => {
          const updatedHistory = [entryWithLocalId, ...prevHistory].slice(0, 10);
          localStorage.setItem('promptHistory', JSON.stringify(updatedHistory));
          return updatedHistory;
        });
      } catch (error) {
        console.error('Error saving to localStorage:', error);
        toast.error('Failed to save to history');
      }
    }
  };

  const calculateQualityScore = (input, output) => {
    let score = 0;
    const inputWords = input.split(/\s+/).length;
    const outputWords = output.split(/\s+/).length;

    if (outputWords > inputWords * 2) score += 25;
    else if (outputWords > inputWords) score += 15;

    const sections = (output.match(/\*\*/g) || []).length / 2;
    score += Math.min(sections * 10, 30);

    if (output.includes('Goal')) score += 15;
    if (output.includes('Return Format') || output.includes('Research')) score += 15;
    if (output.includes('Context') || output.includes('Learning')) score += 15;

    return Math.min(score, 100);
  };

  const analyzeAndOptimize = async (prompt, context = null) => {
    try {
      const response = await fetch('http://localhost:3001/api/optimize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'dev-key-12345',
        },
        body: JSON.stringify({
          prompt: prompt,
          mode: selectedMode,
          context: context,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'API request failed');
      }

      const data = await response.json();
      return data.optimizedPrompt;
    } catch (error) {
      console.error('Error calling Claude API:', error);
      throw error;
    }
  };

  const handleImproveFirst = () => {
    if (!inputPrompt.trim()) {
      toast.warning('Please enter a prompt first');
      return;
    }
    setShowImprover(true);
  };

  const handleImprovementComplete = async (enhancedPrompt, context) => {
    setShowImprover(false);
    setImprovementContext(context);
    setInputPrompt(enhancedPrompt);
    handleOptimize(enhancedPrompt, context);
  };

  const handleOptimize = async (
    promptToOptimize = inputPrompt,
    context = improvementContext
  ) => {
    if (!promptToOptimize.trim()) {
      toast.warning('Please enter a prompt');
      return;
    }

    setIsProcessing(true);
    setOptimizedPrompt('');
    setDisplayedPrompt('');
    setQualityScore(null);
    setSkipAnimation(false);

    try {
      const optimized = await analyzeAndOptimize(promptToOptimize, context);
      const score = calculateQualityScore(promptToOptimize, optimized);

      setOptimizedPrompt(optimized);
      setQualityScore(score);
      saveToHistory(promptToOptimize, optimized, score);
      setShowResults(true);
      setShowHistory(true);

      // Show quality score toast
      if (score >= 80) {
        toast.success(`Excellent prompt! Quality score: ${score}%`);
      } else if (score >= 60) {
        toast.info(`Good prompt! Quality score: ${score}%`);
      } else {
        toast.warning(`Prompt could be improved. Score: ${score}%`);
      }
    } catch (error) {
      console.error('Optimization failed:', error);
      toast.error('Failed to optimize. Make sure the server is running.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConceptComplete = async (finalConcept, elements) => {
    setConceptElements(elements);
    setInputPrompt(finalConcept);
    setShowBrainstorm(false);

    setTimeout(async () => {
      setIsProcessing(true);
      setOptimizedPrompt('');
      setDisplayedPrompt('');
      setQualityScore(null);
      setSkipAnimation(false);

      try {
        const optimized = await analyzeAndOptimize(finalConcept);
        const score = calculateQualityScore(finalConcept, optimized);

        setOptimizedPrompt(optimized);
        setQualityScore(score);
        saveToHistory(finalConcept, optimized, score);
        setShowResults(true);
        setShowHistory(true);
        toast.success('Video prompt generated successfully!');
      } catch (error) {
        console.error('Optimization failed:', error);
        toast.error('Failed to optimize. Make sure the server is running.');
      } finally {
        setIsProcessing(false);
      }
    }, 100);
  };

  const handleSkipBrainstorm = () => {
    setShowBrainstorm(false);
    setConceptElements({ skipped: true });
  };

  const handleQuickAction = (action) => {
    setSelectedMode(action.mode);
    if (action.prompt === 'random') {
      const randomIndex = Math.floor(Math.random() * randomPrompts.length);
      setInputPrompt(randomPrompts[randomIndex]);
    } else {
      setInputPrompt(action.prompt);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(displayedPrompt);
    setCopied(true);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = (format) => {
    let content = '';
    const timestamp = new Date().toLocaleString();

    if (format === 'markdown') {
      content = `# Prompt Optimization\n\n**Date:** ${timestamp}\n\n## Original Prompt\n${inputPrompt}\n\n## Optimized Prompt\n${displayedPrompt}`;
    } else if (format === 'json') {
      content = JSON.stringify(
        {
          timestamp,
          original: inputPrompt,
          optimized: displayedPrompt,
          qualityScore,
          mode: selectedMode,
        },
        null,
        2
      );
    } else {
      content = `PROMPT OPTIMIZATION\nDate: ${timestamp}\n\n=== ORIGINAL ===\n${inputPrompt}\n\n=== OPTIMIZED ===\n${displayedPrompt}`;
    }

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prompt-optimization.${format === 'json' ? 'json' : format === 'markdown' ? 'md' : 'txt'}`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
    toast.success(`Exported as ${format.toUpperCase()}`);
  };

  const handleEdit = () => {
    setIsEditingInput(true);
    setEditedInput(inputPrompt);
  };

  const handleSaveEdit = async () => {
    if (!editedInput.trim()) {
      toast.warning('Input cannot be empty');
      return;
    }
    setInputPrompt(editedInput);
    setIsEditingInput(false);

    // Re-optimize with the new input
    setIsProcessing(true);
    setOptimizedPrompt('');
    setDisplayedPrompt('');
    setSkipAnimation(false);

    try {
      const optimized = await analyzeAndOptimize(editedInput, improvementContext);
      const score = calculateQualityScore(editedInput, optimized);

      setOptimizedPrompt(optimized);
      setQualityScore(score);
      saveToHistory(editedInput, optimized, score);
      toast.success('Prompt re-optimized!');
    } catch (error) {
      console.error('Optimization failed:', error);
      toast.error('Failed to optimize. Make sure the server is running.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditingInput(false);
    setEditedInput('');
  };

  const handleCreateNew = () => {
    setInputPrompt('');
    setOptimizedPrompt('');
    setDisplayedPrompt('');
    setQualityScore(null);
    setShowResults(false);
    setSuggestionsData(null);
    setConceptElements(null);
    setImprovementContext(null);
    setIsEditingInput(false);
    setEditedInput('');
  };

  const handleClearAllData = () => {
    localStorage.removeItem('promptHistory');
    setHistory([]);
    handleCreateNew();
    toast.success('All data cleared');
  };

  // Debounce timer ref
  const debounceTimerRef = useRef(null);
  const lastRequestRef = useRef(null);

  // Fetch enhancement suggestions
  const fetchEnhancementSuggestions = async (
    highlightedText,
    originalText,
    fullPrompt,
    selectionRange
  ) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (
      suggestionsData?.selectedText === highlightedText &&
      suggestionsData?.show
    ) {
      return;
    }

    debounceTimerRef.current = setTimeout(async () => {
      const currentSelection = window.getSelection().toString().trim();
      const cleanedCurrentSelection = currentSelection.replace(/^-\s*/, '');
      if (cleanedCurrentSelection !== highlightedText) {
        return;
      }

      lastRequestRef.current = highlightedText;

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
        originalText: originalText,
        suggestions: [],
        isLoading: true,
        isPlaceholder: false,
        fullPrompt: fullPrompt,
        setSuggestions: (newSuggestions, newIsPlaceholder) => {
          setSuggestionsData((prev) => ({
            ...prev,
            suggestions: newSuggestions,
            isPlaceholder:
              newIsPlaceholder !== undefined
                ? newIsPlaceholder
                : prev.isPlaceholder,
            isLoading: false,
          }));
        },
        onSuggestionClick: (suggestionText) => {
          const updatedPrompt = displayedPrompt.replace(
            originalText,
            suggestionText
          );
          setOptimizedPrompt(updatedPrompt);
          setDisplayedPrompt(updatedPrompt);
          setSuggestionsData(null);
          window.getSelection().removeAllRanges();
          toast.success('Suggestion applied');
        },
        onClose: () => {
          setSuggestionsData(null);
          window.getSelection().removeAllRanges();
        },
      });

      try {
        const response = await fetch(
          'http://localhost:3001/api/get-enhancement-suggestions',
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
              originalUserPrompt: inputPrompt,
            }),
          }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch suggestions');
        }

        const data = await response.json();

        setSuggestionsData({
          show: true,
          selectedText: highlightedText,
          originalText: originalText,
          suggestions: data.suggestions || [],
          isLoading: false,
          isPlaceholder: data.isPlaceholder || false,
          fullPrompt: fullPrompt,
          setSuggestions: (newSuggestions, newIsPlaceholder) => {
            setSuggestionsData((prev) => ({
              ...prev,
              suggestions: newSuggestions,
              isPlaceholder:
                newIsPlaceholder !== undefined
                  ? newIsPlaceholder
                  : prev.isPlaceholder,
              isLoading: false,
            }));
          },
          onSuggestionClick: (suggestionText) => {
            const updatedPrompt = displayedPrompt.replace(
              originalText,
              suggestionText
            );
            setOptimizedPrompt(updatedPrompt);
            setDisplayedPrompt(updatedPrompt);
            setSuggestionsData(null);
            window.getSelection().removeAllRanges();
            toast.success('Suggestion applied');
          },
          onClose: () => {
            setSuggestionsData(null);
            window.getSelection().removeAllRanges();
          },
        });
      } catch (error) {
        console.error('Error fetching suggestions:', error);
        toast.error('Failed to load suggestions');
        setSuggestionsData(null);
      }
    }, 300);
  };

  const loadFromHistory = (entry) => {
    setSkipAnimation(true);
    setInputPrompt(entry.input);
    setOptimizedPrompt(entry.output);
    setDisplayedPrompt(entry.output);
    setQualityScore(entry.score);
    setSelectedMode(entry.mode);
    setShowResults(true);
  };

  const filteredHistory = history.filter((entry) => {
    if (!searchQuery) return true;
    return entry.input.toLowerCase().includes(searchQuery.toLowerCase()) ||
           entry.output.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const currentMode = modes.find((m) => m.id === selectedMode) || modes[0];

  // Keyboard shortcuts
  useKeyboardShortcuts({
    openShortcuts: () => setShowShortcuts(true),
    openSettings: () => setShowSettings(true),
    createNew: handleCreateNew,
    optimize: () => !isProcessing && showResults === false && handleOptimize(),
    improveFirst: handleImproveFirst,
    canCopy: () => showResults && displayedPrompt,
    copy: handleCopy,
    export: () => showResults && handleExport(settings.exportFormat),
    toggleSidebar: () => setShowHistory(!showHistory),
    switchMode: (index) => {
      if (modes[index]) {
        setSelectedMode(modes[index].id);
        toast.info(`Switched to ${modes[index].name}`);
      }
    },
    applySuggestion: (index) => {
      if (suggestionsData?.suggestions[index]) {
        suggestionsData.onSuggestionClick(suggestionsData.suggestions[index].text);
      }
    },
    closeModal: () => {
      if (showSettings) setShowSettings(false);
      else if (showShortcuts) setShowShortcuts(false);
      else if (showImprover) setShowImprover(false);
      else if (showBrainstorm) setShowBrainstorm(false);
      else if (showExportMenu) setShowExportMenu(false);
      else if (suggestionsData) setSuggestionsData(null);
    },
  });

  return (
    <div className="h-screen overflow-hidden gradient-neutral transition-colors duration-300">
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
        onClearAllData={handleClearAllData}
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
                className="absolute right-4 top-4 z-10 btn-ghost btn-sm"
                aria-label="Skip brainstorm"
              >
                Skip to Advanced Mode →
              </button>
              <div className="p-6">
                <CreativeBrainstormEnhanced
                  onConceptComplete={handleConceptComplete}
                  initialConcept={inputPrompt}
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
                initialPrompt={inputPrompt}
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

      {/* Top Right Action Buttons */}
      <div className="fixed right-6 top-6 z-fixed flex items-center gap-2">
        <button
          onClick={() => setShowShortcuts(true)}
          className="btn-icon-secondary shadow-lg hover-scale ripple"
          aria-label="Show keyboard shortcuts"
          title="Keyboard shortcuts (⌘K)"
        >
          <Keyboard className="h-5 w-5" />
        </button>
        <button
          onClick={() => setShowSettings(true)}
          className="btn-icon-secondary shadow-lg hover-scale ripple"
          aria-label="Open settings"
          title="Settings (⌘,)"
        >
          <SettingsIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Left Sidebar - History */}
      <aside
        id="history-sidebar"
        className={`${showHistory ? 'w-72' : 'w-0'} fixed left-0 top-0 z-sticky h-screen max-h-screen overflow-hidden border-r border-neutral-200 bg-neutral-100 transition-all duration-300`}
        aria-label="Prompt history"
        aria-hidden={!showHistory}
      >
        {showHistory && (
          <div className="flex h-screen max-h-screen flex-col overflow-hidden">
            <div className="flex-shrink-0 border-b border-neutral-200 p-4 pt-20">
              <h2 className="font-semibold text-neutral-900">
                Recent Prompts
              </h2>
              {!user && (
                <p className="mt-1 text-xs text-neutral-600">
                  Sign in to sync across devices
                </p>
              )}

              {/* Search History */}
              {history.length > 0 && (
                <div className="mt-3 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search history..."
                    className="w-full pl-9 pr-3 py-2 text-sm border-2 border-neutral-200 rounded-lg bg-white focus:bg-white focus:border-primary-500 focus:ring focus:ring-primary-500 focus:ring-opacity-20 transition-colors"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:bg-neutral-200 rounded"
                      aria-label="Clear search"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-2">
              {isLoadingHistory ? (
                <div className="p-4 text-center">
                  <div className="spinner-sm mx-auto mb-2" />
                  <p className="text-sm text-neutral-500">
                    Loading history...
                  </p>
                </div>
              ) : filteredHistory.length === 0 && searchQuery ? (
                <div className="p-4 text-center">
                  <p className="text-sm text-neutral-500">
                    No results for "{searchQuery}"
                  </p>
                </div>
              ) : filteredHistory.length === 0 ? (
                <HistoryEmptyState onCreateNew={handleCreateNew} />
              ) : (
                <nav aria-label="Recent prompts list">
                  <ul className="space-y-1">
                    {filteredHistory.map((entry) => {
                      const modeInfo = modes.find((m) => m.id === entry.mode);
                      const ModeIcon = modeInfo?.icon || Sparkles;
                      return (
                        <li key={entry.id} className="stagger-item">
                          <button
                            onClick={() => loadFromHistory(entry)}
                            className="group w-full rounded-lg p-3 text-left transition-all duration-200 hover:bg-neutral-200 focus-ring hover-scale"
                            aria-label={`Load prompt: ${entry.input.substring(0, 50)}...`}
                          >
                            <div className="flex items-start gap-2">
                              <ModeIcon
                                className="mt-0.5 h-4 w-4 flex-shrink-0 text-neutral-400 group-hover:text-primary-600 transition-colors"
                                aria-hidden="true"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm text-neutral-900 font-medium">
                                  {entry.input}
                                </p>
                                <div className="mt-1 flex items-center gap-2 text-xs text-neutral-500">
                                  <time dateTime={entry.timestamp || ''}>
                                    {entry.timestamp ? new Date(entry.timestamp).toLocaleDateString() : 'No date'}
                                  </time>
                                  <span>•</span>
                                  <span className="badge-success badge px-1.5 py-0.5">
                                    {entry.score}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </nav>
              )}
            </div>

            {/* Auth Section */}
            <footer className="flex-shrink-0 border-t border-neutral-200 bg-neutral-100 p-3">
              {user ? (
                <div className="relative" ref={authMenuRef}>
                  <button
                    onClick={() => setShowAuthMenu(!showAuthMenu)}
                    className="flex w-full items-center gap-2 rounded-lg p-2 transition-all duration-200 hover:bg-neutral-200 focus-ring"
                    aria-expanded={showAuthMenu}
                    aria-label="User menu"
                  >
                    <img
                      src={user.photoURL}
                      alt=""
                      className="h-8 w-8 flex-shrink-0 rounded-full ring-2 ring-neutral-200"
                    />
                    <div className="min-w-0 flex-1 text-left">
                      <p className="truncate text-sm font-semibold text-neutral-900">
                        {user.displayName}
                      </p>
                      <p className="truncate text-xs text-neutral-600">
                        {user.email}
                      </p>
                    </div>
                  </button>

                  {showAuthMenu && (
                    <div className="dropdown-menu bottom-full mb-2 left-0 w-full">
                      <button
                        onClick={handleSignOut}
                        className="dropdown-item text-error-600"
                      >
                        <LogOut className="h-4 w-4 mr-2" />
                        <span>Sign out</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={handleSignIn}
                  className="btn-primary w-full hover-scale ripple"
                  aria-label="Sign in with Google"
                >
                  <LogIn className="h-4 w-4" />
                  <span className="text-sm font-semibold">Sign in with Google</span>
                </button>
              )}
            </footer>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main
        id="main-content"
        className={`flex h-screen flex-col items-center px-4 sm:px-6 py-8 transition-all duration-300 ${showHistory ? 'ml-72' : 'ml-0'} ${showResults ? 'justify-start' : 'justify-center overflow-y-auto'}`}
      >
        {/* Hero Section */}
        {!showResults && (
          <div className="mb-8 w-full max-w-4xl text-center animate-fade-in">
            <h1 className="mb-4 text-3xl sm:text-4xl md:text-5xl font-bold leading-tight text-neutral-900 text-balance">
              Turn messy thoughts into structured prompts
            </h1>
            <p className="mb-8 text-base sm:text-lg text-neutral-600">
              Idea to prompt in seconds - get much better results from{' '}
              <span className="inline-flex items-center font-semibold text-neutral-900">
                <span className="transition-opacity duration-300">
                  {aiNames[currentAIIndex]}
                </span>
              </span>
              <span className="ml-1 inline-block h-5 w-1 animate-pulse bg-primary-600"></span>
            </p>

            {/* Mode Selector - Horizontal Tabs */}
            <div className="mb-6">
              <ModeSelector
                modes={modes}
                selectedMode={selectedMode}
                onModeChange={setSelectedMode}
              />
            </div>

            {/* Main Input Section */}
            <div className="relative mb-8 w-full">
              <div className="card overflow-visible border border-neutral-200 transition-all duration-200 hover:shadow-md">
                <div className="p-4">
                  <label htmlFor="prompt-input" className="sr-only">
                    Enter your prompt idea
                  </label>
                  <textarea
                    id="prompt-input"
                    value={inputPrompt}
                    onChange={(e) => setInputPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        // For standard prompt mode, just Enter works
                        // For other modes, require Cmd/Ctrl+Enter
                        if (selectedMode === 'optimize' || e.metaKey || e.ctrlKey) {
                          e.preventDefault();
                          handleOptimize();
                        }
                      }
                    }}
                    placeholder="I want a prompt that will..."
                    rows={3}
                    className="w-full resize-none bg-transparent text-base text-neutral-900 placeholder-neutral-400 outline-none border-none focus:outline-none focus:ring-0 focus:border-none"
                    aria-label="Prompt input"
                  />
                </div>

                <div className="flex items-center justify-between border-t border-neutral-200 px-4 py-3 bg-white">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleImproveFirst}
                      disabled={!inputPrompt.trim() || isProcessing}
                      className="btn-secondary btn-sm hover-scale ripple"
                      aria-label="Improve prompt before optimizing"
                      title="Improve first (⌘I)"
                    >
                      <Zap className="h-4 w-4" />
                      <span className="hidden sm:inline">Improve First</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedMode === 'video' && (
                      <button
                        onClick={() => setShowBrainstorm(true)}
                        disabled={isProcessing}
                        className="btn-secondary btn-sm hover-scale ripple"
                        aria-label="Build video concept with guided workflow"
                        title="Build a video concept step-by-step"
                      >
                        <Lightbulb className="h-4 w-4" />
                        <span className="font-bold">Build Concept</span>
                      </button>
                    )}

                    <button
                      onClick={handleOptimize}
                      disabled={!inputPrompt.trim() || isProcessing}
                      className="btn-primary btn-sm hover-scale ripple"
                      aria-label="Optimize prompt"
                      title="Optimize (⌘Enter)"
                    >
                      <span className="font-bold">Optimize</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="mb-8">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {quickActions.map((action, idx) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => handleQuickAction(action)}
                      className="btn-ghost btn-sm border border-neutral-200 hover:border-primary-300 hover:bg-primary-50 hover-scale stagger-item"
                      style={{ animationDelay: `${idx * 50}ms` }}
                      aria-label={`Use ${action.label} template`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium">{action.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Processing State */}
        {isProcessing && (
          <div className="w-full max-w-6xl animate-fade-in">
            <div className="card-elevated p-12">
              <div className="flex flex-col items-center justify-center gap-4">
                <div className="loading-dots">
                  <div className="loading-dot bg-primary-400" style={{ animationDelay: '0ms' }} />
                  <div className="loading-dot bg-primary-500" style={{ animationDelay: '150ms' }} />
                  <div className="loading-dot bg-primary-600" style={{ animationDelay: '300ms' }} />
                </div>
                <p className="text-neutral-700 font-medium">
                  Optimizing your prompt...
                </p>
                <p className="text-sm text-neutral-500">
                  This usually takes a few seconds
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Results Section - Canvas Style */}
        {showResults && displayedPrompt && !isProcessing && (
          <div className="flex flex-col h-full w-full overflow-hidden animate-fade-in">
            {/* Your Input Container */}
            <div className="flex-shrink-0 w-full bg-gradient-to-r from-neutral-50 to-neutral-100 border-b-2 border-neutral-200 px-4 py-2">
              <div className="max-w-2xl mx-auto">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-primary-600" aria-hidden="true" />
                    <h3 className="text-sm font-semibold text-neutral-700 uppercase tracking-wide">
                      Your Input
                    </h3>
                  </div>
                  {!isEditingInput && (
                    <button
                      onClick={handleEdit}
                      className="btn-ghost btn-sm hover-scale"
                      aria-label="Edit input"
                      title="Edit your input"
                    >
                      <Edit className="h-3.5 w-3.5" />
                      <span className="text-xs">Edit</span>
                    </button>
                  )}
                </div>

                {isEditingInput ? (
                  <div className="space-y-3">
                    <textarea
                      value={editedInput}
                      onChange={(e) => setEditedInput(e.target.value)}
                      className="w-full resize-none bg-white border-2 border-primary-300 rounded-lg px-4 py-3 text-base text-neutral-900 leading-relaxed focus:border-primary-500 focus:ring focus:ring-primary-500 focus:ring-opacity-20 transition-colors"
                      rows={4}
                      autoFocus
                      placeholder="Enter your prompt..."
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSaveEdit}
                        className="btn-primary btn-sm hover-scale ripple"
                        disabled={!editedInput.trim()}
                      >
                        <Check className="h-4 w-4" />
                        <span>Save & Re-optimize</span>
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="btn-secondary btn-sm hover-scale"
                      >
                        <X className="h-4 w-4" />
                        <span>Cancel</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-base text-neutral-900 leading-relaxed">
                    {inputPrompt}
                  </p>
                )}
              </div>
            </div>

            {/* Canvas Toolbar - Now sticky under Your Input */}
            <div className="sticky top-0 z-10 flex-shrink-0 flex items-center justify-between px-4 py-2 border-b border-neutral-200 bg-neutral-50 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-neutral-600">{currentMode.name}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className={`btn-ghost btn-sm hover-scale ripple ${copied ? 'text-success-600' : ''}`}
                  aria-label={copied ? 'Prompt copied' : 'Copy prompt'}
                  title="Copy (⌘C)"
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">{copied ? 'Copied!' : 'Copy'}</span>
                </button>

                <div className="relative" ref={exportMenuRef}>
                  <button
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    className="btn-ghost btn-sm hover-scale"
                    aria-expanded={showExportMenu}
                    aria-label="Export menu"
                    title="Export"
                  >
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">Export</span>
                  </button>
                  {showExportMenu && (
                    <div className="dropdown-menu top-full mt-2 w-44 right-0">
                      <button
                        onClick={() => handleExport('text')}
                        className="dropdown-item"
                      >
                        <FileText className="h-4 w-4" />
                        Text (.txt)
                      </button>
                      <button
                        onClick={() => handleExport('markdown')}
                        className="dropdown-item"
                      >
                        <FileText className="h-4 w-4" />
                        Markdown (.md)
                      </button>
                      <button
                        onClick={() => handleExport('json')}
                        className="dropdown-item"
                      >
                        <FileText className="h-4 w-4" />
                        JSON (.json)
                      </button>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleCreateNew}
                  className="btn-primary btn-sm hover-scale ripple"
                  title="New prompt (⌘N)"
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">New</span>
                </button>
              </div>
            </div>

            {/* Canvas and Suggestions Container */}
            <div className="flex flex-1 items-start gap-0 overflow-hidden">
              {/* Canvas - Main Document */}
              <div className="flex-1 flex flex-col h-full bg-white border-r border-neutral-200 shadow-lg">
                {/* Canvas Document Content */}
                <div className="flex-1 overflow-y-auto">
                  <div className="max-w-2xl mx-auto px-4 py-4">
                  <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={(e) => {
                      setDisplayedPrompt(e.currentTarget.textContent);
                      setSkipAnimation(true);
                    }}
                    onMouseUp={(e) => {
                      const selection = window.getSelection();
                      let text = selection.toString().trim();

                      if (text.length > 0) {
                        // Remove leading dash and whitespace from bullet points for suggestions
                        const cleanedText = text.replace(/^-\s*/, '');
                        const range = selection.getRangeAt(0).cloneRange();
                        // Pass both cleaned text (for suggestions) and original text (for replacement)
                        fetchEnhancementSuggestions(cleanedText, text, displayedPrompt, range);
                      }
                    }}
                    className="w-full resize-none bg-transparent font-sans text-sm leading-loose text-neutral-900 outline-none border-0 focus:outline-none"
                    style={{
                      minHeight: 'calc(100vh - 200px)',
                      lineHeight: '1.8',
                      wordBreak: 'break-word',
                      overflowWrap: 'break-word',
                      whiteSpace: 'pre-wrap',
                      paddingLeft: '3em',
                      textIndent: '-3em'
                    }}
                    role="textbox"
                    aria-label="Optimized prompt (editable)"
                    aria-multiline="true"
                  >
                    {!displayedPrompt && <span className="text-neutral-400">Your optimized prompt will appear here...</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Side - Suggestions Panel */}
            <SuggestionsPanel suggestionsData={suggestionsData} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// Main export with ToastProvider wrapper
export default function ModernPromptOptimizer() {
  return (
    <ToastProvider>
      <ModernPromptOptimizerContent />
    </ToastProvider>
  );
}
