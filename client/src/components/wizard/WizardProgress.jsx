import React from 'react';
import PropTypes from 'prop-types';
import { Check } from 'lucide-react';
import { cn } from '../../utils/cn';

/**
 * WizardProgress Component - Enhanced Design
 *
 * Displays progress through the wizard with responsive behavior:
 * - Mobile: Simple linear progress bar with percentage
 * - Desktop: Full step indicator with icons and labels
 *
 * Features glassmorphism, animated progress bar, and enhanced accessibility
 */
const WizardProgress = ({
  currentStep,
  totalSteps,
  stepLabels,
  completedSteps,
  isMobile,
  onStepClick,
  minimal = false
}) => {
  const progress = ((currentStep + 1) / totalSteps) * 100;
  
  // Determine if a step can be clicked
  const canNavigate = (stepIndex) => {
    return completedSteps.includes(stepIndex) || stepIndex <= currentStep;
  };

  // Minimal mode - only show progress bar
  if (minimal && !isMobile) {
    return (
      <div 
        className="sticky top-0 z-10 bg-transparent"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-label={`${Math.round(progress)}% complete`}
      >
        <div className="w-full">
          <div 
            className="h-1 bg-gradient-to-r from-accent-500 to-accent-600 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-neutral-200/50 px-4 py-4 shadow-sm">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-sm font-semibold text-neutral-800">
            Step {currentStep + 1} of {totalSteps}
          </span>
          <span className="text-sm font-medium text-accent-600">{Math.round(progress)}%</span>
        </div>
        <div className="relative w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden">
          <div
            className="absolute left-0 top-0 h-full bg-gradient-to-r from-primary-500 to-accent-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin="0"
            aria-valuemax="100"
          />
        </div>
        {stepLabels[currentStep] && (
          <p className="mt-2.5 text-xs font-medium text-neutral-700 text-center">
            {stepLabels[currentStep]}
          </p>
        )}
      </div>
    );
  }

  // Desktop: Enhanced Full step indicator with glassmorphism
  return (
    <div 
      className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-neutral-200/50 shadow-sm"
      role="navigation"
      aria-label="Wizard progress"
    >
      <div className="max-w-5xl mx-auto px-8 py-6">
        {/* Animated Progress Bar */}
        <div 
          className="relative h-1.5 bg-neutral-100 rounded-full overflow-hidden mb-6"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin="0"
          aria-valuemax="100"
          aria-label={`${Math.round(progress)}% complete`}
        >
          <div 
            className="absolute left-0 top-0 h-full bg-gradient-to-r from-accent-500 to-accent-600 transition-all duration-500 ease-out rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
        
        {/* Percentage */}
        <div className="text-center mb-4">
          <span className="text-sm font-medium text-neutral-600">
            {Math.round(progress)}% Complete
          </span>
        </div>
        
        {/* Step Indicators */}
        <div className="flex items-start justify-between relative">
          {stepLabels.map((label, index) => {
            const isCompleted = completedSteps.includes(index);
            const isCurrent = index === currentStep;
            const isUpcoming = index > currentStep;
            const isClickable = canNavigate(index) && onStepClick;
            
            return (
              <div 
                key={index}
                className="flex flex-col items-center flex-1 relative"
              >
                {/* Step Circle */}
                <button
                  onClick={() => isClickable && onStepClick(index)}
                  disabled={!isClickable}
                  className={cn(
                    "flex items-center justify-center w-12 h-12 rounded-full transition-all duration-200",
                    "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-100",
                    
                    // Completed state
                    isCompleted && !isCurrent && "bg-emerald-500 text-white scale-95 hover:scale-100 cursor-pointer",
                    
                    // Current state
                    isCurrent && "bg-accent-600 text-white ring-4 ring-accent-100 scale-105 animate-pulse-subtle",
                    
                    // Upcoming state
                    isUpcoming && "bg-neutral-200 text-neutral-500 cursor-not-allowed",
                    
                    // Hover effect for clickable
                    isClickable && !isCurrent && "hover:shadow-md"
                  )}
                  aria-label={`${label}, ${
                    isCompleted ? 'completed' : isCurrent ? 'current step' : 'upcoming'
                  }`}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  {isCompleted && !isCurrent ? (
                    <Check 
                      className="w-6 h-6 animate-scale-in-bounce" 
                    />
                  ) : (
                    <span className="text-base font-semibold">
                      {index + 1}
                    </span>
                  )}
                </button>
                
                {/* Step Label */}
                <div className="mt-3 text-center">
                  <div className={cn(
                    "text-sm font-medium transition-colors duration-200",
                    isCurrent ? "text-neutral-900" : "text-neutral-600"
                  )}>
                    {label}
                  </div>
                </div>
                
                {/* Connecting Line (except for last step) */}
                {index < stepLabels.length - 1 && (
                  <div 
                    className="absolute top-6 left-1/2 w-full h-0.5 -z-10"
                    style={{ marginLeft: '24px', width: 'calc(100% - 48px)' }}
                  >
                    <div className={cn(
                      "h-full transition-colors duration-300",
                      index < currentStep ? "bg-emerald-500" : "bg-neutral-200"
                    )} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        {/* Screen Reader Announcement */}
        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          Step {currentStep + 1} of {totalSteps}: {stepLabels[currentStep]}
        </div>
      </div>
    </div>
  );
};

WizardProgress.propTypes = {
  currentStep: PropTypes.number.isRequired,
  totalSteps: PropTypes.number.isRequired,
  stepLabels: PropTypes.arrayOf(PropTypes.string).isRequired,
  completedSteps: PropTypes.arrayOf(PropTypes.number),
  isMobile: PropTypes.bool,
  onStepClick: PropTypes.func,
  minimal: PropTypes.bool
};

WizardProgress.defaultProps = {
  completedSteps: [],
  isMobile: false,
  onStepClick: null,
  minimal: false
};

export default WizardProgress;
