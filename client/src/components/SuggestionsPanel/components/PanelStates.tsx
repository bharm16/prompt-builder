/**
 * PanelStates Components
 *
 * Loading, Empty, and Inactive state components for SuggestionsPanel.
 * Following VideoConceptBuilder pattern: components/ConflictsAlert.tsx
 */

import { Info, type LucideIcon } from 'lucide-react';
import { getLoadingSkeletonCount } from '../utils/suggestionHelpers';
import type { EmptyStateConfig, InactiveStateConfig } from './types';

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
    <div className="p-geist-4 space-y-geist-3" role="status" aria-live="polite">
      {Array.from({ length: skeletonCount }).map((_, i) => (
        <div
          key={i}
          className="relative overflow-hidden p-geist-4 bg-gradient-to-r from-geist-accents-1 via-geist-accents-1 to-geist-accents-1 border border-geist-accents-2 rounded-geist-lg animate-pulse"
          style={{ animationDelay: `${i * 75}ms`, animationDuration: '1.5s' }}
        >
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent" />
          <div className="relative space-y-geist-3">
            <div
              className={`h-4 bg-geist-accents-2/70 rounded-geist ${
                i % 4 === 0 ? 'w-3/4' : i % 4 === 1 ? 'w-2/3' : i % 4 === 2 ? 'w-4/5' : 'w-5/6'
              }`}
            />
            {isPlaceholder ? (
              <>
                <div className={`h-3 bg-geist-accents-2/50 rounded-geist ${i % 2 === 0 ? 'w-full' : 'w-11/12'}`} />
                <div className={`h-3 bg-geist-accents-2/50 rounded-geist ${i % 3 === 0 ? 'w-5/6' : 'w-4/5'}`} />
              </>
            ) : (
              <>
                <div className={`h-3 bg-geist-accents-2/50 rounded-geist ${i % 2 === 0 ? 'w-full' : 'w-11/12'}`} />
                {i % 3 !== 2 && (
                  <div className={`h-3 bg-geist-accents-2/50 rounded-geist ${i % 2 === 0 ? 'w-5/6' : 'w-4/5'}`} />
                )}
              </>
            )}
          </div>
        </div>
      ))}
      <p className="text-center text-label-14 text-geist-accents-5 mt-geist-6">
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
    <div className="flex flex-1 items-center justify-center py-geist-12">
      <div className="px-geist-4 text-center max-w-[240px]">
        <div className="relative inline-flex mb-geist-4">
          <div className="absolute inset-0 bg-geist-accents-2/50 rounded-full blur-xl animate-pulse" />
          <div className="relative p-geist-3 bg-gradient-to-br from-geist-accents-1 to-geist-accents-1 rounded-geist-lg shadow-geist-small ring-1 ring-geist-accents-2/50">
            <EmptyIcon className="h-8 w-8 text-geist-accents-4" aria-hidden="true" />
          </div>
        </div>
        <p className="text-label-14 text-geist-foreground mb-geist-2">{emptyState.title}</p>
        <p className="text-copy-14 text-geist-accents-6 leading-relaxed">{emptyState.description}</p>
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

  return (
    <div className="flex flex-1 items-center justify-center p-geist-6">
      <div className="text-center max-w-[240px]">
        <div className="relative inline-flex mb-geist-4">
          <div className="absolute inset-0 bg-geist-accents-2/50 rounded-full blur-xl animate-pulse" />
          <div className="relative p-geist-3 bg-gradient-to-br from-geist-accents-1 to-geist-accents-1 rounded-geist-lg shadow-geist-small ring-1 ring-geist-accents-2/50">
            <InactiveIcon className="h-8 w-8 text-geist-accents-4" aria-hidden="true" />
          </div>
        </div>
        <h4 className="text-label-14 text-geist-foreground mb-geist-2">{inactiveState.title}</h4>
        <p className="text-copy-14 text-geist-accents-6 leading-relaxed">{inactiveState.description}</p>
        {Array.isArray(inactiveState.tips) && inactiveState.tips.length > 0 && (
          <div className="mt-geist-4 space-y-geist-2 text-left">
            {inactiveState.tips.map((tip, index) => {
              const TipIcon = tip.icon || Info;
              return (
                <div
                  key={`${tip.text}-${index}`}
                  className="flex items-start gap-geist-2 p-geist-2 bg-geist-accents-1 rounded-geist-lg border border-geist-accents-2/60"
                >
                  <TipIcon className="h-3.5 w-3.5 text-geist-accents-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <span className="text-label-12 text-geist-accents-6 leading-relaxed">{tip.text}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

