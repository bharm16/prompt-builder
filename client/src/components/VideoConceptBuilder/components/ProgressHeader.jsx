/**
 * Progress Header Component
 *
 * Displays completion progress and group progress statistics.
 */

import { CheckCircle } from 'lucide-react';
import { formatLabel } from '../utils/formatting';

export function ProgressHeader({ completionPercent, groupProgress }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {/* Overall Completion Card */}
      <div className="rounded-2xl bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 px-4 py-4 text-white shadow-lg">
        <div className="flex items-center justify-between text-xs font-medium uppercase tracking-[0.12em] text-neutral-200/80">
          <span>Completion</span>
          <CheckCircle className="h-3.5 w-3.5 text-emerald-300" />
        </div>
        <div className="mt-3 flex items-end justify-between">
          <span className="text-2xl font-semibold">{Math.min(100, completionPercent)}%</span>
        </div>
        <div className="mt-3 h-[6px] w-full overflow-hidden rounded-full bg-neutral-700/70">
          <div
            className="h-full rounded-full bg-emerald-400 transition-all duration-300"
            style={{ width: `${Math.min(100, completionPercent)}%` }}
          />
        </div>
      </div>

      {/* Group Progress Cards */}
      {groupProgress.map((group) => {
        const progressPercent = Math.round(
          (group.filled / Math.max(group.total, 1)) * 100
        );
        return (
          <div
            key={group.key}
            className="rounded-2xl border border-neutral-200/80 bg-neutral-50/60 px-4 py-4 shadow-sm"
          >
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">
              <span>{group.label}</span>
              <span className="text-neutral-400">{progressPercent}%</span>
            </div>
            <div className="mt-3 flex items-end justify-between">
              <span className="text-lg font-semibold text-neutral-900">
                {group.filled}
                <span className="text-sm font-medium text-neutral-400">
                  /{group.total}
                </span>
              </span>
              <div className="flex h-6 items-center rounded-full bg-white px-2 text-[11px] font-medium text-neutral-500">
                {progressPercent >= 80
                  ? 'Dialed in'
                  : progressPercent >= 40
                    ? 'In progress'
                    : 'Start here'}
              </div>
            </div>
            <div className="mt-3 h-[6px] w-full overflow-hidden rounded-full bg-white/70">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  progressPercent >= 75
                    ? 'bg-emerald-400'
                    : progressPercent >= 40
                      ? 'bg-amber-300'
                      : 'bg-neutral-300'
                }`}
                style={{ width: `${Math.min(100, progressPercent)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
