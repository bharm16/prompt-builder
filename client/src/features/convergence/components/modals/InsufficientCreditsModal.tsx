/**
 * InsufficientCreditsModal Component
 *
 * Modal displayed when a user has insufficient credits to perform an operation.
 * Shows the credit requirement vs available balance and provides options to
 * purchase credits or cancel the operation.
 *
 * Requirements:
 * - 15.5: IF a user has insufficient credits, THEN THE System SHALL block
 *         generation and prompt to purchase
 */

import React from 'react';
import { AlertCircle, CreditCard, X } from 'lucide-react';
import { Button } from '@promptstudio/system/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@promptstudio/system/components/ui/dialog';
import type { InsufficientCreditsModalState } from '../../types';

/**
 * Props for the InsufficientCreditsModal component
 */
export interface InsufficientCreditsModalProps {
  /** The modal state containing credit information */
  modalState: InsufficientCreditsModalState;
  /** Callback when user chooses to cancel */
  onCancel: () => void;
  /** Whether the modal is open */
  isOpen?: boolean;
}

/**
 * Format a credit amount for display
 */
function formatCredits(amount: number): string {
  return amount.toLocaleString();
}

/**
 * Get a human-readable operation label
 */
function getOperationLabel(operation: string): string {
  const labels: Record<string, string> = {
    startSession: 'start a new session',
    selectOption: 'generate images',
    regenerate: 'regenerate options',
    depthEstimation: 'generate depth map',
    videoPreview: 'generate video preview',
    finalize: 'finalize session',
    generateSubjectMotion: 'generate subject motion preview',
    selectCameraMotion: 'select camera motion',
  };
  return labels[operation] || operation;
}

/**
 * InsufficientCreditsModal - Modal for insufficient credits notification
 *
 * Displays information about the credit shortage including:
 * - The operation that requires credits
 * - Credits required vs available
 * - Shortfall amount
 *
 * Provides two actions:
 * - Purchase Credits: Navigate to /pricing page
 * - Cancel: Close the modal and cancel the operation
 */
export function InsufficientCreditsModal({
  modalState,
  onCancel,
  isOpen = true,
}: InsufficientCreditsModalProps): React.ReactElement {
  const { required, available, operation } = modalState;
  const shortfall = required - available;

  /**
   * Handle Purchase Credits button click
   * Navigates to the pricing page
   */
  const handlePurchaseCredits = (): void => {
    window.location.href = '/pricing';
  };

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
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="h-5 w-5 text-red-600" aria-hidden="true" />
            </div>
            <div>
              <DialogTitle className="text-heading-18 text-foreground">
                Insufficient Credits
              </DialogTitle>
              <DialogDescription className="text-copy-14 text-muted">
                You need more credits to {getOperationLabel(operation)}
              </DialogDescription>
            </div>
          </div>

          {/* Credit Info Card */}
          <div className="rounded-lg border border-border bg-surface-2 p-4 mb-6">
            {/* Credits Required */}
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-border">
              <span className="text-copy-14 text-muted">Credits Required</span>
              <span className="text-copy-14 font-semibold text-foreground">
                {formatCredits(required)}
              </span>
            </div>

            {/* Credits Available */}
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-border">
              <span className="text-copy-14 text-muted">Credits Available</span>
              <span className="text-copy-14 font-semibold text-foreground">
                {formatCredits(available)}
              </span>
            </div>

            {/* Shortfall */}
            <div className="flex items-center justify-between">
              <span className="text-copy-14 text-muted">Shortfall</span>
              <span className="text-copy-14 font-semibold text-red-600">
                {formatCredits(shortfall)} credits needed
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <Button
              onClick={handlePurchaseCredits}
              variant="default"
              className="w-full"
              size="lg"
            >
              <CreditCard className="h-4 w-4 mr-2" aria-hidden="true" />
              Purchase Credits
            </Button>
            <Button
              onClick={onCancel}
              variant="secondary"
              className="w-full"
              size="lg"
            >
              <X className="h-4 w-4 mr-2" aria-hidden="true" />
              Cancel
            </Button>
          </div>

          {/* Help text */}
          <p className="text-copy-12 text-muted text-center mt-4">
            Purchase credits to continue with your creative session
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default InsufficientCreditsModal;
