import React, { memo, useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  Check,
} from 'lucide-react';

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
    </div>
  );
};