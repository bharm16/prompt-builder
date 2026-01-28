/**
 * CustomRequestForm Component
 *
 * Form for submitting custom suggestion requests.
 * Following VideoConceptBuilder pattern: Controlled form component
 */

import { Loader2, Sparkles } from '@promptstudio/system/components/ui';
import { Button } from '@promptstudio/system/components/ui/button';
import { Textarea } from '@promptstudio/system/components/ui/textarea';
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
      <div className="flex w-full flex-col gap-2 -mt-0.5">
        <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
          <Textarea
            id="custom-request"
            value={customRequest}
            onChange={(e) => onCustomRequestChange(e.target.value)}
            placeholder={tokenEditorPlaceholder}
            className="min-h-12 w-full resize-y rounded-md border border-border bg-surface-1 px-3 py-2 text-label-12 text-foreground placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/10 focus-visible:border-border-strong"
            maxLength={MAX_REQUEST_LENGTH}
          />

          <Button
            type="submit"
            disabled={isLoading || !customRequest.trim()}
            variant="ghost"
            className="h-8 w-full gap-1 rounded-md border border-white/10 bg-white/10 px-3 text-label-12 text-foreground transition-colors duration-150 hover:border-white/20 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
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
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex-shrink-0 px-3 py-2 border-b border-border bg-app space-y-2">
      <div className="space-y-1">
        <label
          htmlFor="custom-request"
          className="text-label-12 text-muted uppercase tracking-wider"
        >
          Need something specific?
        </label>
        <p className="text-label-12 text-muted">{helperText}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-2">
        <Textarea
          id="custom-request"
          value={customRequest}
          onChange={(e) => onCustomRequestChange(e.target.value)}
          placeholder={placeholder}
          className="w-full h-10 text-label-12 text-foreground bg-app border border-border rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:border-border-strong"
          maxLength={MAX_REQUEST_LENGTH}
        />

        <Button
          type="submit"
          disabled={isLoading || !customRequest.trim()}
          variant="ghost"
          className={`w-full gap-1 px-3 py-1 text-label-12 rounded-md transition-colors duration-150 ${
            isLoading || !customRequest.trim()
              ? 'bg-surface-2 text-muted cursor-not-allowed'
              : 'bg-foreground text-white hover:bg-muted'
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
        </Button>
      </form>
    </div>
  );
}
