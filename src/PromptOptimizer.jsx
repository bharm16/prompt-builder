import { useState, useEffect } from 'react';
import {
  Sparkles,
  Search,
  Copy,
  Check,
  Download,
  GraduationCap,
  History,
} from 'lucide-react';

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
      score,
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
        missingElements: identifyMissingElements(rough),
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
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          prompt: rough,
          mode: mode,
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
      console.error('Falling back to rule-based generation');
      // Fallback to rule-based generation if API fails
      const analysis = {
        topic: extractTopic(rough),
        intent: extractIntent(rough),
        complexity: assessComplexity(rough),
        missingElements: identifyMissingElements(rough),
      };
      return generateStructuredPrompt(rough, analysis);
    }
  };

  const extractTopic = (text) => {
    const lower = text.toLowerCase();
    if (lower.includes('camera') || lower.includes('photo'))
      return 'Photography/Cameras';
    if (lower.includes('code') || lower.includes('program'))
      return 'Programming';
    if (
      lower.includes('write') ||
      lower.includes('essay') ||
      lower.includes('article')
    )
      return 'Writing';
    if (lower.includes('market') || lower.includes('business'))
      return 'Business/Marketing';
    if (lower.includes('health') || lower.includes('medical'))
      return 'Healthcare';
    if (lower.includes('legal') || lower.includes('law')) return 'Legal';
    if (
      lower.includes('design') ||
      lower.includes('ui/ux') ||
      lower.includes('ui')
    )
      return 'Design';
    if (
      lower.includes('data') ||
      lower.includes('analytics') ||
      lower.includes('statistics')
    )
      return 'Data Analysis';
    if (lower.includes('explain') || lower.includes('how does'))
      return 'Education/Explanation';
    return 'General Information';
  };

  const extractIntent = (text) => {
    const lower = text.toLowerCase();
    if (lower.includes('how') || lower.includes('explain'))
      return 'understanding';
    if (
      lower.includes('create') ||
      lower.includes('make') ||
      lower.includes('build')
    )
      return 'creation';
    if (
      lower.includes('compare') ||
      lower.includes('versus') ||
      lower.includes('vs')
    )
      return 'comparison';
    if (lower.includes('recommend') || lower.includes('suggest'))
      return 'recommendation';
    if (lower.includes('overview') || lower.includes('summary'))
      return 'overview';
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
      structured +=
        '1. Core Concept: Define the main topic clearly and concisely\n';
      structured +=
        '2. Key Components: Break down the subject into digestible parts with explanations\n';
      structured +=
        '3. Practical Applications: Show how this applies in real-world scenarios\n';
      structured +=
        '4. Common Misconceptions: Address frequent misunderstandings or confusion points\n';
    } else if (analysis.intent === 'overview') {
      structured += '1. Introduction: Brief overview of what will be covered\n';
      structured +=
        '2. Main Topics: Detailed sections for each major aspect (use clear subheadings)\n';
      structured += '3. Key Takeaways: Summarize the most important points\n';
      structured +=
        '4. Next Steps or Recommendations: Provide actionable guidance\n';
    } else if (analysis.intent === 'comparison') {
      structured +=
        '1. Overview: Brief introduction to what is being compared\n';
      structured +=
        '2. Comparison Matrix: Side-by-side analysis of key attributes\n';
      structured +=
        '3. Use Case Scenarios: When to choose one option over another\n';
      structured +=
        '4. Recommendation: Guidance based on different needs or contexts\n';
    } else {
      structured += '1. Main Response: Address the core query directly\n';
      structured += '2. Supporting Details: Provide context and examples\n';
      structured +=
        '3. Practical Guidance: Include actionable advice or steps\n';
    }
    structured += '\n';

    // Warnings Section
    structured += '**Warnings**\n';
    structured +=
      '- Avoid overwhelming the user with excessive technical jargon without clear explanations\n';

    if (analysis.topic.includes('Photo')) {
      structured +=
        '- Do not conflate different specifications or measurement systems\n';
      structured += '- Ensure comparisons use consistent units and contexts\n';
    } else if (analysis.topic.includes('Program')) {
      structured +=
        '- Do not provide code without explanation of what it does\n';
      structured += '- Avoid recommending deprecated or insecure practices\n';
    } else if (analysis.topic.includes('Business')) {
      structured +=
        '- Do not make claims without supporting evidence or reasoning\n';
      structured +=
        '- Avoid one-size-fits-all recommendations without considering context\n';
    }

    structured +=
      "- Do not make assumptions about the user's expertise level; explain terms when first introduced\n";
    structured += '- Ensure all information is current and accurate\n\n';

    // Context Section
    structured += '**Context**\n';
    structured += `The user is seeking information about ${analysis.topic.toLowerCase()}. `;

    if (analysis.complexity === 'low') {
      structured +=
        'The query suggests they are in the early stages of learning about this topic. ';
    } else if (analysis.complexity === 'medium') {
      structured +=
        'The query indicates they have some basic knowledge but need clarification on specific aspects. ';
    } else {
      structured +=
        'The query shows they are exploring multiple facets and may have intermediate knowledge. ';
    }

    structured +=
      'Tailor the response to be accessible yet informative, bridging any knowledge gaps while avoiding condescension. ';

    if (analysis.missingElements.length > 0) {
      structured += `The original query may benefit from additional clarity on: ${analysis.missingElements.join(', ')}. `;
    }

    structured +=
      'Assume the user values clear, practical information they can immediately apply or understand.\n\n';

    // Additional Guidelines
    structured += '**Additional Guidelines**\n';
    structured +=
      '- Use examples and analogies where appropriate to clarify complex concepts\n';
    structured +=
      '- Include relevant data, statistics, or benchmarks when available\n';
    structured += '- Maintain a helpful, professional tone throughout\n';
    structured +=
      '- If the topic has evolved recently, note any significant changes or updates\n';

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
      content = JSON.stringify(
        {
          timestamp,
          original: inputPrompt,
          optimized: optimizedPrompt,
          qualityScore,
        },
        null,
        2
      );
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
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 text-center">
          <div className="mb-4 flex items-center justify-center gap-3">
            <Sparkles className="h-10 w-10 text-amber-600" />
            <h1 className="text-4xl font-bold text-amber-900">
              Prompt Optimizer
            </h1>
          </div>
          <p className="text-lg text-amber-700">
            Transform rough ideas into structured, powerful prompts
          </p>

          {/* Controls */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-amber-700 shadow-sm transition-colors hover:bg-amber-50"
            >
              <History className="h-4 w-4" />
              {showHistory ? 'Hide History' : 'Show History'}
            </button>

            {/* Mode Selector */}
            <div className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 shadow-sm">
              <span className="text-sm font-medium text-gray-700">Mode:</span>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                className="cursor-pointer border-none bg-transparent text-sm font-medium text-gray-700 focus:outline-none"
              >
                <option value="optimize">✨ Optimize</option>
                <option value="research">🔍 Deep Research</option>
                <option value="socratic">🎓 Socratic Learning</option>
              </select>
            </div>

            <div className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 shadow-sm">
              <Sparkles className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-medium text-gray-700">AI Mode</span>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={useAI}
                  onChange={(e) => setUseAI(e.target.checked)}
                  className="peer sr-only"
                />
                <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-amber-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-amber-300"></div>
              </label>
            </div>
          </div>
        </div>

        {/* History Panel */}
        {showHistory && history.length > 0 && (
          <div className="mb-6 rounded-lg bg-white p-6 shadow-lg">
            <h3 className="mb-4 text-lg font-semibold text-gray-800">
              Recent Optimizations
            </h3>
            <div className="max-h-64 space-y-3 overflow-y-auto">
              {history.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => loadFromHistory(entry)}
                  className="w-full rounded-lg border-2 border-amber-100 p-3 text-left transition-colors hover:border-amber-300"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>
                    <span className="text-xs font-semibold text-amber-600">
                      Score: {entry.score}%
                    </span>
                  </div>
                  <p className="truncate text-sm text-gray-700">
                    {entry.input}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* Input Section */}
          <div className="rounded-lg bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-xl font-semibold text-gray-800">
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
              className="h-64 w-full resize-none rounded-lg border-2 border-amber-200 p-4 focus:border-amber-400 focus:outline-none"
            />
            <button
              onClick={handleOptimize}
              disabled={!inputPrompt.trim() || isProcessing}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-amber-700 disabled:bg-gray-400"
            >
              {mode === 'optimize' && <Sparkles className="h-5 w-5" />}
              {mode === 'research' && <Search className="h-5 w-5" />}
              {mode === 'socratic' && <GraduationCap className="h-5 w-5" />}
              {isProcessing
                ? 'Processing...'
                : mode === 'optimize'
                  ? 'Optimize Prompt'
                  : mode === 'research'
                    ? 'Generate Research Plan'
                    : 'Create Learning Path'}
            </button>
          </div>

          {/* Output Section */}
          <div className="rounded-lg bg-white p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-800">
                {mode === 'optimize' && 'Optimized Prompt'}
                {mode === 'research' && 'Research Plan'}
                {mode === 'socratic' && 'Learning Path'}
              </h2>
              {optimizedPrompt && (
                <div className="flex gap-2">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-2 rounded-lg bg-amber-100 px-4 py-2 text-amber-700 transition-colors hover:bg-amber-200"
                  >
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                  <div className="group relative">
                    <button className="flex items-center gap-2 rounded-lg bg-amber-100 px-4 py-2 text-amber-700 transition-colors hover:bg-amber-200">
                      <Download className="h-4 w-4" />
                      Export
                    </button>
                    <div className="invisible absolute right-0 z-10 mt-2 w-32 rounded-lg bg-white opacity-0 shadow-lg transition-all group-hover:visible group-hover:opacity-100">
                      <button
                        onClick={() => handleExport('text')}
                        className="w-full rounded-t-lg px-4 py-2 text-left hover:bg-amber-50"
                      >
                        Text
                      </button>
                      <button
                        onClick={() => handleExport('markdown')}
                        className="w-full px-4 py-2 text-left hover:bg-amber-50"
                      >
                        Markdown
                      </button>
                      <button
                        onClick={() => handleExport('json')}
                        className="w-full rounded-b-lg px-4 py-2 text-left hover:bg-amber-50"
                      >
                        JSON
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quality Score */}
            {qualityScore !== null && (
              <div className="mb-4 rounded-lg bg-amber-50 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">
                    Quality Score
                  </span>
                  <span className="text-lg font-bold text-amber-600">
                    {qualityScore}%
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-amber-200">
                  <div
                    className="h-2 rounded-full bg-amber-600 transition-all duration-500"
                    style={{ width: `${qualityScore}%` }}
                  />
                </div>
              </div>
            )}

            <div className="h-64 overflow-y-auto rounded-lg border-2 border-amber-200 bg-amber-50 p-4">
              {displayedPrompt ? (
                <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800">
                  {displayedPrompt}
                </pre>
              ) : optimizedPrompt ? (
                <div className="flex h-full items-center justify-center">
                  <div className="animate-pulse text-amber-600">Loading...</div>
                </div>
              ) : (
                <p className="italic text-gray-400">
                  Your optimized prompt will appear here...
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Example Section */}
        <div className="mt-8 rounded-lg bg-white p-6 shadow-lg">
          <h3 className="mb-4 text-lg font-semibold text-gray-800">
            Try These Examples
          </h3>
          <div className="grid gap-4 md:grid-cols-3">
            <button
              onClick={() => setInputPrompt('explain machine learning to me')}
              className="rounded-lg border-2 border-amber-200 p-4 text-left transition-colors hover:border-amber-400"
            >
              <p className="text-sm text-gray-700">
                explain machine learning to me
              </p>
            </button>
            <button
              onClick={() =>
                setInputPrompt(
                  'how do I start a podcast? what equipment do I need?'
                )
              }
              className="rounded-lg border-2 border-amber-200 p-4 text-left transition-colors hover:border-amber-400"
            >
              <p className="text-sm text-gray-700">
                how do I start a podcast? what equipment do I need?
              </p>
            </button>
            <button
              onClick={() =>
                setInputPrompt('write me a business plan for a coffee shop')
              }
              className="rounded-lg border-2 border-amber-200 p-4 text-left transition-colors hover:border-amber-400"
            >
              <p className="text-sm text-gray-700">
                write me a business plan for a coffee shop
              </p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
