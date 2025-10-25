import React from 'react';
import PropTypes from 'prop-types';
import { Check } from 'lucide-react';

/**
 * WizardProgress Component
 *
 * Displays progress through the wizard with responsive behavior:
 * - Mobile: Simple linear progress bar with percentage
 * - Desktop: Full step indicator with icons and labels
 *
 * Always visible (sticky header) to help users track their position
 */
const WizardProgress = ({
  currentStep,
  totalSteps,
  stepLabels,
  completedSteps,
  isMobile,
  onStepClick
}) => {
  const progress = ((currentStep + 1) / totalSteps) * 100;

  if (isMobile) {
    return (
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            Step {currentStep + 1} of {totalSteps}
          </span>
          <span className="text-sm text-gray-500">{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-indigo-600 h-2 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin="0"
            aria-valuemax="100"
          />
        </div>
        {stepLabels[currentStep] && (
          <p className="mt-2 text-xs text-gray-600 text-center">
            {stepLabels[currentStep]}
          </p>
        )}
      </div>
    );
  }

  // Desktop: Full step indicator
  return (
    <div className="sticky top-0 z-50 bg-white border-b border-gray-200 px-8 py-6">
      <nav aria-label="Progress">
        <ol className="flex items-center justify-between max-w-4xl mx-auto">
          {stepLabels.map((label, index) => {
            const isCompleted = completedSteps.includes(index);
            const isCurrent = index === currentStep;
            const isClickable = index < currentStep && onStepClick;

            return (
              <li key={index} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  {/* Step Circle */}
                  <button
                    onClick={() => isClickable && onStepClick(index)}
                    disabled={!isClickable}
                    className={`
                      flex items-center justify-center w-10 h-10 rounded-full border-2
                      transition-all duration-200 relative group
                      ${isCurrent
                        ? 'border-indigo-600 bg-indigo-600 text-white'
                        : isCompleted
                        ? 'border-green-600 bg-green-600 text-white'
                        : 'border-gray-300 bg-white text-gray-500'
                      }
                      ${isClickable
                        ? 'cursor-pointer hover:scale-110 hover:shadow-lg'
                        : 'cursor-default'
                      }
                    `}
                    aria-current={isCurrent ? 'step' : undefined}
                    aria-label={`${label}${isCompleted ? ' (completed)' : isCurrent ? ' (current)' : ''}`}
                  >
                    {isCompleted ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <span className="text-sm font-semibold">{index + 1}</span>
                    )}

                    {/* Tooltip on hover for clickable steps */}
                    {isClickable && (
                      <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2
                                    opacity-0 group-hover:opacity-100 transition-opacity
                                    bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
                        Go to {label}
                      </div>
                    )}
                  </button>

                  {/* Step Label */}
                  <span
                    className={`
                      mt-2 text-xs font-medium text-center max-w-[100px]
                      ${isCurrent
                        ? 'text-indigo-600'
                        : isCompleted
                        ? 'text-green-600'
                        : 'text-gray-500'
                      }
                    `}
                  >
                    {label}
                  </span>
                </div>

                {/* Connector Line */}
                {index < stepLabels.length - 1 && (
                  <div className="flex-1 h-0.5 mx-2 mt-[-2rem]">
                    <div
                      className={`
                        h-full transition-colors duration-300
                        ${isCompleted
                          ? 'bg-green-600'
                          : 'bg-gray-300'
                        }
                      `}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Progress Percentage */}
      <div className="mt-4 text-center">
        <span className="text-sm text-gray-600">
          Overall Progress: <span className="font-semibold text-indigo-600">{Math.round(progress)}%</span>
        </span>
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
  onStepClick: PropTypes.func
};

WizardProgress.defaultProps = {
  completedSteps: [],
  isMobile: false,
  onStepClick: null
};

export default WizardProgress;
