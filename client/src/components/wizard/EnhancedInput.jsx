import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '../../utils/cn';

const EnhancedInput = ({
  name,
  value,
  onChange,
  label,
  description,
  placeholder,
  required = false,
  error = null,
  onValidate = null,
  successMessage = "Perfect! That's a great starting point.",
  autoFocus = false
}) => {
  const [isTouched, setIsTouched] = useState(false);
  const [isValid, setIsValid] = useState(false);
  
  // Validate on value change
  useEffect(() => {
    if (isTouched && value) {
      const validation = onValidate ? onValidate(value) : value.length >= 3;
      setIsValid(validation);
    }
  }, [value, isTouched, onValidate]);
  
  const handleBlur = () => {
    setIsTouched(true);
  };
  
  const showError = isTouched && error;
  const showSuccess = isTouched && isValid && !error && value;
  
  return (
    <div className="space-y-2 animate-fade-in">
      {/* Conversational Label */}
      <label 
        htmlFor={name}
        className="block"
      >
        <span className="text-base font-medium text-neutral-800 leading-relaxed">
          {label}
          {required && (
            <span className="text-error-500 ml-1" aria-label="required">*</span>
          )}
        </span>
        
        {description && (
          <span className="block text-sm text-neutral-600 mt-1.5 font-normal leading-relaxed">
            {description}
          </span>
        )}
      </label>
      
      {/* Input Container */}
      <div className="relative">
        <input
          id={name}
          name={name}
          type="text"
          value={value}
          onChange={onChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          required={required}
          autoFocus={autoFocus}
          aria-invalid={showError ? 'true' : 'false'}
          aria-describedby={
            showError ? `${name}-error` : 
            showSuccess ? `${name}-success` : 
            description ? `${name}-description` : 
            undefined
          }
          className={cn(
            // Base styles
            "w-full px-4 py-3.5 text-base rounded-xl",
            "border-2 transition-all duration-150",
            "placeholder:text-neutral-400",
            
            // Focus styles
            "focus:outline-none focus:ring-4",
            
            // States
            showError && [
              "border-error-300 bg-error-50/30",
              "focus:border-error-500 focus:ring-error-100"
            ],
            
            showSuccess && [
              "border-emerald-300 bg-emerald-50/30",
              "focus:border-emerald-500 focus:ring-emerald-100"
            ],
            
            !showError && !showSuccess && [
              "border-neutral-200 bg-white",
              "hover:border-neutral-300",
              "focus:border-accent-500 focus:ring-accent-100 focus:shadow-sm focus:shadow-accent-100"
            ]
          )}
        />
        
        {/* Success Icon */}
        {showSuccess && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 animate-scale-in-bounce">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
          </div>
        )}
      </div>
      
      {/* Error Message */}
      {showError && (
        <div 
          id={`${name}-error`}
          role="alert"
          className="flex items-start space-x-2 animate-slide-from-right"
        >
          <AlertCircle className="w-4 h-4 text-error-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-error-600 leading-relaxed">
            {error}
          </p>
        </div>
      )}
      
      {/* Success Message */}
      {showSuccess && successMessage && (
        <div 
          id={`${name}-success`}
          role="status"
          className="animate-fade-in"
        >
          <p className="text-sm text-emerald-600 leading-relaxed">
            {successMessage}
          </p>
        </div>
      )}
    </div>
  );
};

EnhancedInput.propTypes = {
  name: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  label: PropTypes.string.isRequired,
  description: PropTypes.string,
  placeholder: PropTypes.string,
  required: PropTypes.bool,
  error: PropTypes.string,
  onValidate: PropTypes.func,
  successMessage: PropTypes.string,
  autoFocus: PropTypes.bool
};

export default EnhancedInput;
