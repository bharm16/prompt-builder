import { useMemo } from 'react';
import type { PromptContext } from '@utils/PromptContext/PromptContext';

export function useStablePromptContext(
  promptContext: PromptContext | null | undefined
): PromptContext | null {
  return useMemo(() => {
    if (!promptContext) return null;
    return promptContext;
  }, [promptContext]);
}
