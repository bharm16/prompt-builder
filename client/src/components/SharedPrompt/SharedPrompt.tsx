import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Home, Copy, Check } from 'lucide-react';
import { Button } from '@promptstudio/system/components/ui/button';
import { useSharedPrompt } from './hooks/useSharedPrompt';
import { getModeLabel } from './utils/promptUtils';

/**
 * SharedPrompt - Displays a shared prompt by UUID
 *
 * Fetches and displays a prompt that was shared via URL.
 * Orchestrates data fetching through useSharedPrompt hook.
 */
const SharedPrompt = (): React.ReactElement => {
  const { uuid } = useParams<{ uuid: string }>();
  const navigate = useNavigate();
  
  const {
    prompt,
    loading,
    error,
    copied,
    formattedOutput,
    handleCopy,
  } = useSharedPrompt({ uuid });

  if (loading) {
    return (
      <div className="flex h-full min-h-full items-center justify-center bg-app text-foreground">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-border border-r-transparent"></div>
          <p className="mt-4 text-label-sm text-muted">Loading prompt...</p>
        </div>
      </div>
    );
  }

  if (error || !prompt) {
    return (
      <div className="flex h-full min-h-full items-center justify-center bg-app text-foreground">
        <div className="max-w-md p-8 text-center">
          <h1 className="mb-4 text-h2 font-semibold">{error || 'Prompt Not Found'}</h1>
          <p className="mb-6 text-body-sm text-muted">
            The prompt you're looking for doesn't exist or has been removed.
          </p>
          <Button
            onClick={() => navigate('/')}
            variant="default"
          >
            <Home className="h-4 w-4" />
            Go to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-full overflow-y-auto bg-app text-foreground">
      {/* Header */}
      <div
        className="sticky z-10 border-b border-border bg-surface-1/70 backdrop-blur-sm"
        style={{ top: 'var(--global-top-nav-height)' }}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-h4 font-semibold text-foreground">Shared Prompt</h1>
            <p className="text-label-sm text-muted">
              {getModeLabel(prompt.mode)} · {new Date(prompt.timestamp).toLocaleDateString()}
            </p>
          </div>
          <Button
            onClick={() => navigate('/')}
            variant="ghost"
          >
            <Home className="h-4 w-4" />
            Home
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* Original Input */}
        <div className="mb-8">
          <h2 className="mb-2 text-label-sm font-semibold uppercase tracking-wide text-muted">
            Original Input
          </h2>
          <div className="rounded-lg border border-border bg-surface-1 p-6">
            <p className="whitespace-pre-wrap text-body text-foreground">{prompt.input}</p>
          </div>
        </div>

        {/* Optimized Output */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-label-sm font-semibold uppercase tracking-wide text-muted">
              Optimized Output
            </h2>
            <Button
              onClick={handleCopy}
              variant="ghost"
              size="sm"
            >
              {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>
          <div className="rounded-lg border border-border bg-surface-1 p-6">
            <div
              className="text-body font-medium text-foreground"
              dangerouslySetInnerHTML={{ __html: formattedOutput.html || '' }}
            />
          </div>
        </div>

        {/* Quality Score */}
        {prompt.score && (
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface-1 px-4 py-2">
            <span className="text-label-sm text-muted">Quality Score:</span>
            <span className="text-label-sm font-semibold text-foreground">{prompt.score}/100</span>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 border-t border-border pt-6 text-center">
          <p className="text-label-sm text-muted">
            Create your own optimized prompts at{' '}
            <Button
              onClick={() => navigate('/')}
              variant="link"
              className="h-auto p-0 text-foreground underline transition-colors hover:text-accent"
            >
              Prompt Builder
            </Button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SharedPrompt;
