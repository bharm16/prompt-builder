/**
 * CustomRequestForm Component
 *
 * Form for submitting custom suggestion requests.
 * Following VideoConceptBuilder pattern: Controlled form component
 */

import { Loader2, Sparkles } from 'lucide-react';
import { MAX_REQUEST_LENGTH } from '../config/panelConfig';

export function CustomRequestForm({
  customRequest = '',
  onCustomRequestChange = () => {},
  onSubmit = () => {},
  isLoading = false,
  placeholder = 'Make it more cinematic, brighter, tense, etc.',
  helperText = 'Describe the tone, detail, or direction you want to see.',
  ctaLabel = 'Get Suggestions',
}) {
  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <div className="flex-shrink-0 p-4 border-b border-neutral-200 bg-gradient-to-b from-white to-neutral-50/30 space-y-3">
      <div className="space-y-1">
        <label
          htmlFor="custom-request"
          className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wide"
        >
          Need something specific?
        </label>
        <p className="text-[12px] text-neutral-500 leading-relaxed">{helperText}</p>
      </div>

      <form onSubmit={handleSubmit}>
        <textarea
          id="custom-request"
          value={customRequest}
          onChange={(e) => onCustomRequestChange(e.target.value)}
          placeholder={placeholder}
          className="w-full h-20 text-[13px] text-neutral-900 bg-white border border-neutral-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-400"
          maxLength={MAX_REQUEST_LENGTH}
        />

        <button
          type="submit"
          disabled={isLoading || !customRequest.trim()}
          className={`inline-flex items-center justify-center gap-2 w-full px-3 py-2 mt-3 text-[13px] font-semibold rounded-lg transition-all duration-150 ${
            isLoading || !customRequest.trim()
              ? 'bg-neutral-200 text-neutral-500 cursor-not-allowed'
              : 'bg-neutral-900 text-white hover:bg-neutral-800 shadow-sm'
          }`}
          aria-busy={isLoading}
          aria-live="polite"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>Generating...</span>
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              <span>{ctaLabel}</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
