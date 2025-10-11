import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Search,
  FileText,
  Lightbulb,
  User,
  ArrowRight,
  ChevronDown,
  Copy,
  Check,
  Download,
  Clock,
  X,
  GraduationCap,
  Edit,
  Menu,
  Shuffle,
  LogIn,
  LogOut,
  PanelLeft,
  Plus,
  Video,
} from 'lucide-react';
import {
  auth,
  signInWithGoogle,
  signOutUser,
  savePromptToFirestore,
  getUserPrompts,
} from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import PromptImprovementForm from './PromptImprovementForm';
import PromptEnhancementEditor, {
  SuggestionsPanel,
} from './components/PromptEnhancementEditor';
import CreativeBrainstorm from './components/CreativeBrainstorm';

export default function ModernPromptOptimizer() {
  const [inputPrompt, setInputPrompt] = useState('');
  const [selectedMode, setSelectedMode] = useState('optimize');
  const [showModeDropdown, setShowModeDropdown] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [optimizedPrompt, setOptimizedPrompt] = useState('');
  const [displayedPrompt, setDisplayedPrompt] = useState('');
  const [copied, setCopied] = useState(false);
  const [qualityScore, setQualityScore] = useState(null);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(true); // Default to open
  const [showResults, setShowResults] = useState(false);
  const [currentAIIndex, setCurrentAIIndex] = useState(0);
  const [skipAnimation, setSkipAnimation] = useState(false);

  // Auth state
  const [user, setUser] = useState(null);
  const [showAuthMenu, setShowAuthMenu] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Prompt improvement state
  const [showImprover, setShowImprover] = useState(false);
  const [improvementContext, setImprovementContext] = useState(null);

  // Enhancement suggestions state
  const [suggestionsData, setSuggestionsData] = useState(null);

  // Creative brainstorm state
  const [showBrainstorm, setShowBrainstorm] = useState(false);
  const [conceptElements, setConceptElements] = useState(null);

  // Refs for click-outside detection
  const modeDropdownRef = useRef(null);
  const authMenuRef = useRef(null);

  const aiNames = ['Claude AI', 'ChatGPT', 'Gemini'];

  const modes = [
    {
      id: 'optimize',
      name: 'Standard Prompt',
      icon: Sparkles,
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

  const quickActions = [
    {
      label: 'Research a topic',
      icon: Search,
      mode: 'research',
      prompt: 'impact of AI on healthcare',
    },
    {
      label: 'Analyze data',
      icon: FileText,
      mode: 'optimize',
      prompt: 'analyze customer feedback data and identify trends',
    },
    {
      label: 'Draft a document',
      icon: FileText,
      mode: 'optimize',
      prompt: 'write a business plan for a coffee shop',
    },
    {
      label: 'Brainstorm ideas',
      icon: Lightbulb,
      mode: 'optimize',
      prompt: 'brainstorm innovative product ideas for sustainable living',
    },
    {
      label: 'Learn something',
      icon: GraduationCap,
      mode: 'socratic',
      prompt: 'quantum computing basics',
    },
    {
      label: 'Random prompt',
      icon: Shuffle,
      mode: 'optimize',
      prompt: 'random',
    },
  ];

  // Handle clicks outside dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        modeDropdownRef.current &&
        !modeDropdownRef.current.contains(event.target)
      ) {
        setShowModeDropdown(false);
      }
      if (authMenuRef.current && !authMenuRef.current.contains(event.target)) {
        setShowAuthMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Load localStorage history on mount (for non-logged-in users)
  useEffect(() => {
    const savedHistory = localStorage.getItem('promptHistory');
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    }
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Load history from Firestore when user logs in
        await loadHistoryFromFirestore(currentUser.uid);
      } else {
        // Load from localStorage when logged out
        const savedHistory = localStorage.getItem('promptHistory');
        if (savedHistory) {
          setHistory(JSON.parse(savedHistory));
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Load history from Firestore
  const loadHistoryFromFirestore = async (userId) => {
    setIsLoadingHistory(true);
    try {
      const prompts = await getUserPrompts(userId, 10);
      setHistory(prompts);
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Cycle through AI names
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentAIIndex((prev) => (prev + 1) % aiNames.length);
    }, 3000); // Change every 3 seconds

    return () => clearInterval(interval);
  }, [aiNames.length]);

  // Lazy loading effect - typewriter animation (only on results page)
  useEffect(() => {
    if (!optimizedPrompt || !showResults) {
      setDisplayedPrompt('');
      return;
    }

    // Skip animation if loading from history
    if (skipAnimation) {
      setDisplayedPrompt(optimizedPrompt);
      return;
    }

    setDisplayedPrompt('');
    let currentIndex = 0;

    const intervalId = setInterval(() => {
      if (currentIndex <= optimizedPrompt.length) {
        setDisplayedPrompt(optimizedPrompt.slice(0, currentIndex));
        currentIndex += 3;
      } else {
        clearInterval(intervalId);
      }
    }, 5);

    return () => clearInterval(intervalId);
  }, [optimizedPrompt, showResults, skipAnimation]);

  // Handle Google Sign In
  const handleSignIn = async () => {
    try {
      const user = await signInWithGoogle();
      console.log('Signed in as:', user.email);
    } catch (error) {
      console.error('Sign in failed:', error);
      alert('Failed to sign in. Please try again.');
    }
  };

  // Handle Sign Out
  const handleSignOut = async () => {
    try {
      await signOutUser();
      setHistory([]);
      console.log('Signed out successfully');
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  const saveToHistory = async (input, output, score) => {
    console.log('💾 saveToHistory called with:', {
      input: input?.substring(0, 50),
      output: output?.substring(0, 50),
      score,
      mode: selectedMode,
    });

    const newEntry = {
      input,
      output,
      score,
      mode: selectedMode,
    };

    if (user) {
      // Save to Firestore if logged in
      console.log('💾 User logged in, saving to Firestore...');
      try {
        const docId = await savePromptToFirestore(user.uid, newEntry);
        const entryWithId = {
          id: docId,
          timestamp: new Date().toISOString(),
          ...newEntry,
        };
        console.log('✅ Saved to Firestore, updating history state...');
        setHistory((prevHistory) => [entryWithId, ...prevHistory].slice(0, 10));
      } catch (error) {
        console.error('❌ Error saving to Firestore:', error);
      }
    } else {
      // Save to localStorage if not logged in
      console.log('💾 No user, saving to localStorage...');
      const entryWithLocalId = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        ...newEntry,
      };
      setHistory((prevHistory) => {
        const updatedHistory = [entryWithLocalId, ...prevHistory].slice(0, 10);
        console.log(
          '✅ Updating history state with:',
          updatedHistory.length,
          'items'
        );
        localStorage.setItem('promptHistory', JSON.stringify(updatedHistory));
        console.log('✅ Saved to localStorage');
        return updatedHistory;
      });
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
    if (output.includes('Return Format') || output.includes('Research'))
      score += 15;
    if (output.includes('Context') || output.includes('Learning')) score += 15;

    return Math.min(score, 100);
  };

  const analyzeAndOptimize = async (prompt, context = null) => {
    console.log('AI mode is ON - calling Claude API...');
    console.log('Mode:', selectedMode);

    try {
      console.log('Sending request to http://localhost:3001/api/optimize');
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

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('API Error Response:', errorData);
        throw new Error(errorData.error || 'API request failed');
      }

      const data = await response.json();
      console.log('✅ Successfully received AI-optimized prompt');
      return data.optimizedPrompt;
    } catch (error) {
      console.error('❌ Error calling Claude API:', error);
      throw error;
    }
  };

  const handleImproveFirst = () => {
    if (!inputPrompt.trim()) return;
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
    // Show brainstorm for video mode if elements not defined and no input
    if (selectedMode === 'video' && !conceptElements && !inputPrompt.trim()) {
      setShowBrainstorm(true);
      return;
    }

    if (!promptToOptimize.trim()) return;

    setIsProcessing(true);
    setOptimizedPrompt('');
    setDisplayedPrompt('');
    setQualityScore(null);
    setSkipAnimation(false); // Enable animation for new optimizations

    try {
      const optimized = await analyzeAndOptimize(promptToOptimize, context);
      console.log('📝 Received optimized prompt:', optimized);

      const score = calculateQualityScore(promptToOptimize, optimized);
      console.log('📊 Quality score:', score);

      setOptimizedPrompt(optimized);
      setQualityScore(score);
      saveToHistory(promptToOptimize, optimized, score);
      setShowResults(true);
      setShowHistory(true);
    } catch (error) {
      console.error('Optimization failed:', error);
      alert(
        'Failed to optimize prompt. Please make sure the server is running.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConceptComplete = async (finalConcept, elements) => {
    setConceptElements(elements);
    setInputPrompt(finalConcept);
    setShowBrainstorm(false);

    // Use the same logic as handleOptimize
    setTimeout(async () => {
      setIsProcessing(true);
      setOptimizedPrompt('');
      setDisplayedPrompt('');
      setQualityScore(null);
      setSkipAnimation(false);

      try {
        const optimized = await analyzeAndOptimize(finalConcept);
        console.log('📝 Received optimized prompt:', optimized);

        const score = calculateQualityScore(finalConcept, optimized);
        console.log('📊 Quality score:', score);

        setOptimizedPrompt(optimized);
        setQualityScore(score);
        saveToHistory(finalConcept, optimized, score);
        setShowResults(true);
        setShowHistory(true);
      } catch (error) {
        console.error('Optimization failed:', error);
        alert(
          'Failed to optimize prompt. Please make sure the server is running.'
        );
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
    // Copy the displayed (possibly edited) version
    navigator.clipboard.writeText(displayedPrompt);
    setCopied(true);
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
  };

  const handleEdit = () => {
    setShowResults(false);
  };

  const handleCreateNew = () => {
    setInputPrompt('');
    setOptimizedPrompt('');
    setDisplayedPrompt('');
    setQualityScore(null);
    setShowResults(false);
    setSuggestionsData(null);
  };

  // Debounce timer ref for preventing rapid-fire requests
  const debounceTimerRef = useRef(null);
  const lastRequestRef = useRef(null);

  // Fetch enhancement suggestions for selected text
  const fetchEnhancementSuggestions = async (
    highlightedText,
    fullPrompt,
    selectionRange
  ) => {
    // Clear any existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Prevent duplicate requests for the same text
    if (
      suggestionsData?.selectedText === highlightedText &&
      suggestionsData?.show
    ) {
      console.log('🚫 Skipping duplicate request for:', highlightedText);
      return;
    }

    // Prevent rapid-fire requests (debounce 300ms)
    debounceTimerRef.current = setTimeout(async () => {
      // Double-check the selection hasn't changed
      const currentSelection = window.getSelection().toString().trim();
      if (currentSelection !== highlightedText) {
        console.log('🚫 Selection changed, ignoring stale request');
        return;
      }

      // Store this request to prevent duplicates
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
            highlightedText,
            suggestionText
          );
          setOptimizedPrompt(updatedPrompt);
          setDisplayedPrompt(updatedPrompt);
          setSuggestionsData(null);
          window.getSelection().removeAllRanges();
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

        // Update with fetched suggestions
        setSuggestionsData({
          show: true,
          selectedText: highlightedText,
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
              highlightedText,
              suggestionText
            );
            setOptimizedPrompt(updatedPrompt);
            setDisplayedPrompt(updatedPrompt);
            setSuggestionsData(null);
            window.getSelection().removeAllRanges();
          },
          onClose: () => {
            setSuggestionsData(null);
            window.getSelection().removeAllRanges();
          },
        });
      } catch (error) {
        console.error('Error fetching suggestions:', error);
        setSuggestionsData({
          show: true,
          selectedText: highlightedText,
          suggestions: [
            { text: 'Failed to load suggestions. Please try again.' },
          ],
          isLoading: false,
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
          onSuggestionClick: () => {
            setSuggestionsData(null);
          },
          onClose: () => {
            setSuggestionsData(null);
            window.getSelection().removeAllRanges();
          },
        });
      }
    }, 300); // 300ms debounce delay
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

  const getModeInfo = () => {
    return modes.find((m) => m.id === selectedMode) || modes[0];
  };

  const currentMode = getModeInfo();
  const ModeIcon = currentMode.icon;

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-b from-gray-50 to-white">
      {/* Creative Brainstorm Modal */}
      {showBrainstorm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="relative max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-gray-50">
            <button
              onClick={handleSkipBrainstorm}
              className="absolute right-4 top-4 z-10 text-sm text-gray-600 underline hover:text-gray-900"
            >
              Skip to Advanced Mode →
            </button>
            <div className="p-6">
              <CreativeBrainstorm
                onConceptComplete={handleConceptComplete}
                initialConcept={inputPrompt}
              />
            </div>
          </div>
        </div>
      )}

      {/* Improvement Form Modal Overlay */}
      {showImprover && (
        <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black bg-opacity-50 p-4">
          <div className="my-8 w-full max-w-3xl">
            <button
              onClick={() => setShowImprover(false)}
              className="mb-4 flex items-center gap-2 font-medium text-white hover:text-gray-200"
            >
              <X className="h-5 w-5" />
              Close
            </button>
            <PromptImprovementForm
              initialPrompt={inputPrompt}
              onComplete={handleImprovementComplete}
            />
          </div>
        </div>
      )}

      {/* Sidebar Menu and New Chat Buttons - Fixed Position */}
      <div className="fixed left-6 top-6 z-50 flex items-center gap-2">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg transition-colors hover:bg-gray-100"
        >
          <PanelLeft className="h-5 w-5 text-gray-700" />
        </button>
        <button
          onClick={handleCreateNew}
          className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg transition-colors hover:bg-gray-100"
        >
          <Plus className="h-5 w-5 text-gray-700" />
        </button>
      </div>

      {/* Left Sidebar - History */}
      <div
        className={`${showHistory ? 'w-64' : 'w-0'} fixed left-0 top-0 z-40 h-screen max-h-screen overflow-hidden border-r border-gray-200 bg-white transition-all duration-300`}
      >
        {showHistory && (
          <div className="flex h-screen max-h-screen flex-col overflow-hidden">
            <div className="flex-shrink-0 border-b border-gray-200 p-4 pt-20">
              <h3 className="font-semibold text-gray-900">Recent</h3>
              {!user && (
                <p className="mt-1 text-xs text-gray-500">
                  Sign in to sync across devices
                </p>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-2">
              {isLoadingHistory ? (
                <div className="p-4 text-center text-sm text-gray-400">
                  Loading...
                </div>
              ) : history.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-400">
                  No history yet
                </div>
              ) : (
                <div className="space-y-1">
                  {history.map((entry) => {
                    const modeInfo = modes.find((m) => m.id === entry.mode);
                    const ModeIcon = modeInfo?.icon || Sparkles;
                    return (
                      <button
                        key={entry.id}
                        onClick={() => loadFromHistory(entry)}
                        className="group w-full rounded-lg p-3 text-left transition-colors hover:bg-gray-100"
                      >
                        <div className="flex items-start gap-2">
                          <ModeIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-gray-900">
                              {entry.input}
                            </p>
                            <div className="mt-1 flex items-center gap-2">
                              <span className="text-xs text-gray-400">
                                {new Date(entry.timestamp).toLocaleDateString()}
                              </span>
                              <span className="text-xs text-gray-400">•</span>
                              <span className="text-xs text-gray-400">
                                {entry.score}%
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Auth Section at bottom of sidebar */}
            <div className="flex-shrink-0 border-t border-gray-200 bg-white p-3">
              {user ? (
                <div className="relative" ref={authMenuRef}>
                  <button
                    onClick={() => setShowAuthMenu(!showAuthMenu)}
                    className="flex w-full items-center gap-2 rounded-lg p-2 transition-colors hover:bg-gray-100"
                  >
                    <img
                      src={user.photoURL}
                      alt={user.displayName}
                      className="h-8 w-8 flex-shrink-0 rounded-full"
                    />
                    <div className="min-w-0 flex-1 text-left">
                      <p className="truncate text-sm font-semibold text-gray-900">
                        {user.displayName}
                      </p>
                      <p className="truncate text-xs text-gray-500">
                        {user.email}
                      </p>
                    </div>
                    <ChevronDown className="h-4 w-4 flex-shrink-0 text-gray-700" />
                  </button>

                  {showAuthMenu && (
                    <div className="absolute bottom-full left-0 mb-2 w-full rounded-lg border border-gray-200 bg-white py-1 shadow-xl">
                      <button
                        onClick={handleSignOut}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-gray-50"
                      >
                        <LogOut className="h-4 w-4 text-gray-600" />
                        <span className="text-sm text-gray-700">Sign out</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={handleSignIn}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-white transition-colors hover:bg-gray-800"
                >
                  <LogIn className="h-4 w-4" />
                  <span className="text-sm font-semibold">
                    Sign in with Google
                  </span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div
        className={`flex h-screen flex-col items-center px-6 py-8 transition-all duration-300 ${showHistory ? 'ml-64' : 'ml-0'} ${showResults ? 'justify-start' : 'justify-center overflow-y-auto'}`}
      >
        {/* Hero Section - Only show when NOT showing results */}
        {!showResults && (
          <div className="mb-8 w-full max-w-3xl text-center">
            <h1 className="mb-4 text-4xl font-bold leading-tight text-gray-900 md:text-5xl">
              Turn messy thoughts into structured prompts
            </h1>
            <p className="mb-8 text-lg text-gray-600">
              Idea to prompt in seconds - get much better results from{' '}
              <span className="inline-flex items-center font-semibold text-gray-900">
                <span className="transition-opacity duration-300">
                  {aiNames[currentAIIndex]}
                </span>
              </span>
              <span className="ml-1 inline-block h-5 w-1 animate-pulse bg-gray-900"></span>
            </p>

            {/* Main Input Section */}
            <div className="relative mb-6">
              <div className="overflow-visible rounded-xl border-2 border-gray-200 bg-white shadow-md transition-all focus-within:border-gray-400">
                <div className="p-4">
                  <textarea
                    value={inputPrompt}
                    onChange={(e) => setInputPrompt(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleOptimize();
                      }
                    }}
                    placeholder="I want a prompt that will..."
                    rows={2}
                    className="w-full resize-none bg-transparent text-base text-gray-900 placeholder-gray-400 outline-none"
                  />
                </div>

                <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
                  <div className="relative" ref={modeDropdownRef}>
                    <button
                      onClick={() => setShowModeDropdown(!showModeDropdown)}
                      className="flex items-center gap-2 text-sm text-gray-600 transition-colors hover:text-gray-900"
                    >
                      <ModeIcon className="h-4 w-4" />
                      <span className="font-medium">{currentMode.name}</span>
                      <ChevronDown className="h-4 w-4" />
                    </button>

                    {showModeDropdown && (
                      <div className="absolute left-0 top-full z-50 mt-2 min-w-64 rounded-xl border border-gray-200 bg-white py-2 shadow-xl">
                        {modes.map((mode) => {
                          const Icon = mode.icon;
                          return (
                            <button
                              key={mode.id}
                              onClick={() => {
                                setSelectedMode(mode.id);
                                setShowModeDropdown(false);
                              }}
                              className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50"
                            >
                              <Icon className="mt-0.5 h-5 w-5 text-gray-600" />
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {mode.name}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {mode.description}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleImproveFirst}
                      disabled={!inputPrompt.trim() || isProcessing}
                      className="flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                    >
                      <Sparkles className="h-4 w-4" />
                      Improve First
                    </button>
                    <button
                      onClick={handleOptimize}
                      disabled={
                        (!inputPrompt.trim() && selectedMode !== 'video') ||
                        isProcessing
                      }
                      className="transform rounded-full bg-gray-900 p-2 text-white transition-all duration-200 hover:scale-105 hover:bg-gray-800 disabled:scale-100 disabled:cursor-not-allowed disabled:bg-gray-300"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="mb-8 flex flex-wrap justify-center gap-2">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.label}
                    onClick={() => handleQuickAction(action)}
                    className="flex transform items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 transition-all duration-200 hover:scale-105 hover:border-gray-300 hover:bg-gray-50"
                  >
                    <Icon className="h-3 w-3 text-gray-600" />
                    <span className="text-xs font-medium text-gray-700">
                      {action.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Processing State */}
        {isProcessing && (
          <div className="w-full max-w-6xl">
            <div className="rounded-2xl border border-gray-200 bg-white p-12 shadow-lg">
              <div className="flex flex-col items-center justify-center gap-4">
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 animate-bounce rounded-full bg-gray-400"
                    style={{ animationDelay: '0ms' }}
                  ></div>
                  <div
                    className="h-3 w-3 animate-bounce rounded-full bg-gray-400"
                    style={{ animationDelay: '150ms' }}
                  ></div>
                  <div
                    className="h-3 w-3 animate-bounce rounded-full bg-gray-400"
                    style={{ animationDelay: '300ms' }}
                  ></div>
                </div>
                <p className="text-gray-600">Optimizing your prompt...</p>
              </div>
            </div>
          </div>
        )}

        {/* Results Section - Shows after optimization */}
        {showResults && displayedPrompt && !isProcessing && (
          <div className="mt-8 flex h-full w-full max-w-7xl items-start gap-6 overflow-y-auto pb-8">
            {/* Main Content Column */}
            <div className="max-w-4xl flex-1">
              {/* Lazy Prompt Section */}
              <div className="mb-6">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">
                    Lazy Prompt
                  </h2>
                  <button
                    onClick={handleEdit}
                    className="flex items-center gap-2 rounded-lg px-4 py-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
                  >
                    <Edit className="h-4 w-4" />
                    <span className="text-sm font-semibold">Edit</span>
                  </button>
                </div>
                <div className="rounded-xl border-4 border-gray-900 bg-white p-5">
                  <p className="text-base leading-relaxed text-gray-800">
                    {inputPrompt}
                  </p>
                </div>
              </div>

              {/* Reasoning Prompt Section */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">
                    Reasoning Prompt
                  </h2>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-2 rounded-lg px-4 py-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
                  >
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    <span className="text-sm font-semibold">
                      {copied ? 'Copied!' : 'Copy'}
                    </span>
                  </button>
                </div>
                <div className="rounded-xl border-4 border-gray-900 bg-white p-5">
                  <textarea
                    value={displayedPrompt}
                    onChange={(e) => {
                      // Only update displayedPrompt when user edits
                      // Don't update optimizedPrompt to avoid triggering typewriter effect
                      setDisplayedPrompt(e.target.value);
                      setSkipAnimation(true); // Disable animation for manual edits
                    }}
                    onMouseUp={(e) => {
                      // Handle text selection for AI suggestions
                      const selection = window.getSelection();
                      const text = selection.toString().trim();

                      if (text.length > 0) {
                        // Create a synthetic event for the PromptEnhancementEditor logic
                        const range = selection.getRangeAt(0).cloneRange();

                        // Fetch AI suggestions
                        fetchEnhancementSuggestions(
                          text,
                          displayedPrompt,
                          range
                        );
                      }
                    }}
                    className="w-full resize-none bg-transparent font-sans text-sm leading-relaxed text-gray-800 outline-none"
                    style={{
                      minHeight: '400px',
                      fontFamily:
                        'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                    }}
                  />
                </div>

                {/* Action Buttons */}
                <div className="mt-6 flex items-center justify-between">
                  <div className="flex gap-3">
                    <button
                      onClick={handleCreateNew}
                      className="rounded-lg bg-gray-900 px-5 py-2.5 font-semibold text-white transition-colors hover:bg-gray-800"
                    >
                      Create New
                    </button>

                    <div className="group relative">
                      <button className="flex items-center gap-2 rounded-lg border-2 border-gray-300 bg-white px-5 py-2.5 font-semibold text-gray-700 transition-colors hover:bg-gray-50">
                        <Download className="h-4 w-4" />
                        Export
                      </button>
                      <div className="invisible absolute bottom-full left-0 z-10 mb-2 w-44 rounded-lg border-2 border-gray-200 bg-white opacity-0 shadow-xl transition-all group-hover:visible group-hover:opacity-100">
                        <button
                          onClick={() => handleExport('text')}
                          className="w-full rounded-t-lg px-4 py-2.5 text-left text-sm font-medium transition-colors hover:bg-gray-50"
                        >
                          Text (.txt)
                        </button>
                        <button
                          onClick={() => handleExport('markdown')}
                          className="w-full px-4 py-2.5 text-left text-sm font-medium transition-colors hover:bg-gray-50"
                        >
                          Markdown (.md)
                        </button>
                        <button
                          onClick={() => handleExport('json')}
                          className="w-full rounded-b-lg px-4 py-2.5 text-left text-sm font-medium transition-colors hover:bg-gray-50"
                        >
                          JSON (.json)
                        </button>
                      </div>
                    </div>
                  </div>

                  {qualityScore !== null && (
                    <div className="flex items-center gap-3 rounded-lg bg-gray-900 px-4 py-2.5 text-white">
                      <span className="text-sm font-semibold">
                        Quality Score:
                      </span>
                      <span className="text-xl font-bold">{qualityScore}%</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Side - Suggestions Panel */}
            <SuggestionsPanel suggestionsData={suggestionsData} />
          </div>
        )}
      </div>
    </div>
  );
}
