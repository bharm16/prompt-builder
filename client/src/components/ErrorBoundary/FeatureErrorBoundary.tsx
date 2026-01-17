import React, { type ReactNode } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { Button } from '@promptstudio/system/components/ui/button';
import { ErrorBoundary, type FallbackProps } from './ErrorBoundary';

interface FeatureErrorFallbackProps {
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  resetError: () => void;
  featureName?: string | undefined;
}

/**
 * Fallback component for feature errors
 */
export const FeatureErrorFallback = ({
  error,
  errorInfo,
  resetError,
  featureName,
}: FeatureErrorFallbackProps): React.ReactElement => {
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
          {(import.meta as { env?: { MODE?: string } }).env?.MODE === 'development' && error && (
            <div className="mb-3">
              <Button
                onClick={() => setShowDetails(!showDetails)}
                variant="link"
                className="h-auto p-0 text-sm text-red-600 hover:text-red-800 underline"
              >
                {showDetails ? 'Hide' : 'Show'} Error Details
              </Button>

              {showDetails && (
                <div className="mt-2 p-3 bg-white rounded border border-red-200">
                  <p className="text-xs font-mono text-red-600 mb-2">{error.toString()}</p>
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
            <Button
              onClick={resetError}
              variant="ghost"
              className="px-3 py-1.5 text-sm bg-red-600 text-white rounded transition-colors hover:bg-red-700"
            >
              Retry
            </Button>
            <Button
              onClick={() => {
                window.location.reload();
              }}
              variant="ghost"
              className="px-3 py-1.5 text-sm bg-white text-red-600 border border-red-600 rounded transition-colors hover:bg-red-50"
            >
              Reload Page
            </Button>
          </div>
        </div>
        <Button
          onClick={resetError}
          variant="ghost"
          size="icon"
          className="text-red-400 transition-colors hover:text-red-600"
          aria-label="Dismiss error"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

interface FeatureErrorBoundaryProps {
  children: ReactNode;
  featureName?: string;
  fallback?: ReactNode | ((props: FallbackProps) => ReactNode);
  title?: string;
  message?: string;
}

/**
 * Feature Error Boundary Component
 */
export const FeatureErrorBoundary = ({
  children,
  featureName,
  ...props
}: FeatureErrorBoundaryProps): React.ReactElement => {
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
