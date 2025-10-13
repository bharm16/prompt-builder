import React from 'react';
import {
  Sparkles,
  FileText,
  Search,
  Clock,
  Lightbulb,
  TrendingUp,
  Zap,
  Coffee,
  Inbox,
} from 'lucide-react';

/**
 * EmptyState Component - Reusable empty state with illustrations
 *
 * Variants:
 * - history: No history items
 * - search: No search results
 * - welcome: First-time user welcome
 * - error: Error state
 * - loading: Loading state placeholder
 * - custom: Custom message with icon
 */

const emptyStateConfig = {
  history: {
    icon: Clock,
    title: 'No prompts yet',
    description: 'Your optimized prompts will appear here',
    tips: [
      'Try optimizing your first prompt above',
      'Prompts are saved automatically',
      'Sign in to sync across devices',
    ],
  },
  search: {
    icon: Search,
    title: 'No results found',
    description: 'Try adjusting your search terms',
    tips: ['Check your spelling', 'Try different keywords', 'Use fewer filters'],
  },
  welcome: {
    icon: Sparkles,
    title: 'Welcome to Prompt Builder',
    description: 'Transform your ideas into powerful AI prompts',
    tips: [
      'Start by typing your idea in the input above',
      'Choose a prompt mode that fits your needs',
      'Let AI optimize it into a detailed prompt',
    ],
  },
  error: {
    icon: Zap,
    title: 'Something went wrong',
    description: "We couldn't load your data",
    tips: ['Check your internet connection', 'Refresh the page', 'Try again later'],
  },
  noInput: {
    icon: FileText,
    title: 'Start typing to begin',
    description: 'Enter your prompt idea to get started',
    tips: [
      'Describe what you want to achieve',
      "Don't worry about being perfect - we'll optimize it",
      'Try one of the quick actions below',
    ],
  },
  loading: {
    icon: Coffee,
    title: 'Loading...',
    description: 'Just a moment while we fetch your data',
    tips: [],
  },
  success: {
    icon: TrendingUp,
    title: "You're all set!",
    description: 'Everything is working perfectly',
    tips: [],
  },
  inbox: {
    icon: Inbox,
    title: 'Nothing here',
    description: 'This section is empty',
    tips: [],
  },
};

export default function EmptyState({
  variant = 'history',
  icon: CustomIcon = null,
  title = null,
  description = null,
  tips = null,
  action = null,
  className = '',
}) {
  const config = emptyStateConfig[variant] || emptyStateConfig.inbox;
  const Icon = CustomIcon || config.icon;
  const displayTitle = title || config.title;
  const displayDescription = description || config.description;
  const displayTips = tips || config.tips;

  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center ${className}`}
      role="status"
      aria-live="polite"
    >
      {/* Animated Icon */}
      <div className="mb-6 relative">
        {/* Background decoration */}
        <div
          className="absolute inset-0 bg-gradient-to-br from-primary-100 to-secondary-100 rounded-full blur-xl opacity-50"
          aria-hidden="true"
        />

        {/* Icon container */}
        <div className="relative flex items-center justify-center w-20 h-20 bg-gradient-to-br from-primary-50 to-secondary-50 rounded-full border-2 border-primary-200 animate-fade-in">
          <Icon
            className="h-10 w-10 text-primary-600 animate-pulse"
            aria-hidden="true"
          />
        </div>

        {/* Floating sparkles decoration */}
        <div className="absolute -top-2 -right-2 w-4 h-4 bg-yellow-400 rounded-full animate-bounce" aria-hidden="true" />
        <div className="absolute -bottom-2 -left-2 w-3 h-3 bg-blue-400 rounded-full animate-bounce animation-delay-200" aria-hidden="true" />
      </div>

      {/* Title */}
      <h3 className="text-xl font-bold text-neutral-900 mb-2">
        {displayTitle}
      </h3>

      {/* Description */}
      <p className="text-neutral-600 mb-6 max-w-md">
        {displayDescription}
      </p>

      {/* Tips */}
      {displayTips && displayTips.length > 0 && (
        <div className="w-full max-w-md mb-6">
          <div className="text-left bg-white rounded-lg border-2 border-neutral-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="h-4 w-4 text-primary-600" aria-hidden="true" />
              <span className="text-sm font-semibold text-neutral-700">
                Tips to get started:
              </span>
            </div>
            <ul className="space-y-2">
              {displayTips.map((tip, index) => (
                <li
                  key={index}
                  className="flex items-start gap-2 text-sm text-neutral-600"
                >
                  <span
                    className="flex-shrink-0 w-5 h-5 flex items-center justify-center bg-primary-100 text-primary-600 rounded-full text-xs font-semibold mt-0.5"
                    aria-hidden="true"
                  >
                    {index + 1}
                  </span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Action Button */}
      {action && (
        <button
          onClick={action.onClick}
          className="btn-primary animate-fade-in"
          aria-label={action.label}
        >
          {action.icon && <action.icon className="h-4 w-4" aria-hidden="true" />}
          <span>{action.label}</span>
        </button>
      )}
    </div>
  );
}

// Specialized empty state variants for common use cases

export function HistoryEmptyState({ onCreateNew }) {
  return (
    <div className="p-4 text-center">
      {/* Empty state - no content when there's no history */}
    </div>
  );
}

export function SearchEmptyState({ searchQuery, onClearSearch }) {
  return (
    <EmptyState
      variant="search"
      description={
        searchQuery
          ? `No results found for "${searchQuery}"`
          : 'Try adjusting your search terms'
      }
      action={
        onClearSearch
          ? {
              label: 'Clear search',
              onClick: onClearSearch,
            }
          : null
      }
    />
  );
}

export function WelcomeEmptyState({ onGetStarted }) {
  return (
    <EmptyState
      variant="welcome"
      action={
        onGetStarted
          ? {
              label: 'Get started',
              icon: Sparkles,
              onClick: onGetStarted,
            }
          : null
      }
    />
  );
}

export function ErrorEmptyState({ onRetry, errorMessage }) {
  return (
    <EmptyState
      variant="error"
      description={errorMessage || "We couldn't load your data"}
      action={
        onRetry
          ? {
              label: 'Try again',
              icon: Zap,
              onClick: onRetry,
            }
          : null
      }
    />
  );
}

export function LoadingEmptyState({ message = 'Loading...' }) {
  return (
    <EmptyState
      variant="loading"
      description={message}
      tips={[]}
    />
  );
}
