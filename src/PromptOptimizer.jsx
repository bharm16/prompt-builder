import React, { useState, useEffect } from 'react';
import { Sparkles, Search, FileText, Lightbulb, User, ArrowRight, ChevronDown, Copy, Check, Download, Clock, X, GraduationCap } from 'lucide-react';

export default function PromptOptimizer() {
  const [inputPrompt, setInputPrompt] = useState('');
  const [optimizedPrompt, setOptimizedPrompt] = useState('');
  const [displayedPrompt, setDisplayedPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [qualityScore, setQualityScore] = useState(null);
  const [useAI, setUseAI] = useState(true);
  const [mode, setMode] = useState('optimize'); // 'optimize', 'research', 'socratic'

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
        currentIndex += 2; // Adjust speed (higher = faster)
      } else {
        clearInterval(intervalId);
      }
    }, 10); // Adjust interval (lower = faster)

    return () => clearInterval(intervalId);
  }, [optimizedPrompt]);

  // Save to history
  const saveToHistory = (input, output, score) => {
    const newEntry = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      input,
      output,
      score
    };
    const updatedHistory = [newEntry, ...history].slice(0, 10); // Keep last 10
    setHistory(updatedHistory);
    localStorage.setItem('promptHistory', JSON.stringify(updatedHistory));
  };

  const analyzeAndOptimize = async (rough) => {
    // If AI mode is disabled, use rule-based generation
    if (!useAI) {
      console.log('AI mode is OFF - using rule-based generation');
      const analysis = {
        topic: extractTopic(rough),
        intent: extractIntent(rough),
        complexity: assessComplexity(rough),
        missingElements: identifyMissingElements(rough)
      };
      return generateStructuredPrompt(rough, analysis);
    }

    // AI mode - call proxy server
    console.log('AI mode is ON - calling Claude API...');
    console.log('Mode:', mode);
    try {
      console.log('Sending request to http://localhost:3001/api/optimize');
      const response = await fetch('http://localhost:3001/api/optimize', {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          prompt: rough,
          mode: mode
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
      console.error('Falling back to rule-based generation');
      // Fallback to rule-based generation if API fails
      const analysis = {
        topic: extractTopic(rough),
        intent: extractIntent(rough),
        complexity: assessComplexity(rough),
        missingElements: identifyMissingElements(rough)
      };
      return generateStructuredPrompt(rough, analysis);
    }
  };

  const extractTopic = (text) => {
    const lower = text.toLowerCase();
    if (lower.includes('camera') || lower.includes('photo')) return 'Photography/Cameras';
    if (lower.includes('code') || lower.includes('program')) return 'Programming';
    if (lower.includes('write') || lower.includes('essay') || lower.includes('article')) return 'Writing';
    if (lower.includes('market') || lower.includes('business')) return 'Business/Marketing';
    if (lower.includes('health') || lower.includes('medical')) return 'Healthcare';
    if (lower.includes('legal') || lower.includes('law')) return 'Legal';
    if (lower.includes('design') || lower.includes('ui/ux') || lower.includes('ui')) return 'Design';
    if (lower.includes('data') || lower.includes('analytics') || lower.includes('statistics')) return 'Data Analysis';
    if (lower.includes('explain') || lower.includes('how does')) return 'Education/Explanation';
    return 'General Information';
  };

  const extractIntent = (text) => {
    const lower = text.toLowerCase();
    if (lower.includes('how') || lower.includes('explain')) return 'understanding';
    if (lower.includes('create') || lower.includes('make') || lower.includes('build')) return 'creation';
    if (lower.includes('compare') || lower.includes('versus') || lower.includes('vs')) return 'comparison';
    if (lower.includes('recommend') || lower.includes('suggest')) return 'recommendation';
    if (lower.includes('overview') || lower.includes('summary')) return 'overview';
    return 'information';
  };

  const assessComplexity = (text) => {
    const questionCount = (text.match(/\?/g) || []).length;
    const wordCount = text.split(/\s+/).length;
    if (questionCount > 2 || wordCount > 30) return 'high';
    if (questionCount > 1 || wordCount > 15) return 'medium';
    return 'low';
  };

  const identifyMissingElements = (text) => {
    const missing = [];
    if (!text.toLowerCase().includes('format') && !text.includes('how')) {
      missing.push('output format');
    }
    if (text.split(/\s+/).length < 10) {
      missing.push('context');
    }
    if (!text.includes('specific') && !text.includes('example')) {
      missing.push('specificity');
    }
    return missing;
  };

  const calculateQualityScore = (input, output) => {
    let score = 0;
    const inputWords = input.split(/\s+/).length;
    const outputWords = output.split(/\s+/).length;

    // Length improvement
    if (outputWords > inputWords * 2) score += 25;
    else if (outputWords > inputWords) score += 15;

    // Structure (sections)
    const sections = (output.match(/\*\*/g) || []).length / 2;
    score += Math.min(sections * 10, 30);

    // Specificity
    if (output.includes('Goal')) score += 15;
    if (output.includes('Return Format')) score += 15;
    if (output.includes('Context')) score += 15;

    return Math.min(score, 100);
  };

  const generateStructuredPrompt = (rough, analysis) => {
    let structured = '';

    // Goal Section
    structured += '**Goal**\n';
    if (analysis.intent === 'understanding') {
      structured += `Provide a clear and comprehensive explanation of the concepts mentioned in the query. `;
    } else if (analysis.intent === 'creation') {
      structured += `Create high-quality content that meets the specified requirements. `;
    } else if (analysis.intent === 'comparison') {
      structured += `Deliver a balanced, detailed comparison that highlights key differences and similarities. `;
    } else if (analysis.intent === 'overview') {
      structured += `Provide a comprehensive overview covering all relevant aspects of the topic. `;
    }
    structured += `Focus on delivering actionable, accurate information that addresses the user's needs regarding ${analysis.topic.toLowerCase()}.\n\n`;

    // Return Format Section
    structured += '**Return Format**\n';
    structured += 'Structure the response as follows:\n';

    if (analysis.intent === 'understanding') {
      structured += '1. Core Concept: Define the main topic clearly and concisely\n';
      structured += '2. Key Components: Break down the subject into digestible parts with explanations\n';
      structured += '3. Practical Applications: Show how this applies in real-world scenarios\n';
      structured += '4. Common Misconceptions: Address frequent misunderstandings or confusion points\n';
    } else if (analysis.intent === 'overview') {
      structured += '1. Introduction: Brief overview of what will be covered\n';
      structured += '2. Main Topics: Detailed sections for each major aspect (use clear subheadings)\n';
      structured += '3. Key Takeaways: Summarize the most important points\n';
      structured += '4. Next Steps or Recommendations: Provide actionable guidance\n';
    } else if (analysis.intent === 'comparison') {
      structured += '1. Overview: Brief introduction to what is being compared\n';
      structured += '2. Comparison Matrix: Side-by-side analysis of key attributes\n';
      structured += '3. Use Case Scenarios: When to choose one option over another\n';
      structured += '4. Recommendation: Guidance based on different needs or contexts\n';
    } else {
      structured += '1. Main Response: Address the core query directly\n';
      structured += '2. Supporting Details: Provide context and examples\n';
      structured += '3. Practical Guidance: Include actionable advice or steps\n';
    }
    structured += '\n';

    // Warnings Section
    structured += '**Warnings**\n';
    structured += '- Avoid overwhelming the user with excessive technical jargon without clear explanations\n';

    if (analysis.topic.includes('Photo')) {
      structured += '- Do not conflate different specifications or measurement systems\n';
      structured += '- Ensure comparisons use consistent units and contexts\n';
    } else if (analysis.topic.includes('Program')) {
      structured += '- Do not provide code without explanation of what it does\n';
      structured += '- Avoid recommending deprecated or insecure practices\n';
    } else if (analysis.topic.includes('Business')) {
      structured += '- Do not make claims without supporting evidence or reasoning\n';
      structured += '- Avoid one-size-fits-all recommendations without considering context\n';
    }

    structured += '- Do not make assumptions about the user\'s expertise level; explain terms when first introduced\n';
    structured += '- Ensure all information is current and accurate\n\n';

    // Context Section
    structured += '**Context**\n';
    structured += `The user is seeking information about ${analysis.topic.toLowerCase()}. `;

    if (analysis.complexity === 'low') {
      structured += 'The query suggests they are in the early stages of learning about this topic. ';
    } else if (analysis.complexity === 'medium') {
      structured += 'The query indicates they have some basic knowledge but need clarification on specific aspects. ';
    } else {
      structured += 'The query shows they are exploring multiple facets and may have intermediate knowledge. ';
    }

    structured += 'Tailor the response to be accessible yet informative, bridging any knowledge gaps while avoiding condescension. ';

    if (analysis.missingElements.length > 0) {
      structured += `The original query may benefit from additional clarity on: ${analysis.missingElements.join(', ')}. `;
    }

    structured += 'Assume the user values clear, practical information they can immediately apply or understand.\n\n';

    // Additional Guidelines
    structured += '**Additional Guidelines**\n';
    structured += '- Use examples and analogies where appropriate to clarify complex concepts\n';
    structured += '- Include relevant data, statistics, or benchmarks when available\n';
    structured += '- Maintain a helpful, professional tone throughout\n';
    structured += '- If the topic has evolved recently, note any significant changes or updates\n';

    return structured;
  };

  const handleOptimize = async () => {
    if (!inputPrompt.trim()) return;

    setIsProcessing(true);
    try {
      const optimized = await analyzeAndOptimize(inputPrompt);
      console.log('📝 Received optimized prompt:', optimized);
      console.log('📝 Length:', optimized.length, 'characters');

      const score = calculateQualityScore(inputPrompt, optimized);
      console.log('📊 Quality score:', score);

      setOptimizedPrompt(optimized);
      console.log('✅ State updated with optimized prompt');

      setQualityScore(score);
      saveToHistory(inputPrompt, optimized, score);
    } catch (error) {
      console.error('Optimization failed:', error);
    } finally {
      setIsProcessing(false);
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
        qualityScore
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
    setQualityScore(entry.score);
    setShowHistory(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Sparkles className="w-10 h-10 text-amber-600" />
            <h1 className="text-4xl font-bold text-amber-900">Prompt Optimizer</h1>
          </div>
          <p className="text-amber-700 text-lg">Transform rough ideas into structured, powerful prompts</p>

          {/* Controls */}
          <div className="flex items-center justify-center gap-4 mt-4 flex-wrap">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-amber-50 text-amber-700 rounded-lg transition-colors shadow-sm"
            >
              <History className="w-4 h-4" />
              {showHistory ? 'Hide History' : 'Show History'}
            </button>

            {/* Mode Selector */}
            <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-sm">
              <span className="text-sm font-medium text-gray-700">Mode:</span>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                className="text-sm font-medium text-gray-700 bg-transparent border-none focus:outline-none cursor-pointer"
              >
                <option value="optimize">✨ Optimize</option>
                <option value="research">🔍 Deep Research</option>
                <option value="socratic">🎓 Socratic Learning</option>
              </select>
            </div>

            <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-sm">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-medium text-gray-700">AI Mode</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={useAI}
                  onChange={(e) => setUseAI(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* History Panel */}
        {showHistory && history.length > 0 && (
          <div className="mb-6 bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent Optimizations</h3>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {history.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => loadFromHistory(entry)}
                  className="w-full text-left p-3 border-2 border-amber-100 hover:border-amber-300 rounded-lg transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500">
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>
                    <span className="text-xs font-semibold text-amber-600">
                      Score: {entry.score}%
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 truncate">{entry.input}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Input Section */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              {mode === 'optimize' && 'Your Rough Prompt'}
              {mode === 'research' && 'Research Topic'}
              {mode === 'socratic' && 'Learning Topic'}
            </h2>
            <textarea
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              placeholder={
                mode === 'optimize'
                  ? "Enter your rough prompt here... e.g., 'give me an overview of digital camera specs'"
                  : mode === 'research'
                  ? "Enter a topic to research... e.g., 'impact of AI on healthcare'"
                  : "Enter a topic to learn... e.g., 'quantum computing basics'"
              }
              className="w-full h-64 p-4 border-2 border-amber-200 rounded-lg focus:outline-none focus:border-amber-400 resize-none"
            />
            <button
              onClick={handleOptimize}
              disabled={!inputPrompt.trim() || isProcessing}
              className="mt-4 w-full bg-amber-600 hover:bg-amber-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {mode === 'optimize' && <Sparkles className="w-5 h-5" />}
              {mode === 'research' && <Search className="w-5 h-5" />}
              {mode === 'socratic' && <GraduationCap className="w-5 h-5" />}
              {isProcessing
                ? 'Processing...'
                : mode === 'optimize'
                  ? 'Optimize Prompt'
                  : mode === 'research'
                  ? 'Generate Research Plan'
                  : 'Create Learning Path'
              }
            </button>
          </div>

          {/* Output Section */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-800">
                {mode === 'optimize' && 'Optimized Prompt'}
                {mode === 'research' && 'Research Plan'}
                {mode === 'socratic' && 'Learning Path'}
              </h2>
              {optimizedPrompt && (
                <div className="flex gap-2">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg transition-colors"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                  <div className="relative group">
                    <button className="flex items-center gap-2 px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg transition-colors">
                      <Download className="w-4 h-4" />
                      Export
                    </button>
                    <div className="absolute right-0 mt-2 w-32 bg-white rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                      <button onClick={() => handleExport('text')} className="w-full px-4 py-2 text-left hover:bg-amber-50 rounded-t-lg">Text</button>
                      <button onClick={() => handleExport('markdown')} className="w-full px-4 py-2 text-left hover:bg-amber-50">Markdown</button>
                      <button onClick={() => handleExport('json')} className="w-full px-4 py-2 text-left hover:bg-amber-50 rounded-b-lg">JSON</button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quality Score */}
            {qualityScore !== null && (
              <div className="mb-4 p-3 bg-amber-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700">Quality Score</span>
                  <span className="text-lg font-bold text-amber-600">{qualityScore}%</span>
                </div>
                <div className="w-full bg-amber-200 rounded-full h-2">
                  <div
                    className="bg-amber-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${qualityScore}%` }}
                  />
                </div>
              </div>
            )}

            <div className="h-64 overflow-y-auto p-4 border-2 border-amber-200 rounded-lg bg-amber-50">
              {displayedPrompt ? (
                <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono">{displayedPrompt}</pre>
              ) : optimizedPrompt ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-pulse text-amber-600">Loading...</div>
                </div>
              ) : (
                <p className="text-gray-400 italic">Your optimized prompt will appear here...</p>
              )}
            </div>
          </div>
        </div>

        {/* Example Section */}
        <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Try These Examples</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <button
              onClick={() => setInputPrompt('explain machine learning to me')}
              className="p-4 border-2 border-amber-200 hover:border-amber-400 rounded-lg text-left transition-colors"
            >
              <p className="text-sm text-gray-700">explain machine learning to me</p>
            </button>
            <button
              onClick={() => setInputPrompt('how do I start a podcast? what equipment do I need?')}
              className="p-4 border-2 border-amber-200 hover:border-amber-400 rounded-lg text-left transition-colors"
            >
              <p className="text-sm text-gray-700">how do I start a podcast? what equipment do I need?</p>
            </button>
            <button
              onClick={() => setInputPrompt('write me a business plan for a coffee shop')}
              className="p-4 border-2 border-amber-200 hover:border-amber-400 rounded-lg text-left transition-colors"
            >
              <p className="text-sm text-gray-700">write me a business plan for a coffee shop</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
