/**
 * CustomRequestForm Component
 *
 * Form for submitting custom suggestion requests.
 * Following VideoConceptBuilder pattern: Controlled form component
 */

import { Loader2, Sparkles } from 'lucide-react';
import { MAX_REQUEST_LENGTH } from '../config/panelConfig';

interface CustomRequestFormProps {
  customRequest?: string;
  onCustomRequestChange?: (value: string) => void;
  onSubmit?: () => void;
  isLoading?: boolean;
  placeholder?: string;
  helperText?: string;
  ctaLabel?: string;
}

export function CustomRequestForm({
  customRequest = '',
  onCustomRequestChange = () => {},
  onSubmit = () => {},
  isLoading = false,
  placeholder = 'Make it more cinematic, brighter, tense, etc.',
  helperText = 'Describe the tone, detail, or direction you want to see.',
  ctaLabel = 'Get Suggestions',
}: CustomRequestFormProps): React.ReactElement {
  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <div className="flex-shrink-0 p-geist-3 border-b border-geist-accents-2 bg-gradient-to-b from-geist-background to-geist-accents-1/30 space-y-geist-2">
      <div className="space-y-geist-1">
        <label
          htmlFor="custom-request"
          className="text-label-12 text-geist-accents-6 uppercase tracking-wide"
        >
          Need something specific?
        </label>
        <p className="text-copy-14 text-geist-accents-5 leading-relaxed">{helperText}</p>
      </div>

      <form onSubmit={handleSubmit}>
        <textarea
          id="custom-request"
          value={customRequest}
          onChange={(e) => onCustomRequestChange(e.target.value)}
          placeholder={placeholder}
          className="w-full h-12 text-copy-14 text-geist-foreground bg-geist-background border border-geist-accents-3 rounded-geist-lg px-geist-3 py-geist-2 focus:outline-none focus:ring-2 focus:ring-geist-foreground/10 focus:border-geist-accents-4"
          maxLength={MAX_REQUEST_LENGTH}
        />

        <button
          type="submit"
          disabled={isLoading || !customRequest.trim()}
          className={`inline-flex items-center justify-center gap-geist-2 w-full px-geist-3 py-geist-2 mt-geist-3 text-button-14 rounded-geist-lg transition-all duration-150 ${
            isLoading || !customRequest.trim()
              ? 'bg-geist-accents-2 text-geist-accents-5 cursor-not-allowed'
              : 'bg-geist-foreground text-white hover:bg-geist-accents-8 shadow-geist-small'
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

