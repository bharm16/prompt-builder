import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

/**
 * ModeSelector Component - Horizontal tabs that collapse to dropdown on mobile
 *
 * Features:
 * - Horizontal tabs on desktop with icons + names
 * - Smooth transition animations between modes
 * - Collapses to dropdown on mobile
 * - Keyboard accessible
 * - Responsive design
 */
export default function ModeSelector({ modes, selectedMode, onModeChange, className = '' }) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const dropdownRef = useRef(null);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768); // md breakpoint
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handle clicks outside dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDropdown]);

  const currentMode = modes.find((m) => m.id === selectedMode) || modes[0];
  const CurrentIcon = currentMode.icon;

  const handleModeSelect = (modeId) => {
    onModeChange(modeId);
    setShowDropdown(false);
  };

  // Desktop: Horizontal Tabs
  if (!isMobile) {
    return (
      <div
        className={`flex items-center gap-2 overflow-x-auto scrollbar-hide px-2 ${className}`}
        role="tablist"
        aria-label="Prompt mode selector"
      >
        {modes.map((mode, index) => {
          const Icon = mode.icon;
          const isSelected = mode.id === selectedMode;

          return (
            <button
              key={mode.id}
              onClick={() => handleModeSelect(mode.id)}
              className={`
                group relative flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                font-medium text-sm whitespace-nowrap w-44
                transition-all duration-200
                focus-ring
                ${
                  isSelected
                    ? 'bg-primary-600 text-white shadow-md scale-105'
                    : 'bg-white text-neutral-700 hover:bg-neutral-50 border-2 border-neutral-200 hover:border-primary-300 hover:scale-102'
                }
              `}
              role="tab"
              aria-selected={isSelected}
              aria-controls={`mode-panel-${mode.id}`}
              tabIndex={isSelected ? 0 : -1}
              title={mode.description}
            >
              <Icon
                className={`h-4 w-4 transition-transform duration-200 ${isSelected ? 'text-white' : 'text-neutral-600'} group-hover:scale-110`}
                aria-hidden="true"
              />
              <span>{mode.name}</span>

              {/* Active indicator */}
              {isSelected && (
                <div
                  className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 w-2 h-2 bg-primary-600 rounded-full animate-pulse"
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>
    );
  }

  // Mobile: Dropdown
  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-white border-2 border-neutral-200 hover:border-primary-400 transition-colors duration-200 focus-ring"
        aria-haspopup="listbox"
        aria-expanded={showDropdown}
        aria-label={`Current mode: ${currentMode.name}. Click to change mode.`}
      >
        <div className="flex items-center gap-2">
          <CurrentIcon className="h-5 w-5 text-primary-600" aria-hidden="true" />
          <div className="text-left">
            <div className="text-sm font-semibold text-neutral-900">
              {currentMode.name}
            </div>
            <div className="text-xs text-neutral-600">
              {currentMode.description}
            </div>
          </div>
        </div>
        <ChevronDown
          className={`h-5 w-5 text-neutral-600 transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {showDropdown && (
        <div
          className="absolute top-full left-0 right-0 mt-2 z-dropdown max-h-[400px] overflow-y-auto bg-white rounded-lg border-2 border-neutral-200 shadow-xl animate-slide-down"
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
                  w-full flex items-start gap-3 px-4 py-3 text-left
                  transition-colors duration-150
                  ${isSelected ? 'bg-primary-50' : 'hover:bg-neutral-50'}
                  border-b border-neutral-100 last:border-b-0
                `}
                role="option"
                aria-selected={isSelected}
              >
                <Icon
                  className={`mt-0.5 h-5 w-5 flex-shrink-0 ${isSelected ? 'text-primary-600' : 'text-neutral-600'}`}
                  aria-hidden="true"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${isSelected ? 'text-primary-900' : 'text-neutral-900'}`}>
                      {mode.name}
                    </span>
                    {isSelected && (
                      <Check className="h-4 w-4 text-primary-600" aria-hidden="true" />
                    )}
                  </div>
                  <p className="text-xs text-neutral-600 mt-0.5">
                    {mode.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
