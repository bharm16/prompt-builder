import React, { memo, useState, useRef, useEffect } from 'react';
import {
  Lightbulb,
  Search,
  FileText,
  Shuffle,
  GraduationCap,
  ChevronDown,
  Check,
} from 'lucide-react';

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

// Mode Dropdown Component
const ModeDropdown = memo(({ modes, selectedMode, onModeChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const currentMode = modes.find(m => m.id === selectedMode) || modes[0];
  const CurrentIcon = currentMode.icon;

  // Handle clicks outside dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleModeSelect = (modeId) => {
    onModeChange(modeId);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Current mode: ${currentMode.name}`}
      >
        <span>{currentMode.name}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-neutral-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          className="absolute top-full left-0 mt-1 min-w-[200px] z-[9999] bg-white rounded-lg border border-neutral-200 shadow-lg animate-slide-down"
          role="listbox"
          aria-label="Available prompt modes"
        >
          {modes.map((mode) => {
            const Icon = mode.icon;
            const isSelected = mode.id === selectedMode;

            return (
              <button
                key={mode.id}
                onClick={() => handleModeSelect(mode.id)}
                className={`
                  w-full flex items-center gap-2 px-3 py-2 text-left text-sm
                  transition-colors duration-150
                  ${isSelected ? 'bg-neutral-50' : 'hover:bg-neutral-50'}
                  border-b border-neutral-100 last:border-b-0
                `}
                role="option"
                aria-selected={isSelected}
              >
                <Icon
                  className={`h-4 w-4 flex-shrink-0 ${isSelected ? 'text-neutral-900' : 'text-neutral-600'}`}
                  aria-hidden="true"
                />
                <span className={`flex-1 ${isSelected ? 'font-semibold text-neutral-900' : 'text-neutral-700'}`}>
                  {mode.name}
                </span>
                {isSelected && (
                  <Check className="h-4 w-4 text-neutral-900" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
});

ModeDropdown.displayName = 'ModeDropdown';

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
      prompt: 'Research [your topic here]',
      category: 'research',
      description: 'Deep dive into any subject',
    },
    {
      label: 'Analyze Data',
      icon: FileText,
      mode: 'optimize',
      prompt: 'Analyze data about [paste or describe your data]',
      category: 'research',
      description: 'Extract insights from data',
    },
    {
      label: 'Draft Document',
      icon: FileText,
      mode: 'optimize',
      prompt: 'Draft a [type of document] about [topic]',
      category: 'writing',
      description: 'Create professional documents',
    },
    {
      label: 'Brainstorm Ideas',
      icon: Lightbulb,
      mode: 'optimize',
      prompt: 'Brainstorm ideas for [your project or challenge]',
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

  const handleOptimizeClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (inputPrompt && inputPrompt.trim()) {
      onOptimize();
    }
  };

  return (
    <div className="mb-12 w-full max-w-4xl text-center animate-fade-in">
      {/* Hero Section */}
      <div className="mb-12">
        <h1 className="text-5xl font-extrabold text-neutral-900 tracking-tight">
          Turn your rough ideas into perfect prompts
        </h1>
      </div>

      {/* Main Input Section - Clean Design */}
      <div className="relative mb-6 w-full">
        <div className="bg-white border border-neutral-200 rounded-xl transition-all duration-200 focus-within:border-neutral-400 focus-within:shadow-sm">
            <label htmlFor="prompt-input" className="sr-only">
              Enter your prompt
            </label>
            <textarea
              id="prompt-input"
              value={inputPrompt}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe what you want to create..."
              rows={1}
              className="w-full resize-none bg-transparent text-[15px] text-neutral-900 placeholder-neutral-400 outline-none leading-relaxed px-6 pt-5 pb-0 rounded-t-xl"
              style={{
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif',
                border: 'none',
                boxShadow: 'none',
                outline: 'none',
              }}
              aria-label="Prompt input"
            />

          {/* Action Bar */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-white rounded-b-xl">
            <div className="flex items-center gap-2">
              <ModeDropdown
                modes={modes}
                selectedMode={selectedMode}
                onModeChange={onModeChange}
              />
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