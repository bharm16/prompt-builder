import React, { memo } from 'react';
import {
  Lightbulb,
  Search,
  FileText,
  Shuffle,
  GraduationCap,
} from 'lucide-react';
import ModeSelector from '../../components/ModeSelector';

// Quick Action Button Component
const QuickActionButton = memo(({ action, onClick }) => {
  const Icon = action.icon;
  return (
    <button
      onClick={() => onClick(action)}
      className="btn-ghost btn-sm border border-neutral-300 hover:border-neutral-400 hover:bg-white hover-scale stagger-item"
      aria-label={`Use ${action.label} template`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="text-xs font-medium">{action.label}</span>
    </button>
  );
});

QuickActionButton.displayName = 'QuickActionButton';

// Main PromptInput Component
export const PromptInput = ({
  inputPrompt,
  onInputChange,
  selectedMode,
  onModeChange,
  onOptimize,
  onShowBrainstorm,
  isProcessing,
  modes,
  aiNames,
  currentAIIndex,
}) => {
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

  const handleQuickAction = (action) => {
    onModeChange(action.mode);
    if (action.prompt === 'random') {
      const randomIndex = Math.floor(Math.random() * randomPrompts.length);
      onInputChange(randomPrompts[randomIndex]);
    } else {
      onInputChange(action.prompt);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      console.log('Enter pressed, mode:', selectedMode, 'metaKey:', e.metaKey, 'ctrlKey:', e.ctrlKey);
      // For standard prompt mode, just Enter works
      // For other modes, require Cmd/Ctrl+Enter
      if (selectedMode === 'optimize' || e.metaKey || e.ctrlKey) {
        e.preventDefault();
        console.log('Calling onOptimize from Enter key');
        onOptimize();
      }
    }
  };

  const handleOptimizeClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Optimize button clicked, inputPrompt:', inputPrompt, 'isProcessing:', isProcessing);
    if (inputPrompt && inputPrompt.trim()) {
      onOptimize();
    }
  };

  return (
    <div className="mb-12 w-full max-w-3xl text-center animate-fade-in">
      {/* Hero Section */}
      <div className="mb-12">
        <h1 className="mb-4 text-4xl font-bold text-neutral-900 tracking-tight">
          Prompt Builder
        </h1>
        <p className="text-base text-neutral-600 max-w-lg mx-auto">
          Transform your ideas into optimized prompts for AI
        </p>
      </div>

      {/* Mode Selector - Minimal Tabs */}
      <div className="mb-8">
        <ModeSelector
          modes={modes}
          selectedMode={selectedMode}
          onModeChange={onModeChange}
        />
      </div>

      {/* Main Input Section - Clean Design */}
      <div className="relative mb-6 w-full">
        <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden transition-all duration-200 focus-within:border-neutral-400 focus-within:shadow-sm">
            <label htmlFor="prompt-input" className="sr-only">
              Enter your prompt
            </label>
            <textarea
              id="prompt-input"
              value={inputPrompt}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe what you want to create..."
              rows={2}
              className="w-full resize-none bg-transparent text-[15px] text-neutral-900 placeholder-neutral-400 outline-none leading-relaxed px-6 pt-6 pb-0"
              style={{
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif',
                border: 'none',
                boxShadow: 'none',
                outline: 'none',
              }}
              aria-label="Prompt input"
            />

          {/* Action Bar */}
          <div className="flex items-center justify-between px-4 py-3 bg-white">
            <div className="flex items-center gap-2">
              {selectedMode === 'video' && (
                <button
                  onClick={onShowBrainstorm}
                  disabled={isProcessing}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-neutral-700 rounded-lg hover:bg-white transition-colors"
                  aria-label="Build video concept"
                  title="Build concept"
                >
                  <Lightbulb className="h-3.5 w-3.5" />
                  <span>Build Concept</span>
                </button>
              )}
            </div>

            <button
              onClick={handleOptimizeClick}
              disabled={!inputPrompt.trim() || isProcessing}
              className="inline-flex items-center gap-2 px-4 py-1.5 text-sm font-semibold text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Optimize prompt"
              title="Optimize (⌘Enter)"
            >
              <span>Optimize</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quick Actions - Simplified */}
      <div className="flex items-center justify-center gap-2 flex-wrap">
        <span className="text-xs text-neutral-500 mr-1">Try:</span>
        {quickActions.slice(0, 4).map((action, idx) => (
          <button
            key={idx}
            onClick={() => handleQuickAction(action)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-600 bg-white border border-neutral-200 rounded-lg hover:border-neutral-300 hover:bg-neutral-50 transition-colors"
          >
            <action.icon className="h-3 w-3" />
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
};