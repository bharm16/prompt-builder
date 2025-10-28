import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { ArrowRight, Film } from 'lucide-react';
import EnhancedInput from './EnhancedInput';
import SuggestionCards from './SuggestionCards';
import { cn } from '../../utils/cn';

/**
 * StepCreativeBrief Component - Enhanced Design
 * 
 * Conversational, Airbnb DLS-inspired interface for collecting creative brief information
 * Uses EnhancedInput and SuggestionCards for a polished user experience
 */
const StepCreativeBriefEnhanced = ({
  formData,
  onChange,
  onNext,
  suggestions = {},
  isLoadingSuggestions = {},
  onRequestSuggestions,
  validationErrors = {}
}) => {
  const [touched, setTouched] = useState({});
  const [suggestionTimers, setSuggestionTimers] = useState({});

  // Field configuration with conversational labels
  const requiredFields = [
    {
      name: 'subject',
      label: "First, what's the main focus of your video?",
      description: "This could be a person, object, animal, or anything else",
      placeholder: "e.g., A professional athlete",
      successMessage: "Perfect! That's a great starting point."
    },
    {
      name: 'action',
      label: "Got it. What's the subject doing?",
      description: "Describe the movement, activity, or transformation",
      placeholder: "e.g., running through",
      successMessage: "Excellent! I can picture it already."
    },
    {
      name: 'location',
      label: "And where is all this happening?",
      description: "Describe the setting or environment",
      placeholder: "e.g., a sun-drenched beach",
      successMessage: "Great! Now we're building a scene."
    }
  ];
  
  const optionalFields = [
    {
      name: 'time',
      label: "When does this happen?",
      description: "Time of day, season, era, or temporal context",
      placeholder: "e.g., at golden hour",
      successMessage: "Nice! That adds atmosphere."
    },
    {
      name: 'mood',
      label: "What's the emotional tone?",
      description: "The feeling or atmosphere you want to convey",
      placeholder: "e.g., energetic and inspiring",
      successMessage: "Perfect! That sets the vibe."
    },
    {
      name: 'style',
      label: "Any particular visual style?",
      description: "Cinematic approach, art style, or aesthetic",
      placeholder: "e.g., cinematic with warm tones",
      successMessage: "Love it! That'll look great."
    },
    {
      name: 'event',
      label: "Is there a specific event or moment?",
      description: "Special occurrence, celebration, or key moment",
      placeholder: "e.g., celebrating a victory",
      successMessage: "Fantastic! That adds drama."
    }
  ];
  
  // Check if all required fields are valid
  const allRequiredValid = requiredFields.every(field => 
    formData[field.name] && formData[field.name].length >= 3
  );
  
  // Validate field
  const validateField = (fieldName, value) => {
    if (!value || value.length < 3) {
      return false;
    }
    return true;
  };

  // Handle field change with debounced suggestion requests
  const handleFieldChange = (fieldName) => (e) => {
    const value = e.target.value;
    onChange({ [fieldName]: value });
    
    // Mark as touched
    setTouched(prev => ({ ...prev, [fieldName]: true }));
    
    // Request suggestions after a short delay
    if (value.length >= 3) {
      // Clear existing timer
      if (suggestionTimers[fieldName]) {
        clearTimeout(suggestionTimers[fieldName]);
      }
      
      // Set new timer
      const timer = setTimeout(() => {
        onRequestSuggestions(fieldName, value);
      }, 300);
      
      setSuggestionTimers(prev => ({ ...prev, [fieldName]: timer }));
    }
  };
  
  // Handle suggestion selection
  const handleSuggestionSelect = (fieldName) => (suggestion) => {
    onChange({ [fieldName]: suggestion.text });
    setTouched(prev => ({ ...prev, [fieldName]: true }));
  };
  
  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      Object.values(suggestionTimers).forEach(timer => clearTimeout(timer));
    };
  }, [suggestionTimers]);
  
  return (
    <div className="max-w-5xl mx-auto px-8 py-12 animate-fade-slide-in">
      <div className="space-y-10">
        {/* Hero Header */}
        <div className="space-y-3 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start space-x-3 mb-4">
            <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-accent-100">
              <Film className="w-7 h-7 text-accent-600" />
            </div>
            <h2 className="text-3xl font-bold text-neutral-900 tracking-tight">
              Let's start with the big idea
            </h2>
          </div>
          <p className="text-lg text-neutral-600 leading-relaxed max-w-3xl">
            Tell us about the video you want to create. We'll help you craft 
            the perfect prompt for AI video generation.
          </p>
        </div>
        
        {/* Required Fields Section */}
        <div className="space-y-8">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-neutral-700 uppercase tracking-wide">
              The Essentials
            </h3>
            <p className="text-sm text-neutral-600">
              These three elements form the foundation of your video
            </p>
          </div>
          
          {requiredFields.map((field, index) => (
            <div 
              key={field.name}
              className="space-y-3 animate-fade-slide-in"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <EnhancedInput
                name={field.name}
                value={formData[field.name] || ''}
                onChange={handleFieldChange(field.name)}
                label={field.label}
                description={field.description}
                placeholder={field.placeholder}
                required
                error={touched[field.name] && validationErrors[field.name]}
                onValidate={(value) => validateField(field.name, value)}
                successMessage={field.successMessage}
                autoFocus={index === 0}
              />
              
              {/* Suggestions */}
              {formData[field.name] && formData[field.name].length >= 3 && (
                <SuggestionCards
                  suggestions={suggestions[field.name] || []}
                  isLoading={isLoadingSuggestions[field.name]}
                  onSelect={handleSuggestionSelect(field.name)}
                  fieldName={field.name}
                />
              )}
            </div>
          ))}
        </div>
        
        {/* Optional Fields Section */}
        <div className="pt-6 border-t border-neutral-200">
          <div className="space-y-8">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-neutral-700 uppercase tracking-wide">
                The Creative Details
                <span className="ml-2 text-xs font-normal text-neutral-500 normal-case">
                  (Optional, but recommended)
                </span>
              </h3>
              <p className="text-sm text-neutral-600">
                Add these to bring your concept to life with atmosphere and style
              </p>
            </div>
            
            {optionalFields.map((field, index) => (
              <div 
                key={field.name}
                className="space-y-3 animate-fade-slide-in"
                style={{ animationDelay: `${(index + 3) * 100}ms` }}
              >
                <EnhancedInput
                  name={field.name}
                  value={formData[field.name] || ''}
                  onChange={handleFieldChange(field.name)}
                  label={field.label}
                  description={field.description}
                  placeholder={field.placeholder}
                  onValidate={(value) => validateField(field.name, value)}
                  successMessage={field.successMessage}
                />
                
                {/* Suggestions */}
                {formData[field.name] && formData[field.name].length >= 3 && (
                  <SuggestionCards
                    suggestions={suggestions[field.name] || []}
                    isLoading={isLoadingSuggestions[field.name]}
                    onSelect={handleSuggestionSelect(field.name)}
                    fieldName={field.name}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
        
        {/* Navigation */}
        <div className="flex items-center justify-end pt-8 border-t border-neutral-200">
          <button
            onClick={onNext}
            disabled={!allRequiredValid}
            className={cn(
              "inline-flex items-center justify-center gap-2",
              "px-8 py-3.5 rounded-xl",
              "text-base font-semibold",
              "transition-all duration-150",
              
              // Enabled state
              allRequiredValid && [
                "bg-gradient-to-br from-accent-600 to-accent-700",
                "text-white shadow-md shadow-accent-500/30",
                "hover:shadow-lg hover:shadow-accent-500/40",
                "hover:-translate-y-0.5",
                "active:scale-[0.98]",
                "focus-visible:outline-none focus-visible:ring-2",
                "focus-visible:ring-accent-500 focus-visible:ring-offset-2"
              ],
              
              // Disabled state
              !allRequiredValid && [
                "bg-neutral-200 text-neutral-500",
                "cursor-not-allowed"
              ]
            )}
          >
            <span>Continue</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

StepCreativeBriefEnhanced.propTypes = {
  formData: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  onNext: PropTypes.func.isRequired,
  suggestions: PropTypes.object,
  isLoadingSuggestions: PropTypes.object,
  onRequestSuggestions: PropTypes.func.isRequired,
  validationErrors: PropTypes.object
};

export default StepCreativeBriefEnhanced;
