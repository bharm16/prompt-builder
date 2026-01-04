import React, { useState, useRef, useEffect, memo } from 'react';
import { ChevronDown, Check, Video } from 'lucide-react';
import { AI_MODEL_LABELS } from './constants';
import { useModelRegistry } from '../hooks/useModelRegistry';

/**
 * Model selector dropdown for selecting specific video models
 */
export const ModelSelectorDropdown = memo<{
  selectedModel: string | undefined;
  onModelChange: (modelId: string) => void;
  disabled?: boolean;
}>(({ selectedModel, onModelChange, disabled = false }): React.ReactElement => {
  const [isOpen, setIsOpen] = useState(false);
  const { models: availableModels, isLoading } = useModelRegistry();
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Find label for current selection
  const selectedOption = availableModels.find(m => m.id === selectedModel);
  const currentLabel = selectedOption?.label ?? 
    (selectedModel ? (AI_MODEL_LABELS[selectedModel as keyof typeof AI_MODEL_LABELS] || selectedModel) : 'Auto-detect Model');

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

  useEffect(() => {
    if (disabled && isOpen) {
      setIsOpen(false);
    }
  }, [disabled, isOpen]);

  const handleModelSelect = (modelId: string): void => {
    onModelChange(modelId);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen);
          }
        }}
        disabled={disabled || isLoading}
        className="inline-flex items-center gap-geist-2 px-geist-3 py-1.5 text-button-14 text-geist-accents-7 rounded-geist border border-geist-accents-2 bg-geist-accents-1 hover:bg-geist-accents-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-geist-accents-4 focus-visible:ring-offset-2 focus-visible:ring-offset-geist-background"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Current model: ${currentLabel}`}
        aria-disabled={disabled}
      >
        <Video className="h-3.5 w-3.5 text-geist-accents-5" />
        <span>{isLoading ? 'Loading...' : currentLabel}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-geist-accents-5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          className="absolute top-full left-0 mt-geist-1 min-w-[240px] max-h-[300px] overflow-y-auto z-[9999] bg-geist-background rounded-geist border border-geist-accents-2 shadow-geist-medium animate-slide-down"
          role="listbox"
          aria-label="Available video models"
        >
          {/* Auto-detect Option */}
          <button
            onClick={() => handleModelSelect('')}
            className={`
              w-full flex items-center gap-geist-2 px-geist-3 py-geist-2 text-left text-label-14
              transition-colors duration-150
              ${!selectedModel ? 'bg-geist-accents-1' : 'hover:bg-geist-accents-1'}
              border-b border-geist-accents-1
            `}
            role="option"
            aria-selected={!selectedModel}
          >
            <span className={`flex-1 ${!selectedModel ? 'font-semibold text-geist-foreground' : 'text-geist-accents-7'}`}>
              Auto-detect
            </span>
            {!selectedModel && (
              <Check className="h-4 w-4 text-geist-foreground" aria-hidden="true" />
            )}
          </button>

          {/* Model Options */}
          {availableModels.map((option) => {
            const isSelected = option.id === selectedModel;

            return (
              <button
                key={option.id}
                onClick={() => handleModelSelect(option.id)}
                className={`
                  w-full flex items-center gap-geist-2 px-geist-3 py-geist-2 text-left text-label-14
                  transition-colors duration-150
                  ${isSelected ? 'bg-geist-accents-1' : 'hover:bg-geist-accents-1'}
                  border-b border-geist-accents-1 last:border-b-0
                `}
                role="option"
                aria-selected={isSelected}
              >
                <div className="flex flex-col flex-1 min-w-0">
                  <span className={`truncate ${isSelected ? 'font-semibold text-geist-foreground' : 'text-geist-accents-7'}`}>
                    {option.label}
                  </span>
                  <span className="text-[10px] text-geist-accents-4 uppercase tracking-wider">
                    {option.provider}
                  </span>
                </div>
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

ModelSelectorDropdown.displayName = 'ModelSelectorDropdown';
