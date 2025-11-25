import React, { type ReactNode, type ComponentType } from 'react';
import * as Sentry from '@sentry/react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  eventId: string | null;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((props: FallbackProps) => ReactNode);
  title?: string;
  message?: string;
}

export interface FallbackProps {
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  resetError: () => void;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, eventId: null };
  }

  static getDerivedStateFromError(_error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error to console in development
    if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
      console.error('Error caught by boundary:', error, errorInfo);
    }

    // Capture error in Sentry with React component stack
    const eventId = Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
        },
      },
    });

    this.setState({
      error,
      errorInfo,
      eventId,
    });
  }

  handleReportFeedback = (): void => {
    if (this.state.eventId) {
      Sentry.showReportDialog({ eventId: this.state.eventId });
    }
  };

  handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null, eventId: null });
  };

  override render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback if provided
      if (this.props.fallback) {
        if (typeof this.props.fallback === 'function') {
          return this.props.fallback({
            error: this.state.error,
            errorInfo: this.state.errorInfo,
            resetError: this.handleReset,
          });
        }
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
              <svg
                className="w-6 h-6 text-red-600"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
              </svg>
            </div>

            <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">
              {this.props.title || 'Something went wrong'}
            </h1>

            <p className="text-gray-600 text-center mb-6">
              {this.props.message ||
                'We apologize for the inconvenience. The application encountered an unexpected error.'}
            </p>

            {(import.meta as { env?: { DEV?: boolean } }).env?.DEV && this.state.error && (
              <div className="mb-4 p-4 bg-gray-100 rounded text-sm">
                <p className="font-semibold text-gray-800 mb-2">Error Details:</p>
                <p className="text-red-600 font-mono text-xs break-all">{this.state.error.toString()}</p>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    window.location.href = '/';
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors"
                >
                  Go to Home
                </button>
                <button
                  onClick={() => {
                    window.location.reload();
                  }}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded transition-colors"
                >
                  Reload Page
                </button>
              </div>

              {this.state.eventId && (
                <button
                  onClick={this.handleReportFeedback}
                  className="w-full bg-white border-2 border-blue-600 text-blue-600 hover:bg-blue-50 font-medium py-2 px-4 rounded transition-colors"
                >
                  Report Feedback
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Higher-order component that wraps a component with an error boundary
 */
export const withErrorBoundary = <P extends object>(
  Component: ComponentType<P>,
  errorBoundaryProps: Partial<ErrorBoundaryProps> = {}
): ComponentType<P> => {
  const WrappedComponent = (props: P): React.ReactElement => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name || 'Component'})`;

  return WrappedComponent;
};

export default ErrorBoundary;

