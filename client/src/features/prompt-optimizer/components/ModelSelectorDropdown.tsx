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
  variant?: 'default' | 'pill' | 'pillDark';
}>(({ selectedModel, onModelChange, disabled = false, variant = 'default' }): React.ReactElement => {
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
        className={
          variant === 'pillDark'
            ? [
                'inline-flex items-center gap-2 h-8 px-[10px] text-[13px] font-medium rounded-[10px] transition-colors',
                'disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none',
                isOpen
                  ? 'bg-[rgba(139,92,246,0.22)] border border-[rgba(139,92,246,0.28)] shadow-[0_0_0_3px_rgba(139,92,246,0.16)]'
                  : 'bg-[rgba(255,255,255,0.06)] text-white/90 hover:bg-[rgba(255,255,255,0.10)] border border-[rgba(255,255,255,0.08)]',
              ].join(' ')
            : variant === 'pill'
              ? 'inline-flex items-center gap-2 h-8 px-3 text-[13px] font-medium rounded-[8px] bg-[#F4F5F7] text-[#222] hover:bg-[#E8EAED] transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/10'
              : 'inline-flex items-center gap-geist-2 px-geist-3 py-1.5 text-button-14 text-geist-accents-7 rounded-geist border border-geist-accents-2 bg-geist-accents-1 hover:bg-geist-accents-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-geist-accents-4 focus-visible:ring-offset-2 focus-visible:ring-offset-geist-background'
        }
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Current model: ${currentLabel}`}
        aria-disabled={disabled}
      >
        <Video
          className={`h-3.5 w-3.5 ${
            variant === 'pillDark' ? 'text-white/80' : variant === 'pill' ? 'text-[#222]' : 'text-geist-accents-5'
          }`}
        />
        <span className="truncate max-w-[220px]">{isLoading ? 'Loading...' : currentLabel}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 ${
            variant === 'pillDark'
              ? 'text-white/80'
              : variant === 'pill'
                ? 'text-[#222]'
                : 'text-geist-accents-5'
          } transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          className={
            variant === 'pillDark'
              ? 'absolute top-full left-0 mt-2 min-w-[240px] max-h-[300px] overflow-y-auto z-[9999] bg-[#111] rounded-[10px] border border-white/10 shadow-2xl animate-slide-down'
              : 'absolute top-full left-0 mt-2 min-w-[240px] max-h-[300px] overflow-y-auto z-[9999] bg-white rounded-[10px] border border-neutral-200 shadow-lg animate-slide-down'
          }
          role="listbox"
          aria-label="Available video models"
        >
          {/* Auto-detect Option */}
          <button
            onClick={() => handleModelSelect('')}
            className={`
              w-full flex items-center gap-2 px-3 py-2 text-left text-[13px]
              transition-colors duration-150
              ${
                variant === 'pillDark'
                  ? !selectedModel
                    ? 'bg-white/10'
                    : 'hover:bg-white/8'
                  : !selectedModel
                    ? 'bg-neutral-100'
                    : 'hover:bg-neutral-100'
              }
              ${variant === 'pillDark' ? 'border-b border-white/10' : 'border-b border-neutral-200'}
            `}
            role="option"
            aria-selected={!selectedModel}
          >
            <span
              className={`flex-1 ${
                variant === 'pillDark'
                  ? !selectedModel
                    ? 'font-semibold text-white'
                    : 'text-white/80'
                  : !selectedModel
                    ? 'font-semibold text-neutral-900'
                    : 'text-neutral-700'
              }`}
            >
              Auto-detect
            </span>
            {!selectedModel && (
              <Check
                className={`h-4 w-4 ${variant === 'pillDark' ? 'text-white' : 'text-neutral-900'}`}
                aria-hidden="true"
              />
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
                  w-full flex items-center gap-2 px-3 py-2 text-left text-[13px]
                  transition-colors duration-150
                  ${
                    variant === 'pillDark'
                      ? isSelected
                        ? 'bg-white/10'
                        : 'hover:bg-white/8'
                      : isSelected
                        ? 'bg-neutral-100'
                        : 'hover:bg-neutral-100'
                  }
                  ${variant === 'pillDark' ? 'border-b border-white/10' : 'border-b border-neutral-200'} last:border-b-0
                `}
                role="option"
                aria-selected={isSelected}
              >
                <div className="flex flex-col flex-1 min-w-0">
                  <span
                    className={`truncate ${
                      variant === 'pillDark'
                        ? isSelected
                          ? 'font-semibold text-white'
                          : 'text-white/80'
                        : isSelected
                          ? 'font-semibold text-neutral-900'
                          : 'text-neutral-700'
                    }`}
                  >
                    {option.label}
                  </span>
                  <span
                    className={`text-[10px] uppercase tracking-wider ${
                      variant === 'pillDark' ? 'text-white/55' : 'text-neutral-500'
                    }`}
                  >
                    {option.provider}
                  </span>
                </div>
                {isSelected && (
                  <Check
                    className={`h-4 w-4 ${variant === 'pillDark' ? 'text-white' : 'text-neutral-900'}`}
                    aria-hidden="true"
                  />
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
