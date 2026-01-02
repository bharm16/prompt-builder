import React from 'react';
import { useDebugLogger } from '@hooks/useDebugLogger';
import { ModelSelectorDropdown } from './components/ModelSelectorDropdown';
import type { PromptInputProps } from './types';

/**
 * Main prompt input component with mode selection and optimization trigger
 */
export const PromptInput = ({
  inputPrompt,
  onInputChange,
  selectedModel, // New prop
  onModelChange, // New prop
  onOptimize,
  onShowBrainstorm,
  isProcessing,
  aiNames,
  currentAIIndex,
}: PromptInputProps): React.ReactElement => {
  // App is video-only now; keep a local constant for logging/behavior.
  const selectedMode = 'video' as const;

  const debug = useDebugLogger('PromptInput', { 
    mode: selectedMode, 
    hasInput: !!inputPrompt,
    isProcessing,
  });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      // In video mode, require Cmd/Ctrl+Enter to avoid accidental submissions while writing.
      if (e.metaKey || e.ctrlKey) {
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
          Vidra
        </h1>
        <p className="mt-geist-2 text-copy-16 text-geist-accents-6 max-w-2xl mx-auto">
          From concept to draft
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
              className="w-full resize-none bg-transparent text-[16px] text-geist-foreground placeholder-geist-accents-6 placeholder:font-medium outline-none leading-relaxed px-geist-6 pt-geist-6 pb-0 rounded-t-geist-lg font-sans"
              style={{
                border: 'none',
                boxShadow: 'none',
                outline: 'none',
              }}
              aria-label="Prompt input"
            />

          {/* Action Bar */}
          <div className="flex items-center justify-between px-geist-4 py-geist-2 bg-geist-background rounded-b-geist-lg">
            <div className="flex items-center gap-geist-2">
              {/* Video model selector */}
              {onModelChange && (
                <div className="flex items-center">
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
              className="inline-flex items-center gap-geist-2 px-geist-4 py-1.5 text-button-16 text-white bg-orange-500 rounded-geist hover:bg-orange-600 shadow-geist-small transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 focus-visible:ring-offset-geist-background"
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
