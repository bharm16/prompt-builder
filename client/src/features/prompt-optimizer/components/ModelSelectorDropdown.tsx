import React, { useState, useRef, useEffect, memo } from 'react';
import { ChevronDown, Check, Video } from 'lucide-react';
import { AI_MODEL_IDS, AI_MODEL_LABELS } from './constants';

/**
 * Model selector dropdown for selecting specific video models
 */
export const ModelSelectorDropdown = memo<{
  selectedModel: string | undefined;
  onModelChange: (modelId: string) => void;
}>(({ selectedModel, onModelChange }): React.ReactElement => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Default to first model if none selected, or display "Auto-detect" if undefined
  const currentLabel = selectedModel ? AI_MODEL_LABELS[selectedModel as keyof typeof AI_MODEL_LABELS] : 'Auto-detect Model';

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

  const handleModelSelect = (modelId: string): void => {
    onModelChange(modelId);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-geist-2 px-geist-3 py-geist-2 text-button-14 text-geist-accents-7 rounded-geist hover:bg-geist-accents-1 transition-colors"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Current model: ${currentLabel}`}
      >
        <Video className="h-3.5 w-3.5 text-geist-accents-5" />
        <span>{currentLabel}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-geist-accents-5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          className="absolute top-full left-0 mt-geist-1 min-w-[200px] z-[9999] bg-geist-background rounded-geist border border-geist-accents-2 shadow-geist-medium animate-slide-down"
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
          {AI_MODEL_IDS.map((modelId) => {
            const label = AI_MODEL_LABELS[modelId];
            const isSelected = modelId === selectedModel;

            return (
              <button
                key={modelId}
                onClick={() => handleModelSelect(modelId)}
                className={`
                  w-full flex items-center gap-geist-2 px-geist-3 py-geist-2 text-left text-label-14
                  transition-colors duration-150
                  ${isSelected ? 'bg-geist-accents-1' : 'hover:bg-geist-accents-1'}
                  border-b border-geist-accents-1 last:border-b-0
                `}
                role="option"
                aria-selected={isSelected}
              >
                <span className={`flex-1 ${isSelected ? 'font-semibold text-geist-foreground' : 'text-geist-accents-7'}`}>
                  {label}
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

ModelSelectorDropdown.displayName = 'ModelSelectorDropdown';

