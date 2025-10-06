import React, { useState, useEffect } from 'react';
import { Sparkles, Search, FileText, Lightbulb, User, ArrowRight, ChevronDown, Copy, Check, Download, Clock, X, GraduationCap, Edit, Menu, Shuffle } from 'lucide-react';

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

  const aiNames = ['Claude AI', 'ChatGPT', 'Gemini'];

  const modes = [
    { id: 'optimize', name: 'Standard Prompt', icon: Sparkles, description: 'Optimize any prompt' },
    { id: 'reasoning', name: 'Reasoning Prompt', icon: Lightbulb, description: 'Deep thinking & verification' },
    { id: 'research', name: 'Deep Research', icon: Search, description: 'Create research plans' },
    { id: 'socratic', name: 'Socratic Learning', icon: GraduationCap, description: 'Learning journeys' }
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
    'create a content strategy for a blog'
  ];

  const quickActions = [
    {
      label: 'Research a topic',
      icon: Search,
      mode: 'research',
      prompt: 'impact of AI on healthcare'
    },
    {
      label: 'Analyze data',
      icon: FileText,
      mode: 'optimize',
      prompt: 'analyze customer feedback data and identify trends'
    },
    {
      label: 'Draft a document',
      icon: FileText,
      mode: 'optimize',
      prompt: 'write a business plan for a coffee shop'
    },
    {
      label: 'Brainstorm ideas',
      icon: Lightbulb,
      mode: 'optimize',
      prompt: 'brainstorm innovative product ideas for sustainable living'
    },
    {
      label: 'Learn something',
      icon: GraduationCap,
      mode: 'socratic',
      prompt: 'quantum computing basics'
    },
    {
      label: 'Random prompt',
      icon: Shuffle,
      mode: 'optimize',
      prompt: 'random'
    }
  ];

  // Load history from localStorage on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('promptHistory');
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    }
  }, []);

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
  }, [optimizedPrompt, showResults]);

  const saveToHistory = (input, output, score) => {
    const newEntry = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      input,
      output,
      score,
      mode: selectedMode
    };
    const updatedHistory = [newEntry, ...history].slice(0, 10);
    setHistory(updatedHistory);
    localStorage.setItem('promptHistory', JSON.stringify(updatedHistory));
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

  const analyzeAndOptimize = async (prompt) => {
    console.log('AI mode is ON - calling Claude API...');
    console.log('Mode:', selectedMode);

    try {
      console.log('Sending request to http://localhost:3001/api/optimize');
      const response = await fetch('http://localhost:3001/api/optimize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: prompt,
          mode: selectedMode
        })
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

  const handleOptimize = async () => {
    if (!inputPrompt.trim()) return;

    setIsProcessing(true);
    setOptimizedPrompt('');
    setDisplayedPrompt('');
    setQualityScore(null);

    try {
      const optimized = await analyzeAndOptimize(inputPrompt);
      console.log('📝 Received optimized prompt:', optimized);

      const score = calculateQualityScore(inputPrompt, optimized);
      console.log('📊 Quality score:', score);

      setOptimizedPrompt(optimized);
      setQualityScore(score);
      saveToHistory(inputPrompt, optimized, score);
      setShowResults(true);
      setShowHistory(false);
    } catch (error) {
      console.error('Optimization failed:', error);
      alert('Failed to optimize prompt. Please make sure the server is running.');
    } finally {
      setIsProcessing(false);
    }
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
    navigator.clipboard.writeText(optimizedPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = (format) => {
    let content = '';
    const timestamp = new Date().toLocaleString();

    if (format === 'markdown') {
      content = `# Prompt Optimization\n\n**Date:** ${timestamp}\n\n## Original Prompt\n${inputPrompt}\n\n## Optimized Prompt\n${optimizedPrompt}`;
    } else if (format === 'json') {
      content = JSON.stringify({
        timestamp,
        original: inputPrompt,
        optimized: optimizedPrompt,
        qualityScore,
        mode: selectedMode
      }, null, 2);
    } else {
      content = `PROMPT OPTIMIZATION\nDate: ${timestamp}\n\n=== ORIGINAL ===\n${inputPrompt}\n\n=== OPTIMIZED ===\n${optimizedPrompt}`;
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
  };

  const loadFromHistory = (entry) => {
    setInputPrompt(entry.input);
    setOptimizedPrompt(entry.output);
    setDisplayedPrompt(entry.output);
    setQualityScore(entry.score);
    setSelectedMode(entry.mode);
    setShowHistory(false);
    setShowResults(true);
  };

  const getModeInfo = () => {
    return modes.find(m => m.id === selectedMode) || modes[0];
  };

  const currentMode = getModeInfo();
  const ModeIcon = currentMode.icon;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex">
      {/* Hamburger Menu Button - Fixed Position */}
      <button
        onClick={() => setShowHistory(!showHistory)}
        className="fixed top-6 left-6 z-50 p-3 bg-white hover:bg-gray-100 rounded-lg shadow-lg border border-gray-200 transition-colors"
      >
        <Menu className="w-5 h-5 text-gray-700" />
      </button>

      {/* Left Sidebar - History */}
      <div className={`${showHistory ? 'w-64' : 'w-0'} transition-all duration-300 bg-white border-r border-gray-200 flex flex-col overflow-hidden`}>
        {showHistory && (
          <>
            <div className="p-4 pt-20 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Recent</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {history.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-400">
                  No history yet
                </div>
              ) : (
                <div className="space-y-1">
                  {history.map((entry) => {
                    const modeInfo = modes.find(m => m.id === entry.mode);
                    const ModeIcon = modeInfo?.icon || Sparkles;
                    return (
                      <button
                        key={entry.id}
                        onClick={() => loadFromHistory(entry)}
                        className="w-full text-left p-3 hover:bg-gray-100 rounded-lg transition-colors group"
                      >
                        <div className="flex items-start gap-2">
                          <ModeIcon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900 truncate">{entry.input}</p>
                            <div className="flex items-center gap-2 mt-1">
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
          </>
        )}
      </div>

      {/* Main Content */}
      <div className={`flex-1 flex flex-col items-center justify-center px-6 py-8 overflow-y-auto ${showHistory ? 'ml-0' : 'ml-0'}`}>
      {/* Hero Section */}
      <div className="max-w-3xl w-full text-center mb-8">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 leading-tight">
          Turn messy thoughts into structured prompts
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          Idea to prompt in seconds - get much better results from{' '}
          <span className="font-semibold text-gray-900 inline-flex items-center">
            <span className="transition-opacity duration-300">
              {aiNames[currentAIIndex]}
            </span>
          </span>
          <span className="inline-block w-1 h-5 bg-gray-900 ml-1 animate-pulse"></span>
        </p>

        {/* Main Input Section */}
        <div className="relative mb-6">
          <div className="bg-white rounded-xl shadow-md border-2 border-gray-200 focus-within:border-gray-400 transition-all overflow-visible">
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
                className="w-full text-base text-gray-900 placeholder-gray-400 outline-none bg-transparent resize-none"
              />
            </div>

            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <div className="relative">
                <button
                  onClick={() => setShowModeDropdown(!showModeDropdown)}
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <ModeIcon className="w-4 h-4" />
                  <span className="font-medium">{currentMode.name}</span>
                  <ChevronDown className="w-4 h-4" />
                </button>

                {showModeDropdown && (
                  <div className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-200 py-2 min-w-64 z-50">
                    {modes.map((mode) => {
                      const Icon = mode.icon;
                      return (
                        <button
                          key={mode.id}
                          onClick={() => {
                            setSelectedMode(mode.id);
                            setShowModeDropdown(false);
                          }}
                          className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                        >
                          <Icon className="w-5 h-5 text-gray-600 mt-0.5" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">{mode.name}</div>
                            <div className="text-xs text-gray-500">{mode.description}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <button
                onClick={handleOptimize}
                disabled={!inputPrompt.trim() || isProcessing}
                className="bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 text-white rounded-full p-2 transition-all duration-200 transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                onClick={() => handleQuickAction(action)}
                className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 border border-gray-200 hover:border-gray-300 rounded-full transition-all duration-200 transform hover:scale-105"
              >
                <Icon className="w-3 h-3 text-gray-600" />
                <span className="text-xs font-medium text-gray-700">{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Processing State */}
      {isProcessing && (
        <div className="max-w-4xl w-full">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-12">
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-3 h-3 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-3 h-3 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
              <p className="text-gray-600">Optimizing your prompt...</p>
            </div>
          </div>
        </div>
      )}

      {/* Results Section - Shows after optimization */}
      {showResults && displayedPrompt && !isProcessing && (
        <div className="max-w-3xl w-full mt-8">
          {/* Lazy Prompt Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-bold text-gray-900">Lazy Prompt</h2>
              <button
                onClick={handleEdit}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Edit className="w-4 h-4" />
                <span className="text-sm font-semibold">Edit</span>
              </button>
            </div>
            <div className="bg-white rounded-xl border-4 border-gray-900 p-5">
              <p className="text-gray-800 text-base leading-relaxed">{inputPrompt}</p>
            </div>
          </div>

          {/* Reasoning Prompt Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-bold text-gray-900">Reasoning Prompt</h2>
              <button
                onClick={handleCopy}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span className="text-sm font-semibold">{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
            <div className="bg-white rounded-xl border-4 border-gray-900 p-5">
              <pre className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap font-sans">
                {displayedPrompt}
              </pre>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between mt-6">
              <div className="flex gap-3">
                <button
                  onClick={handleCreateNew}
                  className="px-5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition-colors font-semibold"
                >
                  Create New
                </button>

                <div className="relative group">
                  <button className="flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-gray-50 text-gray-700 border-2 border-gray-300 rounded-lg transition-colors font-semibold">
                    <Download className="w-4 h-4" />
                    Export
                  </button>
                  <div className="absolute left-0 bottom-full mb-2 w-44 bg-white rounded-lg shadow-xl border-2 border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                    <button
                      onClick={() => handleExport('text')}
                      className="w-full px-4 py-2.5 text-left text-sm font-medium hover:bg-gray-50 rounded-t-lg transition-colors"
                    >
                      Text (.txt)
                    </button>
                    <button
                      onClick={() => handleExport('markdown')}
                      className="w-full px-4 py-2.5 text-left text-sm font-medium hover:bg-gray-50 transition-colors"
                    >
                      Markdown (.md)
                    </button>
                    <button
                      onClick={() => handleExport('json')}
                      className="w-full px-4 py-2.5 text-left text-sm font-medium hover:bg-gray-50 rounded-b-lg transition-colors"
                    >
                      JSON (.json)
                    </button>
                  </div>
                </div>
              </div>

              {qualityScore !== null && (
                <div className="flex items-center gap-3 bg-gray-900 text-white px-4 py-2.5 rounded-lg">
                  <span className="text-sm font-semibold">Quality Score:</span>
                  <span className="text-xl font-bold">{qualityScore}%</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
