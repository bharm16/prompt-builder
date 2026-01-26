/**
 * PromptDisplay Component
 *
 * Displays the final generated prompt from the convergence flow.
 * Shows the complete prompt that will be used for video generation.
 *
 * @requirement 8.1 - Return complete prompt on finalization
 */

import React, { useState, useCallback } from 'react';
import { FileText, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { logger } from '@/services/LoggingService';
import { cn } from '@/utils/cn';

// ============================================================================
// Types
// ============================================================================

export interface PromptDisplayProps {
  /** The final prompt to display */
  prompt: string;
  /** Whether the prompt is collapsed by default */
  defaultCollapsed?: boolean;
  /** Maximum lines to show when collapsed */
  collapsedLines?: number;
  /** Additional CSS classes */
  className?: string;
}

const log = logger.child('PromptDisplay');

// ============================================================================
// Component
// ============================================================================

/**
 * PromptDisplay - Shows the final generated prompt
 *
 * @example
 * ```tsx
 * <PromptDisplay
 *   prompt="A cinematic shot of a cat walking..."
 *   defaultCollapsed={true}
 * />
 * ```
 */
export const PromptDisplay: React.FC<PromptDisplayProps> = ({
  prompt,
  defaultCollapsed = false,
  collapsedLines = 3,
  className,
}) => {
  const [isExpanded, setIsExpanded] = useState(!defaultCollapsed);
  const [isCopied, setIsCopied] = useState(false);

  /**
   * Handle copy to clipboard
   */
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      log.warn('Failed to copy prompt', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }, [prompt]);

  /**
   * Toggle expanded state
   */
  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  // Check if prompt is long enough to need collapsing
  const lines = prompt.split('\n');
  const needsCollapse = lines.length > collapsedLines;
  const displayPrompt = isExpanded || !needsCollapse
    ? prompt
    : lines.slice(0, collapsedLines).join('\n') + '...';

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-surface-1',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-muted" aria-hidden="true" />
          <h3 className="text-sm font-medium text-foreground">Final Prompt</h3>
        </div>
        <div className="flex items-center gap-2">
          {/* Copy Button */}
          <button
            type="button"
            onClick={handleCopy}
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium',
              'transition-all duration-200',
              isCopied
                ? 'bg-success/10 text-success'
                : 'bg-surface-2 text-muted hover:text-foreground hover:bg-surface-3'
            )}
            aria-label={isCopied ? 'Copied!' : 'Copy prompt to clipboard'}
          >
            {isCopied ? (
              <>
                <Check className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Copy</span>
              </>
            )}
          </button>

          {/* Expand/Collapse Button */}
          {needsCollapse && (
            <button
              type="button"
              onClick={toggleExpanded}
              className={cn(
                'inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium',
                'bg-surface-2 text-muted hover:text-foreground hover:bg-surface-3',
                'transition-all duration-200'
              )}
              aria-expanded={isExpanded}
              aria-label={isExpanded ? 'Collapse prompt' : 'Expand prompt'}
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Less</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>More</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Prompt Content */}
      <div className="p-4">
        <p
          className={cn(
            'text-sm text-foreground leading-relaxed whitespace-pre-wrap',
            !isExpanded && needsCollapse && 'line-clamp-3'
          )}
        >
          {displayPrompt}
        </p>
      </div>
    </div>
  );
};

PromptDisplay.displayName = 'PromptDisplay';

export default PromptDisplay;
