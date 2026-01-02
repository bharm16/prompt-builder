/**
 * PanelStates Components
 *
 * Loading, Empty, and Inactive state components for SuggestionsPanel.
 * Following VideoConceptBuilder pattern: components/ConflictsAlert.tsx
 */

import { Info, type LucideIcon } from 'lucide-react';
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
    <div className="px-geist-3 py-geist-3 space-y-geist-2" role="status" aria-live="polite">
      {Array.from({ length: skeletonCount }).map((_, i) => (
        <div
          key={i}
          className="relative overflow-hidden px-geist-3 py-geist-2 bg-geist-accents-1 border border-geist-accents-2 rounded-geist animate-pulse"
          style={{ animationDelay: `${i * 75}ms`, animationDuration: '1.5s' }}
        >
          <div className="space-y-geist-1">
            <div
              className={`h-3 bg-geist-accents-2 rounded-geist ${
                i % 4 === 0 ? 'w-3/4' : i % 4 === 1 ? 'w-2/3' : i % 4 === 2 ? 'w-4/5' : 'w-5/6'
              }`}
            />
            {isPlaceholder ? (
              <>
                <div className={`h-2.5 bg-geist-accents-2 rounded-geist ${i % 2 === 0 ? 'w-full' : 'w-11/12'}`} />
                <div className={`h-2.5 bg-geist-accents-2 rounded-geist ${i % 3 === 0 ? 'w-5/6' : 'w-4/5'}`} />
              </>
            ) : (
              <>
                <div className={`h-2.5 bg-geist-accents-2 rounded-geist ${i % 2 === 0 ? 'w-full' : 'w-11/12'}`} />
                {i % 3 !== 2 && (
                  <div className={`h-2.5 bg-geist-accents-2 rounded-geist ${i % 2 === 0 ? 'w-5/6' : 'w-4/5'}`} />
                )}
              </>
            )}
          </div>
        </div>
      ))}
      <p className="text-center text-label-12 text-geist-accents-5 mt-geist-4">
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
    <div className="flex flex-1 items-center justify-center py-geist-8">
      <div className="px-geist-3 text-center max-w-[200px]">
        <div className="relative inline-flex mb-geist-3">
          <div className="relative p-geist-2 bg-geist-accents-1 border border-geist-accents-2 rounded-geist">
            <EmptyIcon className="h-6 w-6 text-geist-accents-5" aria-hidden="true" />
          </div>
        </div>
        <p className="text-label-12 text-geist-foreground mb-geist-1">{emptyState.title}</p>
        <p className="text-label-12 text-geist-accents-5">{emptyState.description}</p>
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
    <div className="flex flex-1 items-center justify-center py-geist-8">
      <div className="px-geist-3 text-center max-w-[220px]">
        <div className="relative inline-flex mb-geist-3">
          <div className="relative p-geist-2 bg-geist-accents-1 border border-geist-accents-2 rounded-geist">
            <ErrorIcon className="h-6 w-6 text-geist-accents-5" aria-hidden="true" />
          </div>
        </div>
        <p className="text-label-12 text-geist-foreground mb-geist-1">{errorState.title}</p>
        <p className="text-label-12 text-geist-accents-5">{description}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-geist-3 px-geist-3 py-geist-1 text-label-12 font-medium bg-geist-accents-2 hover:bg-geist-accents-3 rounded-geist transition-colors"
          >
            Retry
          </button>
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
    <div className="flex flex-1 items-start justify-start px-geist-4 py-geist-4">
      <div className="w-full max-w-[360px]">
        <div className="flex items-start gap-geist-3">
          <div className="relative p-geist-2 bg-geist-accents-1 border border-geist-accents-2 rounded-geist flex-shrink-0">
            <InactiveIcon className="h-5 w-5 text-geist-accents-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-medium text-geist-foreground">
              {inactiveState.title}
            </h4>
            <p className="mt-1 text-label-12 text-geist-accents-5">
              {inactiveState.description}
            </p>
          </div>
        </div>

        {example?.from && Array.isArray(example.to) && example.to.length > 0 && (
          <div className="mt-geist-4">
            <div className="text-[11px] font-medium text-geist-accents-5 uppercase tracking-wide mb-geist-2">
              Example
            </div>
            <div className="px-geist-3 py-geist-2 bg-geist-accents-1 border border-geist-accents-2 rounded-geist text-label-12 text-geist-foreground font-mono">
              {example.from} → {example.to.join(' | ')}
            </div>
          </div>
        )}

        {Array.isArray(inactiveState.tips) && inactiveState.tips.length > 0 && (
          <div className="mt-geist-3 space-y-geist-1 text-left">
            {inactiveState.tips.map((tip, index) => {
              const TipIcon = tip.icon || Info;
              return (
                <div
                  key={`${tip.text}-${index}`}
                  className="flex items-start gap-geist-2 px-geist-2 py-geist-1 bg-geist-accents-1 border border-geist-accents-2 rounded-geist"
                >
                  <TipIcon className="h-3 w-3 text-geist-accents-5 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <span className="text-label-12 text-geist-accents-6">{tip.text}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
