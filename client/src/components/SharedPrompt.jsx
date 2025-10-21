import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPromptByUuid } from '../config/firebase';
import { Home, Copy, Check } from 'lucide-react';
import { useToast } from './Toast';

const SharedPrompt = () => {
  const { uuid } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [prompt, setPrompt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchPrompt = async () => {
      try {
        setLoading(true);
        const promptData = await getPromptByUuid(uuid);
        if (promptData) {
          setPrompt(promptData);
        } else {
          setError('Prompt not found');
        }
      } catch (err) {
        console.error('Error fetching prompt:', err);
        setError('Failed to load prompt');
      } finally {
        setLoading(false);
      }
    };

    fetchPrompt();
  }, [uuid]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt.output);
      setCopied(true);
      toast.success('Copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy');
    }
  };

  const getModeLabel = (mode) => {
    const modes = {
      optimize: 'Standard Prompt',
      reasoning: 'Reasoning Prompt',
      research: 'Deep Research',
      socratic: 'Socratic Learning',
      video: 'Video Prompt',
    };
    return modes[mode] || mode;
  };

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
          <h1 className="text-3xl font-bold text-neutral-800 mb-4">
            {error || 'Prompt Not Found'}
          </h1>
          <p className="text-neutral-600 mb-6">
            The prompt you're looking for doesn't exist or has been removed.
          </p>
          <button
            onClick={() => navigate('/')}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Home className="h-4 w-4" />
            Go to Home
          </button>
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
            <h1 className="text-xl font-semibold text-neutral-800">
              Shared Prompt
            </h1>
            <p className="text-sm text-neutral-500">
              {getModeLabel(prompt.mode)} · {new Date(prompt.timestamp).toLocaleDateString()}
            </p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="btn-ghost inline-flex items-center gap-2"
          >
            <Home className="h-4 w-4" />
            Home
          </button>
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
            <button
              onClick={handleCopy}
              className="btn-ghost text-sm inline-flex items-center gap-2"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="text-green-600">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy
                </>
              )}
            </button>
          </div>
          <div className="bg-white rounded-lg border border-neutral-200 p-6">
            <p className="text-neutral-700 whitespace-pre-wrap font-medium">
              {prompt.output}
            </p>
          </div>
        </div>

        {/* Quality Score */}
        {prompt.score && (
          <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-neutral-200">
            <span className="text-sm text-neutral-500">Quality Score:</span>
            <span className="text-sm font-semibold text-neutral-800">
              {prompt.score}/100
            </span>
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
