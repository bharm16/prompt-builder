import React from 'react';
import PropTypes from 'prop-types';
import { ArrowRight, Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

const SuggestionCards = ({
  suggestions = [],
  isLoading = false,
  onSelect,
  fieldName
}) => {
  if (isLoading) {
    return (
      <div className="space-y-3 animate-fade-in">
        <div className="flex items-center space-x-2 text-sm text-neutral-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Finding suggestions...</span>
        </div>
        
        {/* Skeleton loaders */}
        {[...Array(3)].map((_, i) => (
          <div 
            key={i}
            className="p-4 rounded-lg border-2 border-neutral-200 animate-pulse"
            style={{ animationDelay: `${i * 75}ms` }}
          >
            <div className="h-5 bg-neutral-200 rounded w-3/4" />
          </div>
        ))}
      </div>
    );
  }
  
  if (!suggestions.length) {
    return null;
  }
  
  return (
    <div className="space-y-3 animate-fade-in">
      {/* Header */}
      <p className="text-sm font-medium text-neutral-700">
        Need inspiration? Try one of these:
      </p>
      
      {/* Suggestion cards */}
      <div className="space-y-2">
        {suggestions.map((suggestion, index) => {
          const compatibilityColor = 
            suggestion.compatibility >= 80 ? 'emerald' :
            suggestion.compatibility >= 60 ? 'amber' :
            'rose';
          
          return (
            <button
              key={index}
              onClick={() => onSelect(suggestion)}
              className={cn(
                // Base styles
                "group relative w-full p-4 rounded-lg border-2 text-left",
                "transition-all duration-150",
                
                // Default state
                "border-neutral-200 bg-white",
                
                // Hover state
                "hover:border-accent-300 hover:bg-accent-50/50",
                "hover:shadow-md hover:-translate-y-0.5",
                
                // Focus state
                "focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2",
                
                // Active state
                "active:scale-[0.98]"
              )}
              style={{ animationDelay: `${index * 50}ms` }}
              aria-label={`Select suggestion: ${suggestion.text}`}
            >
              {/* Suggestion text */}
              <p className="text-base font-normal text-neutral-900 pr-8 leading-relaxed group-hover:text-accent-900 transition-colors">
                {suggestion.text}
              </p>
              
              {/* Compatibility badge */}
              {suggestion.compatibility !== undefined && (
                <div className="flex items-center space-x-1.5 mt-2.5">
                  <div className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    compatibilityColor === 'emerald' && "bg-emerald-500",
                    compatibilityColor === 'amber' && "bg-amber-500",
                    compatibilityColor === 'rose' && "bg-rose-500"
                  )} />
                  <span className="text-xs font-medium text-neutral-600">
                    {suggestion.compatibility}% model compatibility
                  </span>
                </div>
              )}
              
              {/* Arrow indicator (visible on hover) */}
              <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                <ArrowRight className="w-5 h-5 text-accent-600" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

SuggestionCards.propTypes = {
  suggestions: PropTypes.arrayOf(PropTypes.shape({
    text: PropTypes.string.isRequired,
    compatibility: PropTypes.number
  })),
  isLoading: PropTypes.bool,
  onSelect: PropTypes.func.isRequired,
  fieldName: PropTypes.string.isRequired
};

export default SuggestionCards;
