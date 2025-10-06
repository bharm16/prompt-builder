import React, { useState, useEffect } from 'react';
import { Sparkles, Search, FileText, Lightbulb, User, ArrowRight, ChevronDown, Copy, Check, Download, Clock, X, GraduationCap } from 'lucide-react';

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
  const [showHistory, setShowHistory] = useState(false);

  const modes = [
    { id: 'optimize', name: 'Standard Prompt', icon: Sparkles, description: 'Optimize any prompt' },
    { id: 'research', name: 'Deep Research', icon: Search, description: 'Create research plans' },
    { id: 'socratic', name: 'Socratic Learning', icon: GraduationCap, description: 'Learning journeys' }
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
    }
  ];

  // Load history from localStorage on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('promptHistory');
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    }
  }, []);

  // Lazy loading effect - typewriter animation
  useEffect(() => {
    if (!optimizedPrompt) {
      setDisplayedPrompt('');
      return;
    }

    setDisplayedPrompt('');
    let currentIndex = 0;

    const intervalId = setInterval(() => {
      if (currentIndex <= optimizedPrompt.length) {
        setDisplayedPrompt(optimizedPrompt.slice(0, currentIndex));
        currentIndex += 2;
      } else {
        clearInterval(intervalId);
      }
    }, 10);

    return () => clearInterval(intervalId);
  }, [optimizedPrompt]);

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
    } catch (error) {
      console.error('Optimization failed:', error);
      alert('Failed to optimize prompt. Please make sure the server is running.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQuickAction = (action) => {
    setSelectedMode(action.mode);
    setInputPrompt(action.prompt);
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

  const loadFromHistory = (entry) => {
    setInputPrompt(entry.input);
    setOptimizedPrompt(entry.output);
    setDisplayedPrompt(entry.output);
    setQualityScore(entry.score);
    setSelectedMode(entry.mode);
    setShowHistory(false);
  };

  const getModeInfo = () => {
    return modes.find(m => m.id === selectedMode) || modes[0];
  };

  const currentMode = getModeInfo();
  const ModeIcon = currentMode.icon;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex">
      {/* Left Sidebar - History */}
      <div className={`${showHistory ? 'w-64' : 'w-0'} transition-all duration-300 bg-white border-r border-gray-200 flex flex-col overflow-hidden`}>
        {showHistory && (
          <>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Recent</h3>
              <button
                onClick={() => setShowHistory(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
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
      <div className="flex-1 flex flex-col items-center px-6 py-16 overflow-y-auto">
      {/* Hero Section */}
      <div className="max-w-4xl w-full text-center mb-12">
        <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
          Turn your lazy prompts into great ones
        </h1>
        <p className="text-xl text-gray-600 mb-12">
          Idea to prompt in seconds - get much better results from{' '}
          <span className="font-semibold text-gray-900">Claude AI</span>
          <span className="inline-block w-1 h-6 bg-gray-900 ml-1 animate-pulse"></span>
        </p>

        {/* Main Input Section */}
        <div className="relative mb-8">
          <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 focus-within:border-gray-400 transition-all overflow-hidden">
            <div className="p-6">
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
                rows={3}
                className="w-full text-lg text-gray-900 placeholder-gray-400 outline-none bg-transparent resize-none"
              />
            </div>

            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
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
                  <div className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-200 py-2 min-w-64 z-10">
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
                className="bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 text-white rounded-full p-3 transition-all duration-200 transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center justify-center gap-3 mb-12">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 px-5 py-3 bg-white hover:bg-gray-50 border border-gray-200 hover:border-gray-300 rounded-full transition-all duration-200 transform hover:scale-105"
          >
            <Clock className="w-4 h-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">
              {showHistory ? 'Hide History' : 'Show History'}
            </span>
          </button>
        </div>

        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                onClick={() => handleQuickAction(action)}
                className="flex items-center gap-2 px-5 py-3 bg-white hover:bg-gray-50 border border-gray-200 hover:border-gray-300 rounded-full transition-all duration-200 transform hover:scale-105"
              >
                <Icon className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">{action.label}</span>
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

      {/* Results Section */}
      {displayedPrompt && !isProcessing && (
        <div className="max-w-4xl w-full">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-gray-900" />
                <h2 className="text-xl font-semibold text-gray-900">Your Optimized Prompt</h2>
              </div>

              {qualityScore !== null && (
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-600">Quality Score:</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-gray-400 to-gray-900 transition-all duration-500"
                        style={{ width: `${qualityScore}%` }}
                      />
                    </div>
                    <span className="text-lg font-bold text-gray-900">{qualityScore}%</span>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-gray-50 rounded-lg p-6 mb-6 max-h-96 overflow-y-auto">
              <pre className="text-sm text-gray-800 whitespace-pre-wrap font-sans leading-relaxed">
                {displayedPrompt}
              </pre>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleCopy}
                className="flex items-center gap-2 px-6 py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition-colors"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy to Clipboard'}
              </button>

              <div className="relative group">
                <button className="flex items-center gap-2 px-6 py-3 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-lg transition-colors">
                  <Download className="w-4 h-4" />
                  Export
                </button>
                <div className="absolute left-0 bottom-full mb-2 w-40 bg-white rounded-lg shadow-xl border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                  <button
                    onClick={() => handleExport('text')}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 rounded-t-lg transition-colors"
                  >
                    Text (.txt)
                  </button>
                  <button
                    onClick={() => handleExport('markdown')}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors"
                  >
                    Markdown (.md)
                  </button>
                  <button
                    onClick={() => handleExport('json')}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 rounded-b-lg transition-colors"
                  >
                    JSON (.json)
                  </button>
                </div>
              </div>

              <button
                onClick={() => {
                  setInputPrompt('');
                  setOptimizedPrompt('');
                  setDisplayedPrompt('');
                  setQualityScore(null);
                }}
                className="px-6 py-3 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-lg transition-colors"
              >
                Start Over
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
