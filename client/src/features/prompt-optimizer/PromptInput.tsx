import React, { useState, useRef, useEffect, memo } from 'react';
import {
  ChevronDown,
  Check,
} from 'lucide-react';
import { useDebugLogger } from '@hooks/useDebugLogger';
import { ModelSelectorDropdown } from './components/ModelSelectorDropdown';
import type { ModeDropdownProps, PromptInputProps } from './types';

/**
 * Mode dropdown component for selecting prompt optimization modes
 */
const ModeDropdown = memo<ModeDropdownProps>(({ modes, selectedMode, onModeChange }): React.ReactElement => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const currentMode = modes.find(m => m.id === selectedMode) ?? modes[0]!;
  const CurrentIcon = currentMode.icon;

  // Handle clicks outside dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
    return undefined;
  }, [isOpen]);

  const debug = useDebugLogger('ModeDropdown', { selectedMode });

  const handleModeSelect = (modeId: string): void => {
    debug.logAction('modeSelect', { 
      previousMode: selectedMode, 
      newMode: modeId 
    });
    onModeChange(modeId);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-geist-2 px-geist-3 py-geist-2 text-button-14 text-geist-accents-7 rounded-geist hover:bg-geist-accents-1 transition-colors"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Current mode: ${currentMode.name}`}
      >
        <span>{currentMode.name}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-geist-accents-5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          className="absolute top-full left-0 mt-geist-1 min-w-[200px] z-[9999] bg-geist-background rounded-geist border border-geist-accents-2 shadow-geist-medium animate-slide-down"
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
                  w-full flex items-center gap-geist-2 px-geist-3 py-geist-2 text-left text-label-14
                  transition-colors duration-150
                  ${isSelected ? 'bg-geist-accents-1' : 'hover:bg-geist-accents-1'}
                  border-b border-geist-accents-1 last:border-b-0
                `}
                role="option"
                aria-selected={isSelected}
              >
                <Icon
                  className={`h-4 w-4 flex-shrink-0 ${isSelected ? 'text-geist-foreground' : 'text-geist-accents-6'}`}
                  aria-hidden="true"
                />
                <span className={`flex-1 ${isSelected ? 'font-semibold text-geist-foreground' : 'text-geist-accents-7'}`}>
                  {mode.name}
                </span>
                {isSelected && (
                  <Check className="h-4 w-4 text-geist-foreground" aria-hidden="true" />
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

/**
 * Main prompt input component with mode selection and optimization trigger
 */
export const PromptInput = ({
  inputPrompt,
  onInputChange,
  selectedMode,
  onModeChange,
  selectedModel, // New prop
  onModelChange, // New prop
  onOptimize,
  onShowBrainstorm,
  isProcessing,
  modes,
  aiNames,
  currentAIIndex,
}: PromptInputProps): React.ReactElement => {
  const debug = useDebugLogger('PromptInput', { 
    mode: selectedMode, 
    hasInput: !!inputPrompt,
    isProcessing,
  });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      // For standard prompt mode, just Enter works
      // For other modes, require Cmd/Ctrl+Enter
      if (selectedMode === 'optimize' || e.metaKey || e.ctrlKey) {
        e.preventDefault();
        debug.logAction('optimizeViaKeyboard', { 
          mode: selectedMode,
          promptLength: inputPrompt.length,
          modifier: e.metaKey ? 'cmd' : e.ctrlKey ? 'ctrl' : 'none',
        });
        onOptimize();
      }
    }
  };

  const handleOptimizeClick = (e: React.MouseEvent<HTMLButtonElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    
    if (inputPrompt && inputPrompt.trim()) {
      debug.logAction('optimizeViaButton', { 
        mode: selectedMode,
        promptLength: inputPrompt.length,
        selectedModel // Log selected model
      });
      onOptimize();
    }
  };

  return (
    <div className="mb-12 w-full max-w-4xl text-center animate-fade-in">
      {/* Hero Section */}
      <div className="mb-8">
        <h1 className="text-heading-40 sm:text-heading-72 text-geist-foreground">
          From concept to draft
        </h1>
        <p className="mt-geist-2 text-copy-16 text-geist-accents-6 max-w-2xl mx-auto">
          Structure video prompts with labeled elements, click-to-refine suggestions, and fast previews.
        </p>
      </div>

      {/* Main Input Section - Clean Design */}
      <div className="relative mb-6 w-full">
        <div className="bg-geist-background border border-geist-accents-2 rounded-geist-lg shadow-geist-small transition-all duration-200 focus-within:border-geist-accents-4 focus-within:shadow-geist-medium">
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
              className="w-full resize-none bg-transparent text-[15px] text-geist-foreground placeholder-geist-accents-4 outline-none leading-relaxed px-geist-6 pt-geist-5 pb-0 rounded-t-geist-lg font-sans"
              style={{
                border: 'none',
                boxShadow: 'none',
                outline: 'none',
              }}
              aria-label="Prompt input"
            />

          {/* Action Bar */}
          <div className="flex items-center justify-between px-geist-4 py-geist-3 bg-geist-background rounded-b-geist-lg">
            <div className="flex items-center gap-geist-2">
              <ModeDropdown
                modes={modes}
                selectedMode={selectedMode}
                onModeChange={onModeChange}
              />
              
              {/* Show Model Selector only in Video Mode */}
              {selectedMode === 'video' && onModelChange && (
                <div className="flex items-center">
                  <div className="w-px h-4 bg-geist-accents-2 mx-2" />
                  <ModelSelectorDropdown
                    selectedModel={selectedModel}
                    onModelChange={onModelChange}
                  />
                </div>
              )}
            </div>

            <button
              onClick={handleOptimizeClick}
              disabled={!inputPrompt.trim() || isProcessing}
              className="inline-flex items-center gap-geist-2 px-geist-4 py-geist-2 text-button-16 text-white bg-geist-foreground rounded-geist hover:bg-geist-accents-8 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
