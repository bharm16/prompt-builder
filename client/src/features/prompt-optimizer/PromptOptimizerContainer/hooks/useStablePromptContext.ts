import { useMemo } from 'react';
import type { PromptContext } from '@utils/PromptContext/PromptContext';

export function useStablePromptContext(
  promptContext: PromptContext | null | undefined
): PromptContext | null {
  return useMemo(() => {
    if (!promptContext) return null;
    return promptContext;
  }, [
    promptContext?.elements?.subject,
    promptContext?.elements?.action,
    promptContext?.elements?.location,
    promptContext?.elements?.time,
    promptContext?.elements?.mood,
    promptContext?.elements?.style,
    promptContext?.elements?.event,
    promptContext?.metadata?.format,
    promptContext?.version,
  ]);
}
