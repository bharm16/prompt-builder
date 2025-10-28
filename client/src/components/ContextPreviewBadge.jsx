import React, { memo } from 'react';
import { X, Info } from 'lucide-react';

/**
 * ContextPreviewBadge - Compact badge displaying context information
 * Shows a summary of active context fields with a tooltip and clear button
 */
export const ContextPreviewBadge = memo(({ context, onClear }) => {
  if (!context || !Object.keys(context).some((k) => context[k])) {
    return null;
  }

  const activeFields = Object.entries(context).filter(
    ([, value]) => value && typeof value === 'string' && value.trim().length > 0
  );

  if (activeFields.length === 0) {
    return null;
  }

  const fieldCount = activeFields.length;
  const fieldLabel = fieldCount === 1 ? 'field' : 'fields';

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-sm">
      <Info className="h-3.5 w-3.5 text-blue-600" />
      <span className="text-blue-900 font-medium">
        Context: {fieldCount} {fieldLabel}
      </span>
      {onClear && (
        <button
          onClick={onClear}
          className="ml-1 text-blue-600 hover:text-blue-800 transition-colors"
          aria-label="Clear context"
          title="Clear context"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Tooltip with context details */}
      <div className="hidden group-hover:block absolute bottom-full left-0 mb-2 p-3 bg-white border border-neutral-200 rounded-lg shadow-lg z-10 min-w-[300px]">
        <div className="text-xs text-neutral-600 space-y-2">
          {context.specificAspects && (
            <div>
              <span className="font-semibold">Focus Areas:</span>{' '}
              {context.specificAspects}
            </div>
          )}
          {context.backgroundLevel && (
            <div>
              <span className="font-semibold">Audience Level:</span>{' '}
              {context.backgroundLevel}
            </div>
          )}
          {context.intendedUse && (
            <div>
              <span className="font-semibold">Use Case:</span>{' '}
              {context.intendedUse}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

ContextPreviewBadge.displayName = 'ContextPreviewBadge';

/**
 * ContextIndicatorBanner - Full-width prominent banner for context display
 * Alternative to the compact badge for more visible context indication
 */
export const ContextIndicatorBanner = memo(({ context, onClear }) => {
  if (!context || !Object.keys(context).some((k) => context[k])) {
    return null;
  }

  const activeFields = Object.entries(context).filter(
    ([, value]) => value && typeof value === 'string' && value.trim().length > 0
  );

  if (activeFields.length === 0) {
    return null;
  }

  return (
    <div className="w-full mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1">
          <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="space-y-2 flex-1">
            <h3 className="text-sm font-semibold text-blue-900">
              Context Requirements Active
            </h3>
            <div className="text-sm text-blue-800 space-y-1">
              {context.specificAspects && (
                <div>
                  <span className="font-medium">Focus Areas:</span>{' '}
                  {context.specificAspects}
                </div>
              )}
              {context.backgroundLevel && (
                <div>
                  <span className="font-medium">Audience Level:</span>{' '}
                  {context.backgroundLevel}
                </div>
              )}
              {context.intendedUse && (
                <div>
                  <span className="font-medium">Use Case:</span>{' '}
                  {context.intendedUse}
                </div>
              )}
            </div>
          </div>
        </div>
        {onClear && (
          <button
            onClick={onClear}
            className="text-blue-600 hover:text-blue-800 transition-colors flex-shrink-0"
            aria-label="Clear context"
            title="Clear context"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
});

ContextIndicatorBanner.displayName = 'ContextIndicatorBanner';

/**
 * ContextFieldTag - Individual field tag for displaying single context value
 * Useful for showing multiple tags in a row
 */
export const ContextFieldTag = memo(({ label, value, onRemove }) => {
  if (!value || typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  const displayValue = value.length > 30 ? `${value.substring(0, 30)}...` : value;

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-neutral-100 border border-neutral-200 rounded-md text-xs">
      <span className="text-neutral-600 font-medium">{label}:</span>
      <span className="text-neutral-900" title={value}>
        {displayValue}
      </span>
      {onRemove && (
        <button
          onClick={onRemove}
          className="ml-1 text-neutral-500 hover:text-neutral-700 transition-colors"
          aria-label={`Remove ${label}`}
          title={`Remove ${label}`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
});

ContextFieldTag.displayName = 'ContextFieldTag';

export default ContextPreviewBadge;
