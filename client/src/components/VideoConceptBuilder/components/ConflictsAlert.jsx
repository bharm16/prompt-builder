/**
 * Conflicts Alert Component
 *
 * Displays detected conflicts between elements.
 */

import { AlertCircle, Loader2 } from 'lucide-react';

export function ConflictsAlert({ conflicts, isLoading }) {
  if (!isLoading && conflicts.length === 0) return null;

  return (
    <div className="rounded-3xl border border-amber-200/80 bg-amber-50/60 px-5 py-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
          <AlertCircle className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-2">
            <h3 className="text-sm font-semibold text-amber-900">Potential conflicts detected</h3>
            {isLoading && (
              <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
            )}
          </div>
          {isLoading ? (
            <p className="text-sm text-amber-800">Analyzing element harmony...</p>
          ) : (
            conflicts.map((conflict, idx) => {
              const resolution = conflict.resolution || conflict.suggestion;
              return (
                <div key={idx} className="mt-3 rounded-2xl border border-white/40 bg-white/60 px-4 py-3 text-sm text-amber-900 backdrop-blur-sm">
                  <div>{conflict.message}</div>
                  {resolution && (
                    <div className="mt-1 text-xs text-amber-700">{resolution}</div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
