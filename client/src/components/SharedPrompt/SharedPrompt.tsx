import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Home, Copy, Check } from 'lucide-react';
import { Button } from '../Button';
import { useSharedPrompt } from './hooks/useSharedPrompt';
import { getModeLabel } from './utils/promptUtils';
import '../../features/prompt-optimizer/PromptCanvas.css';

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
      <div className="min-h-screen gradient-neutral flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-neutral-600 border-r-transparent"></div>
          <p className="mt-4 text-neutral-600">Loading prompt...</p>
        </div>
      </div>
    );
  }

  if (error || !prompt) {
    return (
      <div className="min-h-screen gradient-neutral flex items-center justify-center">
        <div className="text-center max-w-md p-8">
          <h1 className="text-3xl font-bold text-neutral-800 mb-4">{error || 'Prompt Not Found'}</h1>
          <p className="text-neutral-600 mb-6">
            The prompt you're looking for doesn't exist or has been removed.
          </p>
          <Button
            onClick={() => navigate('/')}
            variant="primary"
            prefix={<Home className="h-4 w-4" />}
          >
            Go to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-neutral">
      {/* Header */}
      <div className="border-b border-neutral-200 bg-white/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-neutral-800">Shared Prompt</h1>
            <p className="text-sm text-neutral-500">
              {getModeLabel(prompt.mode)} · {new Date(prompt.timestamp).toLocaleDateString()}
            </p>
          </div>
          <Button
            onClick={() => navigate('/')}
            variant="ghost"
            prefix={<Home className="h-4 w-4" />}
          >
            Home
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Original Input */}
        <div className="mb-8">
          <h2 className="text-sm font-medium text-neutral-500 mb-2 uppercase tracking-wide">
            Original Input
          </h2>
          <div className="bg-white rounded-lg border border-neutral-200 p-6">
            <p className="text-neutral-700 whitespace-pre-wrap">{prompt.input}</p>
          </div>
        </div>

        {/* Optimized Output */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-medium text-neutral-500 uppercase tracking-wide">
              Optimized Output
            </h2>
            <Button
              onClick={handleCopy}
              variant="ghost"
              size="small"
              prefix={copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            >
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>
          <div className="bg-white rounded-lg border border-neutral-200 p-6">
            <div
              className="text-neutral-700 font-medium"
              dangerouslySetInnerHTML={{ __html: formattedOutput.html || '' }}
            />
          </div>
        </div>

        {/* Quality Score */}
        {prompt.score && (
          <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-neutral-200">
            <span className="text-sm text-neutral-500">Quality Score:</span>
            <span className="text-sm font-semibold text-neutral-800">{prompt.score}/100</span>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-neutral-200 text-center">
          <p className="text-sm text-neutral-500">
            Create your own optimized prompts at{' '}
            <button
              onClick={() => navigate('/')}
              className="text-neutral-700 hover:text-neutral-900 font-medium underline"
            >
              Prompt Builder
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SharedPrompt;
