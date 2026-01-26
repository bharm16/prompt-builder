/**
 * SessionExpiredModal Component
 *
 * Modal displayed when a user's convergence session has expired (24-hour TTL).
 * Prompts the user to start a new session.
 *
 * Requirements:
 * - 1.4: When a Convergence_Session has been inactive for 24 hours,
 *        THE System SHALL mark it as abandoned during cleanup
 *
 * @task 37.4 - Add session expiry handling (24-hour TTL)
 */

import React from 'react';
import { Clock, Sparkles } from 'lucide-react';
import { Button } from '@promptstudio/system/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@promptstudio/system/components/ui/dialog';

/**
 * Props for the SessionExpiredModal component
 */
export interface SessionExpiredModalProps {
  /** The original intent from the expired session (if available) */
  intent?: string;
  /** Callback when user chooses to start a new session */
  onStartNew: () => void;
  /** Whether the modal is open */
  isOpen?: boolean;
}

/**
 * SessionExpiredModal - Modal for handling expired sessions
 *
 * Displays information about the expired session and prompts
 * the user to start a new creative session.
 */
export function SessionExpiredModal({
  intent,
  onStartNew,
  isOpen = true,
}: SessionExpiredModalProps): React.ReactElement {
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
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/20">
              <Clock className="h-5 w-5 text-warning" aria-hidden="true" />
            </div>
            <div>
              <DialogTitle className="text-heading-18 text-foreground">
                Session Expired
              </DialogTitle>
              <DialogDescription className="text-copy-14 text-muted">
                Your session has been inactive for too long
              </DialogDescription>
            </div>
          </div>

          {/* Explanation */}
          <div className="rounded-lg border border-border bg-surface-2 p-4 mb-6">
            <p className="text-copy-14 text-foreground mb-3">
              For security and resource management, sessions expire after 24 hours of inactivity.
            </p>

            {intent && (
              <div className="pt-3 border-t border-border">
                <p className="text-label-12 text-muted uppercase tracking-wide mb-1">
                  Your previous intent
                </p>
                <p className="text-copy-14 text-foreground line-clamp-2">
                  "{intent}"
                </p>
                <p className="text-copy-12 text-muted mt-2">
                  You can use this as a starting point for your new session.
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <Button
              onClick={onStartNew}
              variant="default"
              className="w-full"
              size="lg"
            >
              <Sparkles className="h-4 w-4 mr-2" aria-hidden="true" />
              Start New Session
            </Button>
          </div>

          {/* Help text */}
          <p className="text-copy-12 text-muted text-center mt-4">
            Don't worry, starting fresh is quick and easy!
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default SessionExpiredModal;
