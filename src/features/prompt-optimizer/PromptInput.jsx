import React, { memo } from 'react';
import {
  Zap,
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
  onImproveFirst,
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
      // For standard prompt mode, just Enter works
      // For other modes, require Cmd/Ctrl+Enter
      if (selectedMode === 'optimize' || e.metaKey || e.ctrlKey) {
        e.preventDefault();
        onOptimize();
      }
    }
  };

  return (
    <div className="mb-12 w-full max-w-4xl text-center animate-fade-in">
      <h1 className="mb-3 text-3xl sm:text-4xl font-semibold leading-snug text-neutral-900 text-balance">
        Professional Prompt Builder
      </h1>
      <p className="mb-10 text-base sm:text-lg text-neutral-600 max-w-2xl mx-auto">
        Transform ideas into structured prompts for{' '}
        <span className="inline-flex items-center font-medium text-neutral-800">
          <span className="transition-opacity duration-300">
            {aiNames[currentAIIndex]}
          </span>
        </span>
      </p>

      {/* Mode Selector - Horizontal Tabs */}
      <div className="mb-6">
        <ModeSelector
          modes={modes}
          selectedMode={selectedMode}
          onModeChange={onModeChange}
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
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="I want a prompt that will..."
              rows={3}
              className="w-full resize-none bg-transparent text-base text-neutral-900 placeholder-neutral-400 outline-none border-none focus:outline-none focus:ring-0 focus:border-none"
              aria-label="Prompt input"
            />
          </div>

          <div className="flex items-center justify-between border-t border-neutral-200 px-4 py-3 bg-white">
            <div className="flex items-center gap-2">
              <button
                onClick={onImproveFirst}
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
                  onClick={onShowBrainstorm}
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
                onClick={onOptimize}
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
          {quickActions.map((action, idx) => (
            <QuickActionButton
              key={idx}
              action={action}
              onClick={handleQuickAction}
            />
          ))}
        </div>
      </div>
    </div>
  );
};