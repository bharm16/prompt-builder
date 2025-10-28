/**
 * FeatureErrorBoundary - Feature-specific Error Boundary
 *
 * Catches errors in feature components but allows the rest of the app to continue
 * More graceful than crashing the entire application
 */

import React from 'react';
import { AlertCircle, X } from 'lucide-react';
import { ErrorBoundary } from './ErrorBoundary';

/**
 * Fallback component for feature errors
 */
export const FeatureErrorFallback = ({ error, errorInfo, resetError, featureName }) => {
  const [showDetails, setShowDetails] = React.useState(false);

  return (
    <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-red-900 mb-1">
            {featureName ? `${featureName} Error` : 'Feature Error'}
          </h3>
          <p className="text-sm text-red-700 mb-3">
            This feature encountered an error. The rest of the application should still work normally.
          </p>

          {/* Error details toggle */}
          {import.meta.env.MODE === 'development' && error && (
            <div className="mb-3">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-sm text-red-600 hover:text-red-800 underline"
              >
                {showDetails ? 'Hide' : 'Show'} Error Details
              </button>

              {showDetails && (
                <div className="mt-2 p-3 bg-white rounded border border-red-200">
                  <p className="text-xs font-mono text-red-600 mb-2">
                    {error.toString()}
                  </p>
                  {errorInfo && (
                    <pre className="text-xs text-gray-600 whitespace-pre-wrap overflow-auto max-h-32">
                      {errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={resetError}
              className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-1.5 text-sm bg-white text-red-600 border border-red-600 rounded hover:bg-red-50 transition-colors"
            >
              Reload Page
            </button>
          </div>
        </div>
        <button
          onClick={resetError}
          className="text-red-400 hover:text-red-600 transition-colors"
          aria-label="Dismiss error"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

/**
 * Feature Error Boundary Component
 */
export const FeatureErrorBoundary = ({ children, featureName, ...props }) => {
  return (
    <ErrorBoundary
      fallback={({ error, errorInfo, resetError }) => (
        <FeatureErrorFallback
          error={error}
          errorInfo={errorInfo}
          resetError={resetError}
          featureName={featureName}
        />
      )}
      {...props}
    >
      {children}
    </ErrorBoundary>
  );
};
