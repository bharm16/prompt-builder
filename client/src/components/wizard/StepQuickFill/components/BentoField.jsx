/**
 * BentoField - Enhanced bento box with visual polish
 * 
 * Features:
 * - Layered border technique (3 layers)
 * - Glassmorphic outline rings
 * - Very round corners (2rem)
 * - Utility-first with Tailwind classes
 * - Light theme adaptation
 * - Enhanced visuals: gradients, glows, patterns
 * 
 * @module BentoField
 */

import React from 'react';
import PropTypes from 'prop-types';
import { Check, ChevronDown, X } from 'lucide-react';
import BentoInput from './BentoInput';

/**
 * BentoField component
 */
export function BentoField({
  field,
  config,
  value,
  isExpanded,
  onExpand,
  onCollapse,
  onChange,
  onFocus,
  suggestions,
  isLoadingSuggestions,
  onRequestSuggestions,
  onSuggestionSelect,
  registerInputRef,
  mounted,
}) {
  const hasValue = value && value.length > 0;
  const isRequired = field.required;
  const bentoConfig = config;

  // Extract color scheme for visual enhancements
  const colorScheme = bentoConfig.colorScheme || {};
  const { gradient = {}, icon = {}, glow = '#60a5fa' } = colorScheme;

  // Truncate value for preview (max 40 chars)
  const previewValue = hasValue ? 
    (value.length > 40 ? value.substring(0, 40) + '...' : value) : 
    null;

  const handleBoxClick = () => {
    if (!isExpanded) {
      onExpand(field.id);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleBoxClick();
    }
  };

  // Build Tailwind classes for placement and corners
  const placementClasses = bentoConfig.placement || '';
  const cornerClasses = bentoConfig.cornerClasses || '';

  // Filled state classes
  const filledRingClass = hasValue ? 'ring-green-500/30' : 'ring-gray-900/10';
  const filledBgClass = hasValue ? 'bg-green-50/30' : 'bg-gray-50';

  return (
    <div
      className={`relative ${placementClasses} ${cornerClasses}`}
      style={{
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'scale(1)' : 'scale(0.95)',
        transitionDelay: `${field.delay}ms`,
        transition: 'all 400ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {!isExpanded ? (
        /* Collapsed State - Tailwind UI Visual Hierarchy */
        <>
          {/* Layer 1: Background */}
          <div className={`absolute inset-px rounded-lg ${filledBgClass} group-hover:bg-gray-100 transition-colors`} />
          
          {/* Pattern Background - Enhanced Visual */}
          <div 
            className="absolute inset-px rounded-lg pointer-events-none"
            style={{
              backgroundColor: '#DFDBE5',
              backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4' viewBox='0 0 4 4'%3E%3Cpath fill='%239C92AC' fill-opacity='0.4' d='M1 3h1v1H1V3zm2-2h1v1H3V1z'%3E%3C/path%3E%3C/svg%3E\")",
              opacity: 0.3,
              zIndex: 1
            }}
          />
          
          {/* Layer 2: Content */}
          <button
            type="button"
            className="relative flex h-full flex-col overflow-hidden rounded-[calc(theme(borderRadius.lg)+1px)] cursor-pointer group"
            style={{ zIndex: 2 }}
            onClick={handleBoxClick}
            onKeyDown={handleKeyDown}
            aria-expanded={false}
            aria-label={`${field.label}${isRequired ? ' (required)' : ' (optional)'}`}
          >
            <div className="flex h-full flex-col overflow-hidden px-8 pb-10 pt-8 sm:px-10 sm:pb-10 sm:pt-10">
              {/* Header Section: Icon + Title - AT TOP */}
              <div className="flex items-center gap-x-3">
                {/* Enhanced Icon with Glow */}
                <div className="relative inline-block">
                  {/* Glow effect */}
                  {glow && (
                    <div 
                      className="absolute -inset-2 blur-2xl rounded-xl transition-opacity duration-300"
                      style={{ 
                        backgroundColor: glow,
                        opacity: 0.4
                      }}
                    />
                  )}
                  {/* Icon container with gradient */}
                  <div 
                    className="relative flex items-center justify-center transition-all duration-300 group-hover:scale-110"
                    style={{
                      color: icon.from && icon.to 
                        ? '#ffffff'
                        : bentoConfig.iconColor,
                      filter: bentoConfig.iconFilter || 'none',
                      background: icon.from && icon.to 
                        ? `linear-gradient(135deg, ${icon.from}, ${icon.to})`
                        : 'transparent',
                      padding: icon.from && icon.to ? '12px' : '0',
                      borderRadius: icon.from && icon.to ? '12px' : '0',
                    }}
                  >
                    {React.createElement(bentoConfig.icon, {
                      size: bentoConfig.iconSize,
                      strokeWidth: bentoConfig.iconStrokeWidth,
                    })}
                  </div>
                </div>
                <h3 className="text-lg/7 font-medium tracking-tight text-gray-900">
                  {field.label}
                  {isRequired && (
                    <span className="text-indigo-600"> *</span>
                  )}
                </h3>
                {hasValue && (
                  <Check 
                    size={18} 
                    className="ml-auto text-green-600"
                  />
                )}
              </div>
              
              {/* Description Section - BELOW HEADER */}
              <p className="mt-2 max-w-lg text-sm/6 text-gray-600">
                {bentoConfig.description}
              </p>
              
              {/* Visual Content Section - PUSHED TO BOTTOM */}
              <div className="mt-10 flex flex-1 items-end">
                {hasValue ? (
                  <div className="w-full">
                    <div 
                      className="bg-white/50 backdrop-blur-sm rounded-xl ring-1 ring-gray-900/5 p-6"
                      style={{
                        background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)'
                      }}
                    >
                      <p className={`${bentoConfig.size === 'hero' ? 'text-base leading-relaxed' : bentoConfig.size === 'large' ? 'text-xl font-semibold' : 'text-lg'} text-gray-900`}>
                        {previewValue}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="w-full text-center pb-6">
                    <ChevronDown 
                      size={24} 
                      className="mx-auto text-gray-400 opacity-40 group-hover:opacity-60 group-hover:translate-y-0.5 transition-all"
                    />
                    <p className="mt-3 text-sm italic text-gray-400">
                      {isRequired ? 'Tap to fill' : 'Optional'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </button>
          
          {/* Layer 3: Outline ring */}
          <div className={`pointer-events-none absolute inset-px rounded-lg shadow-sm ring-1 ${filledRingClass}`} />
        </>
      ) : (
        /* Expanded State */
        <>
          {/* Layer 1: Background */}
          <div className="absolute inset-px rounded-lg bg-white" />
          
          {/* Layer 2: Content */}
          <div className="relative flex h-full flex-col overflow-hidden rounded-[calc(theme(borderRadius.lg)+1px)]">
            <div className="px-8 pt-8 sm:px-10 sm:pt-10">
              {/* Header with close button */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  {/* Enhanced Icon with Glow - Expanded State */}
                  <div className="relative inline-block">
                    {/* Glow effect */}
                    {glow && (
                      <div 
                        className="absolute -inset-2 blur-2xl rounded-xl"
                        style={{ 
                          backgroundColor: glow,
                          opacity: 0.4
                        }}
                      />
                    )}
                    {/* Icon container with gradient */}
                    <div 
                      className="relative flex items-center justify-center transition-all duration-300"
                      style={{
                        color: icon.from && icon.to 
                          ? '#ffffff'
                          : bentoConfig.iconColor,
                        background: icon.from && icon.to 
                          ? `linear-gradient(135deg, ${icon.from}, ${icon.to})`
                          : 'transparent',
                        padding: icon.from && icon.to ? '12px' : '0',
                        borderRadius: icon.from && icon.to ? '12px' : '0',
                      }}
                    >
                      {React.createElement(bentoConfig.icon, {
                        size: bentoConfig.iconSize,
                        strokeWidth: bentoConfig.iconStrokeWidth,
                      })}
                    </div>
                  </div>
                  <span className="text-xl font-semibold text-gray-900">
                    {field.label}
                    {isRequired && (
                      <span className="text-indigo-600"> *</span>
                    )}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onCollapse}
                  className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
                  aria-label="Close"
                >
                  <X size={20} className="text-gray-600" />
                </button>
              </div>

              {/* Input area */}
              <BentoInput
                field={field}
                value={value}
                onChange={onChange}
                onFocus={onFocus}
                suggestions={suggestions}
                isLoadingSuggestions={isLoadingSuggestions}
                onSuggestionSelect={onSuggestionSelect}
                registerInputRef={registerInputRef}
                accentColor={bentoConfig.iconColor}
              />
            </div>
          </div>
          
          {/* Layer 3: Outline ring */}
          <div className="pointer-events-none absolute inset-px rounded-lg shadow-sm ring-1 ring-indigo-500/30" />
        </>
      )}
    </div>
  );
}

BentoField.propTypes = {
  field: PropTypes.shape({
    id: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    description: PropTypes.string,
    placeholder: PropTypes.string,
    required: PropTypes.bool,
    delay: PropTypes.number,
  }).isRequired,
  config: PropTypes.object.isRequired,
  value: PropTypes.string,
  isExpanded: PropTypes.bool.isRequired,
  onExpand: PropTypes.func.isRequired,
  onCollapse: PropTypes.func.isRequired,
  onChange: PropTypes.func.isRequired,
  onFocus: PropTypes.func.isRequired,
  suggestions: PropTypes.array,
  isLoadingSuggestions: PropTypes.bool,
  onRequestSuggestions: PropTypes.func.isRequired,
  onSuggestionSelect: PropTypes.func.isRequired,
  registerInputRef: PropTypes.func.isRequired,
  mounted: PropTypes.bool,
};

export default BentoField;
