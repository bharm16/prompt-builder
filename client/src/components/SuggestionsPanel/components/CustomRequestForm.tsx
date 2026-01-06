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
  variant?: 'default' | 'tokenEditor';
}

export function CustomRequestForm({
  customRequest = '',
  onCustomRequestChange = () => {},
  onSubmit = () => {},
  isLoading = false,
  placeholder = 'Make it more cinematic, brighter, tense, etc.',
  helperText = 'Describe the tone, detail, or direction you want to see.',
  ctaLabel = 'Get Suggestions',
  variant = 'default',
}: CustomRequestFormProps): React.ReactElement {
  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    onSubmit();
  };

  if (variant === 'tokenEditor') {
    const tokenEditorPlaceholder =
      placeholder || 'e.g. more cinematic, more intense, younger, older';
    const tokenEditorCtaLabel = ctaLabel || 'Generate more';

    return (
      <div className="suggestions-panel__custom-request">
        <form onSubmit={handleSubmit} className="suggestions-panel__custom-form">
          <textarea
            id="custom-request"
            value={customRequest}
            onChange={(e) => onCustomRequestChange(e.target.value)}
            placeholder={tokenEditorPlaceholder}
            className="suggestions-panel__custom-input w-full min-h-12 text-label-12 rounded-geist focus:outline-none focus:ring-2 focus:ring-white/10 resize-y"
            maxLength={MAX_REQUEST_LENGTH}
          />

          <button
            type="submit"
            disabled={isLoading || !customRequest.trim()}
            className={`suggestions-panel__custom-button inline-flex items-center justify-center gap-geist-1 w-full h-8 px-geist-3 text-label-12 rounded-geist border transition-colors duration-150 ${
              isLoading || !customRequest.trim()
                ? 'is-disabled'
                : ''
            }`}
            aria-busy={isLoading}
            aria-live="polite"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                <span>{tokenEditorCtaLabel}</span>
              </>
            )}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex-shrink-0 px-geist-3 py-geist-2 border-b border-geist-accents-2 bg-geist-background space-y-geist-2">
      <div className="space-y-geist-1">
        <label
          htmlFor="custom-request"
          className="text-label-12 text-geist-accents-5 uppercase tracking-wider"
        >
          Need something specific?
        </label>
        <p className="text-label-12 text-geist-accents-5">{helperText}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-geist-2">
        <textarea
          id="custom-request"
          value={customRequest}
          onChange={(e) => onCustomRequestChange(e.target.value)}
          placeholder={placeholder}
          className="w-full h-10 text-label-12 text-geist-foreground bg-geist-background border border-geist-accents-2 rounded-geist px-geist-2 py-geist-1 focus:outline-none focus:ring-2 focus:ring-geist-foreground/10 focus:border-geist-accents-4"
          maxLength={MAX_REQUEST_LENGTH}
        />

        <button
          type="submit"
          disabled={isLoading || !customRequest.trim()}
          className={`inline-flex items-center justify-center gap-geist-1 w-full px-geist-3 py-geist-1 text-label-12 rounded-geist transition-colors duration-150 ${
            isLoading || !customRequest.trim()
              ? 'bg-geist-accents-2 text-geist-accents-5 cursor-not-allowed'
              : 'bg-geist-foreground text-white hover:bg-geist-accents-8'
          }`}
          aria-busy={isLoading}
          aria-live="polite"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              <span>Generating...</span>
            </>
          ) : (
            <>
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              <span>{ctaLabel}</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
