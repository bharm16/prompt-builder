import { useState, useEffect, useMemo } from 'react';
import { getPromptRepository } from '../../../repositories';
import { PromptContext } from '../../../utils/PromptContext';
import { escapeHTMLForMLHighlighting } from '../../../features/prompt-optimizer/utils/textFormatting';
import { logger } from '../../../services/LoggingService';
import { useDebugLogger } from '../../../hooks/useDebugLogger';
import { useToast } from '../../Toast';
import type { PromptData } from '../types';

interface UseSharedPromptProps {
  uuid: string | undefined;
}

interface UseSharedPromptReturn {
  prompt: PromptData | null;
  promptContext: PromptContext | null;
  loading: boolean;
  error: string | null;
  copied: boolean;
  formattedOutput: { html: string };
  handleCopy: () => Promise<void>;
}

export function useSharedPrompt({ uuid }: UseSharedPromptProps): UseSharedPromptReturn {
  const debug = useDebugLogger('SharedPrompt', { uuid });
  const toast = useToast();
  const [prompt, setPrompt] = useState<PromptData | null>(null);
  const [promptContext, setPromptContext] = useState<PromptContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchPrompt = async (): Promise<void> => {
      debug.logEffect('Fetching shared prompt', [uuid]);
      debug.startTimer('fetchPrompt');
      
      if (!uuid) {
        setError('Invalid prompt ID');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const promptRepository = getPromptRepository();
        const promptData = (await promptRepository.getByUuid(uuid)) as PromptData | null;
        
        if (promptData) {
          setPrompt(promptData);
          debug.endTimer('fetchPrompt', 'Prompt loaded successfully');
          
          if (promptData.brainstormContext) {
            try {
              const contextData =
                typeof promptData.brainstormContext === 'string'
                  ? JSON.parse(promptData.brainstormContext)
                  : promptData.brainstormContext;
              const restoredContext = PromptContext.fromJSON(contextData);
              setPromptContext(restoredContext);
              debug.logAction('contextRestored');
            } catch (contextError) {
              logger.error('Failed to restore prompt context from shared prompt', contextError as Error, {
                component: 'SharedPrompt',
                operation: 'fetchPrompt',
                uuid,
              });
              setPromptContext(null);
              toast.warning('Some context data could not be loaded. The prompt will still display.');
            }
          } else {
            setPromptContext(null);
          }
        } else {
          debug.endTimer('fetchPrompt');
          debug.logAction('promptNotFound', { uuid });
          setError('Prompt not found');
          setPromptContext(null);
        }
      } catch (err) {
        debug.endTimer('fetchPrompt');
        logger.error('Error fetching prompt', err as Error, {
          component: 'SharedPrompt',
          operation: 'fetchPrompt',
          uuid,
        });
        setError('Failed to load prompt');
        setPromptContext(null);
      } finally {
        setLoading(false);
      }
    };

    fetchPrompt();
  }, [uuid, toast, debug]);

  const formattedOutput = useMemo<{ html: string }>(() => {
    if (!prompt?.output) {
      return { html: '' };
    }

    return { html: escapeHTMLForMLHighlighting(prompt.output) };
  }, [prompt?.output]);

  const handleCopy = async (): Promise<void> => {
    if (!prompt?.output) return;

    debug.logAction('copy', { outputLength: prompt.output.length });
    try {
      await navigator.clipboard.writeText(prompt.output);
      setCopied(true);
      toast.success('Copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy');
    }
  };

  return {
    prompt,
    promptContext,
    loading,
    error,
    copied,
    formattedOutput,
    handleCopy,
  };
}
