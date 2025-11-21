import React, { useState } from 'react';
import { Save, X } from 'lucide-react';

/**
 * SavedDraftBanner Component
 * 
 * Displays a prominent banner when a saved draft is detected,
 * offering users the choice to continue or start fresh.
 */
export function SavedDraftBanner({ onContinue, onStartFresh }) {
  const [isExiting, setIsExiting] = useState(false);

  const handleContinue = () => {
    setIsExiting(true);
    setTimeout(onContinue, 200); // Match animation duration
  };

  const handleStartFresh = () => {
    setIsExiting(true);
    setTimeout(onStartFresh, 200); // Match animation duration
  };

  return (
    <div
      className={`
        banner-slide-down
        ${isExiting ? 'banner-slide-up' : ''}
      `}
      role="alert"
      aria-live="polite"
      aria-label="Saved draft notification"
    >
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b-2 border-blue-200 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {/* Icon and Message */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-blue-100">
                <Save className="h-5 w-5 text-blue-600" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-blue-900">
                  We found a saved draft from your previous session
                </p>
                <p className="text-xs text-blue-700 mt-0.5">
                  Would you like to continue where you left off?
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <button
                onClick={handleContinue}
                className="
                  px-4 py-2 rounded-lg font-medium text-sm
                  bg-blue-600 text-white
                  hover:bg-blue-700 active:bg-blue-800
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                  transition-colors duration-150
                  shadow-sm hover:shadow
                "
                aria-label="Continue with saved draft"
              >
                Continue Where I Left Off
              </button>
              <button
                onClick={handleStartFresh}
                className="
                  px-4 py-2 rounded-lg font-medium text-sm
                  bg-white text-blue-700 border-2 border-blue-200
                  hover:bg-blue-50 hover:border-blue-300 active:bg-blue-100
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                  transition-colors duration-150
                "
                aria-label="Start with a fresh draft"
              >
                Start Fresh
              </button>
              <button
                onClick={handleStartFresh}
                className="
                  p-2 rounded-lg
                  text-blue-600 hover:text-blue-800
                  hover:bg-blue-100 active:bg-blue-200
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                  transition-colors duration-150
                "
                aria-label="Dismiss notification"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SavedDraftBanner;

