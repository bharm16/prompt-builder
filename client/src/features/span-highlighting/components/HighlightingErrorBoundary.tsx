/**
 * Highlighting Error Boundary
 * 
 * Specialized error boundary for span highlighting features.
 * Prevents highlighting errors from crashing the entire editor.
 * Provides graceful degradation - editor continues working even if highlighting fails.
 */

import React, { type ReactNode } from 'react';
import { ErrorBoundary, type FallbackProps } from '@components/ErrorBoundary/ErrorBoundary';
import { spanLabelingCache } from '../services/index.ts';

export interface HighlightingErrorBoundaryProps {
  children: ReactNode;
}

/**
 * Error boundary wrapper for highlighting features
 * Clears cache on reset to recover from corrupt data
 */
export function HighlightingErrorBoundary({ children }: HighlightingErrorBoundaryProps): React.ReactElement {
  const handleReset = (): void => {
    // Clear highlighting cache on error reset to recover from corrupt data
    try {
      if (spanLabelingCache) {
        spanLabelingCache.clear();
        console.log('[HighlightingErrorBoundary] Cache cleared after error');
      }
    } catch (error) {
      console.error('[HighlightingErrorBoundary] Failed to clear cache:', error);
    }
  };
  
  return (
    <ErrorBoundary
      title="Highlighting temporarily unavailable"
      message="Text highlighting has encountered an issue. Your content is safe and you can continue editing."
      fallback={({ error, resetError }: FallbackProps) => (
        <div className="highlighting-error p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <div className="flex items-start gap-2">
            <svg 
              className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
              />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-yellow-800">
                Highlighting is temporarily disabled
              </p>
              <p className="text-sm text-yellow-700 mt-1">
                Your work is saved. You can continue editing without highlighting.
              </p>
              
              {/* Show error details in development */}
              {import.meta.env.DEV && error && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-yellow-600 hover:text-yellow-700">
                    Error details (dev only)
                  </summary>
                  <pre className="mt-1 text-xs bg-yellow-100 p-2 rounded overflow-auto max-h-32">
                    {error.toString()}
                  </pre>
                </details>
              )}
              
              <button
                onClick={() => {
                  handleReset();
                  resetError();
                }}
                className="mt-2 text-sm text-yellow-700 underline hover:text-yellow-800 hover:no-underline"
              >
                Re-enable highlighting
              </button>
            </div>
          </div>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}

export default HighlightingErrorBoundary;
