/**
 * ResumeSessionModal Component
 *
 * Modal displayed when a user has an existing incomplete convergence session.
 * Allows the user to either resume the existing session or start fresh.
 *
 * Requirements:
 * - 1.6: When a user has an incomplete Convergence_Session from a previous visit,
 *        THE System SHALL prompt to resume or start fresh
 * - 1.11: When a user starts a new session while one exists, THE System SHALL
 *         prompt to abandon the existing session or resume it
 */

import React from 'react';
import { Clock, Sparkles, RefreshCw } from 'lucide-react';
import { Button } from '@promptstudio/system/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@promptstudio/system/components/ui/dialog';
import { getStepLabel } from '@/features/convergence/utils';
import type { ConvergenceSession } from '@/features/convergence/types';

/**
 * Props for the ResumeSessionModal component
 */
export interface ResumeSessionModalProps {
  /** The existing session to potentially resume */
  session: ConvergenceSession;
  /** Callback when user chooses to resume the session */
  onResume: () => void;
  /** Callback when user chooses to start fresh (abandon existing session) */
  onStartFresh: () => void;
  /** Whether the modal is open */
  isOpen?: boolean;
}

/**
 * Format a date for display
 */
function formatLastUpdated(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) {
    return 'just now';
  } else if (diffMins < 60) {
    return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  } else {
    return dateObj.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: dateObj.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  }
}

/**
 * ResumeSessionModal - Modal for resuming or abandoning an existing session
 *
 * Displays information about the existing session including:
 * - The original intent text
 * - When the session was last updated
 * - Current progress step
 *
 * Provides two actions:
 * - Resume: Continue with the existing session
 * - Start Fresh: Abandon the existing session and start a new one
 */
export function ResumeSessionModal({
  session,
  onResume,
  onStartFresh,
  isOpen = true,
}: ResumeSessionModalProps): React.ReactElement {
  return (
    <Dialog open={isOpen}>
      <DialogContent
        className="w-full max-w-md gap-0 rounded-xl border border-border bg-surface-1 p-0 shadow-lg [&>button]:hidden"
        onPointerDownOutside={(e: Event) => e.preventDefault()}
        onEscapeKeyDown={(e: KeyboardEvent) => e.preventDefault()}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100">
              <Sparkles className="h-5 w-5 text-primary-600" aria-hidden="true" />
            </div>
            <div>
              <DialogTitle className="text-heading-18 text-foreground">
                Resume your session?
              </DialogTitle>
              <DialogDescription className="text-copy-14 text-muted">
                You have an incomplete session
              </DialogDescription>
            </div>
          </div>

          {/* Session Info Card */}
          <div className="rounded-lg border border-border bg-surface-2 p-4 mb-6">
            {/* Intent */}
            <div className="mb-3">
              <p className="text-label-12 text-muted uppercase tracking-wide mb-1">Intent</p>
              <p className="text-copy-14 text-foreground line-clamp-2">
                "{session.intent}"
              </p>
            </div>

            {/* Last Updated */}
            <div className="flex items-center gap-4 text-copy-14 text-muted">
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" aria-hidden="true" />
                <span>Last updated {formatLastUpdated(session.updatedAt)}</span>
              </div>
            </div>

            {/* Progress */}
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-label-12 text-muted uppercase tracking-wide mb-1">Progress</p>
              <p className="text-copy-14 text-foreground">
                Currently at: <span className="font-medium">{getStepLabel(session.currentStep)}</span>
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <Button
              onClick={onResume}
              variant="default"
              className="w-full"
              size="lg"
            >
              <Sparkles className="h-4 w-4 mr-2" aria-hidden="true" />
              Resume Session
            </Button>
            <Button
              onClick={onStartFresh}
              variant="secondary"
              className="w-full"
              size="lg"
            >
              <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
              Start Fresh
            </Button>
          </div>

          {/* Help text */}
          <p className="text-copy-12 text-muted text-center mt-4">
            Starting fresh will discard your previous progress
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ResumeSessionModal;
