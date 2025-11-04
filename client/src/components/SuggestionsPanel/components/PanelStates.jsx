/**
 * PanelStates Components
 *
 * Loading, Empty, and Inactive state components for SuggestionsPanel.
 * Following VideoConceptBuilder pattern: components/ConflictsAlert.jsx (44 lines)
 */

import { Info } from 'lucide-react';
import { getLoadingSkeletonCount } from '../utils/suggestionHelpers';

// ===========================
// LOADING STATE
// ===========================

export function LoadingState({ contextValue = '', selectedText = '', isPlaceholder = false }) {
  const textLength = contextValue?.length || selectedText?.length || 0;
  const skeletonCount = getLoadingSkeletonCount(textLength, isPlaceholder);

  return (
    <div className="p-4 space-y-3" role="status" aria-live="polite">
      {Array.from({ length: skeletonCount }).map((_, i) => (
        <div
          key={i}
          className="relative overflow-hidden p-4 bg-gradient-to-r from-neutral-100 via-neutral-50 to-neutral-100 border border-neutral-200 rounded-xl animate-pulse"
          style={{ animationDelay: `${i * 75}ms`, animationDuration: '1.5s' }}
        >
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent" />
          <div className="relative space-y-2.5">
            <div
              className={`h-4 bg-neutral-200/70 rounded-md ${
                i % 4 === 0 ? 'w-3/4' : i % 4 === 1 ? 'w-2/3' : i % 4 === 2 ? 'w-4/5' : 'w-5/6'
              }`}
            />
            {isPlaceholder ? (
              <>
                <div className={`h-3 bg-neutral-200/50 rounded-md ${i % 2 === 0 ? 'w-full' : 'w-11/12'}`} />
                <div className={`h-3 bg-neutral-200/50 rounded-md ${i % 3 === 0 ? 'w-5/6' : 'w-4/5'}`} />
              </>
            ) : (
              <>
                <div className={`h-3 bg-neutral-200/50 rounded-md ${i % 2 === 0 ? 'w-full' : 'w-11/12'}`} />
                {i % 3 !== 2 && (
                  <div className={`h-3 bg-neutral-200/50 rounded-md ${i % 2 === 0 ? 'w-5/6' : 'w-4/5'}`} />
                )}
              </>
            )}
          </div>
        </div>
      ))}
      <p className="text-center text-[13px] text-neutral-500 font-medium mt-6">
        {isPlaceholder ? 'Finding relevant values...' : 'Analyzing context...'}
      </p>
    </div>
  );
}

// ===========================
// EMPTY STATE
// ===========================

export function EmptyState({ emptyState }) {
  const EmptyIcon = emptyState.icon;

  return (
    <div className="flex flex-1 items-center justify-center py-12">
      <div className="px-4 text-center max-w-[240px]">
        <div className="relative inline-flex mb-4">
          <div className="absolute inset-0 bg-neutral-200/50 rounded-full blur-xl animate-pulse" />
          <div className="relative p-3 bg-gradient-to-br from-neutral-100 to-neutral-50 rounded-2xl shadow-sm ring-1 ring-neutral-200/50">
            <EmptyIcon className="h-8 w-8 text-neutral-400" aria-hidden="true" />
          </div>
        </div>
        <p className="text-[14px] text-neutral-900 font-semibold mb-2">{emptyState.title}</p>
        <p className="text-[12px] text-neutral-600 leading-relaxed">{emptyState.description}</p>
      </div>
    </div>
  );
}

// ===========================
// INACTIVE STATE
// ===========================

export function InactiveState({ inactiveState }) {
  const InactiveIcon = inactiveState.icon;

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="text-center max-w-[240px]">
        <div className="relative inline-flex mb-4">
          <div className="absolute inset-0 bg-neutral-200/50 rounded-full blur-xl animate-pulse" />
          <div className="relative p-3 bg-gradient-to-br from-neutral-100 to-neutral-50 rounded-2xl shadow-sm ring-1 ring-neutral-200/50">
            <InactiveIcon className="h-8 w-8 text-neutral-400" aria-hidden="true" />
          </div>
        </div>
        <h4 className="text-[14px] font-semibold text-neutral-900 mb-2">{inactiveState.title}</h4>
        <p className="text-[12px] text-neutral-600 leading-relaxed">{inactiveState.description}</p>
        {Array.isArray(inactiveState.tips) && inactiveState.tips.length > 0 && (
          <div className="mt-4 space-y-2 text-left">
            {inactiveState.tips.map((tip, index) => {
              const TipIcon = tip.icon || Info;
              return (
                <div
                  key={`${tip.text}-${index}`}
                  className="flex items-start gap-2 p-2 bg-neutral-50 rounded-lg border border-neutral-200/60"
                >
                  <TipIcon className="h-3.5 w-3.5 text-neutral-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <span className="text-[11px] text-neutral-600 leading-relaxed">{tip.text}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
