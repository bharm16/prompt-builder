/**
 * CameraMotionErrorBoundary Component
 *
 * Error boundary that catches Three.js errors and falls back to text mode.
 * Wraps the CameraMotionPicker to provide graceful degradation.
 *
 * @requirement 5.5 - Offer text-only camera motion selection as fallback
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface CameraMotionErrorBoundaryProps {
  /** Children to render */
  children: ReactNode;
  /** Callback when error occurs - triggers fallback mode */
  onError?: (error: Error) => void;
  /** Fallback content to render on error */
  fallback?: ReactNode;
}

interface CameraMotionErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// ============================================================================
// Component
// ============================================================================

/**
 * CameraMotionErrorBoundary - Catches Three.js errors and falls back to text mode
 *
 * This error boundary specifically handles errors from Three.js rendering
 * and provides a graceful fallback to text-only camera motion selection.
 */
export class CameraMotionErrorBoundary extends Component<
  CameraMotionErrorBoundaryProps,
  CameraMotionErrorBoundaryState
> {
  constructor(props: CameraMotionErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): CameraMotionErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error for debugging
    console.error('CameraMotionErrorBoundary caught an error:', error, errorInfo);

    // Notify parent component to enable fallback mode
    if (this.props.onError) {
      this.props.onError(error);
    }
  }

  /**
   * Reset the error boundary state
   */
  reset = (): void => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Render fallback content if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <div className="text-lg font-medium text-foreground mb-2">
            Preview Unavailable
          </div>
          <p className="text-sm text-muted mb-4">
            Camera motion previews couldn't be loaded. You can still select a camera motion below.
          </p>
          <button
            type="button"
            onClick={this.reset}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default CameraMotionErrorBoundary;
