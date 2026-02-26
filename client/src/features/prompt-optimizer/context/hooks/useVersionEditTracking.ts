import { useCallback, useRef } from 'react';
import type { MutableRefObject } from 'react';
import type { PromptVersionEdit } from '@features/prompt-optimizer/types/domain/prompt-session';

export function useVersionEditTracking(): {
  versionEditCountRef: MutableRefObject<number>;
  versionEditsRef: MutableRefObject<PromptVersionEdit[]>;
  registerPromptEdit: (payload: {
    previousText: string;
    nextText: string;
    source?: PromptVersionEdit['source'];
  }) => void;
  resetVersionEdits: () => void;
} {
  const versionEditCountRef = useRef<number>(0);
  const versionEditsRef = useRef<PromptVersionEdit[]>([]);

  const registerPromptEdit = useCallback(
    ({
      previousText,
      nextText,
      source = 'unknown',
    }: {
      previousText: string;
      nextText: string;
      source?: PromptVersionEdit['source'];
    }): void => {
      if (previousText === nextText) return;
      versionEditCountRef.current += 1;
      versionEditsRef.current.push({
        timestamp: new Date().toISOString(),
        delta: nextText.length - previousText.length,
        source,
      });
      if (versionEditsRef.current.length > 50) {
        versionEditsRef.current.shift();
      }
    },
    []
  );

  const resetVersionEdits = useCallback((): void => {
    versionEditCountRef.current = 0;
    versionEditsRef.current = [];
  }, []);

  return {
    versionEditCountRef,
    versionEditsRef,
    registerPromptEdit,
    resetVersionEdits,
  };
}
