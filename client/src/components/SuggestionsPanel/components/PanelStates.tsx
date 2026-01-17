/**
 * PanelStates Components
 *
 * Loading, Empty, and Inactive state components for SuggestionsPanel.
 * Following VideoConceptBuilder pattern: components/ConflictsAlert.tsx
 */

import { Info, type LucideIcon } from 'lucide-react';
import { Button } from '@promptstudio/system/components/ui/button';
import { getLoadingSkeletonCount } from '../utils/suggestionHelpers';
import type { EmptyStateConfig, ErrorStateConfig, InactiveStateConfig } from './types';

// ===========================
// LOADING STATE
// ===========================

interface LoadingStateProps {
  contextValue?: string;
  selectedText?: string;
  isPlaceholder?: boolean;
}

export function LoadingState({
  contextValue = '',
  selectedText = '',
  isPlaceholder = false,
}: LoadingStateProps): React.ReactElement {
  const textLength = contextValue?.length || selectedText?.length || 0;
  const skeletonCount = getLoadingSkeletonCount(textLength, isPlaceholder);

  return (
    <div className="px-3 py-3 space-y-2" role="status" aria-live="polite">
      {Array.from({ length: skeletonCount }).map((_, i) => (
        <div
          key={i}
          className="relative overflow-hidden px-3 py-2 bg-surface-1 border border-border rounded-md animate-pulse"
          style={{ animationDelay: `${i * 75}ms`, animationDuration: '1.5s' }}
        >
          <div className="space-y-1">
            <div
              className={`h-3 bg-surface-2 rounded-md ${
                i % 4 === 0 ? 'w-3/4' : i % 4 === 1 ? 'w-2/3' : i % 4 === 2 ? 'w-4/5' : 'w-5/6'
              }`}
            />
            {isPlaceholder ? (
              <>
                <div className={`h-2.5 bg-surface-2 rounded-md ${i % 2 === 0 ? 'w-full' : 'w-11/12'}`} />
                <div className={`h-2.5 bg-surface-2 rounded-md ${i % 3 === 0 ? 'w-5/6' : 'w-4/5'}`} />
              </>
            ) : (
              <>
                <div className={`h-2.5 bg-surface-2 rounded-md ${i % 2 === 0 ? 'w-full' : 'w-11/12'}`} />
                {i % 3 !== 2 && (
                  <div className={`h-2.5 bg-surface-2 rounded-md ${i % 2 === 0 ? 'w-5/6' : 'w-4/5'}`} />
                )}
              </>
            )}
          </div>
        </div>
      ))}
      <p className="text-center text-label-12 text-muted mt-4">
        {isPlaceholder ? 'Finding relevant values...' : 'Analyzing context...'}
      </p>
    </div>
  );
}

// ===========================
// EMPTY STATE
// ===========================

interface EmptyStateProps {
  emptyState: EmptyStateConfig;
}

export function EmptyState({ emptyState }: EmptyStateProps): React.ReactElement {
  const EmptyIcon = emptyState.icon;

  return (
    <div className="flex flex-1 items-center justify-center py-8">
      <div className="px-3 text-center max-w-[200px]">
        <div className="relative inline-flex mb-3">
          <div className="relative p-2 bg-surface-1 border border-border rounded-md">
            <EmptyIcon className="h-6 w-6 text-muted" aria-hidden="true" />
          </div>
        </div>
        <p className="text-label-12 text-foreground mb-1">{emptyState.title}</p>
        <p className="text-label-12 text-muted">{emptyState.description}</p>
      </div>
    </div>
  );
}

// ===========================
// ERROR STATE
// ===========================

interface ErrorStateProps {
  errorState: ErrorStateConfig;
  errorMessage?: string | null;
  onRetry?: () => void;
}

export function ErrorState({
  errorState,
  errorMessage,
  onRetry,
}: ErrorStateProps): React.ReactElement {
  const ErrorIcon = errorState.icon;
  const description = errorMessage || errorState.description;

  return (
    <div className="flex flex-1 items-center justify-center py-8">
      <div className="px-3 text-center max-w-[220px]">
        <div className="relative inline-flex mb-3">
          <div className="relative p-2 bg-surface-1 border border-border rounded-md">
            <ErrorIcon className="h-6 w-6 text-muted" aria-hidden="true" />
          </div>
        </div>
        <p className="text-label-12 text-foreground mb-1">{errorState.title}</p>
        <p className="text-label-12 text-muted">{description}</p>
        {onRetry && (
          <Button
            onClick={onRetry}
            variant="ghost"
            className="mt-3 px-3 py-1 text-label-12 font-medium bg-surface-2 rounded-md transition-colors hover:bg-surface-3"
          >
            Retry
          </Button>
        )}
      </div>
    </div>
  );
}

// ===========================
// INACTIVE STATE
// ===========================

interface InactiveStateProps {
  inactiveState: InactiveStateConfig;
}

export function InactiveState({ inactiveState }: InactiveStateProps): React.ReactElement {
  const InactiveIcon = inactiveState.icon;
  const example = inactiveState.example;

  return (
    <div className="flex flex-1 items-start justify-start px-4 py-4">
      <div className="w-full max-w-[360px]">
        <div className="flex items-start gap-3">
          <div className="relative p-2 bg-surface-1 border border-border rounded-md flex-shrink-0">
            <InactiveIcon className="h-5 w-5 text-muted" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-medium text-foreground">
              {inactiveState.title}
            </h4>
            <p className="mt-1 text-label-12 text-muted">
              {inactiveState.description}
            </p>
          </div>
        </div>

        {example?.from && Array.isArray(example.to) && example.to.length > 0 && (
          <div className="mt-4">
            <div className="text-[11px] font-medium text-muted uppercase tracking-wide mb-2">
              Example
            </div>
            <div className="px-3 py-2 bg-surface-1 border border-border rounded-md text-label-12 text-foreground font-mono">
              {example.from} → {example.to.join(' | ')}
            </div>
          </div>
        )}

        {Array.isArray(inactiveState.tips) && inactiveState.tips.length > 0 && (
          <div className="mt-3 space-y-1 text-left">
            {inactiveState.tips.map((tip, index) => {
              const TipIcon = tip.icon || Info;
              return (
                <div
                  key={`${tip.text}-${index}`}
                  className="flex items-start gap-2 px-2 py-1 bg-surface-1 border border-border rounded-md"
                >
                  <TipIcon className="h-3 w-3 text-muted flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <span className="text-label-12 text-muted">{tip.text}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
