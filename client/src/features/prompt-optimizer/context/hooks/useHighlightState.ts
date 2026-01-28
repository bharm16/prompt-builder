import { useCallback, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { HighlightSnapshot, StateSnapshot } from '../types';

export function useHighlightState(): {
  initialHighlights: HighlightSnapshot | null;
  setInitialHighlights: (highlights: HighlightSnapshot | null) => void;
  initialHighlightsVersion: number;
  setInitialHighlightsVersion: (version: number) => void;
  canUndo: boolean;
  setCanUndo: (canUndo: boolean) => void;
  canRedo: boolean;
  setCanRedo: (canRedo: boolean) => void;
  latestHighlightRef: MutableRefObject<HighlightSnapshot | null>;
  persistedSignatureRef: MutableRefObject<string | null>;
  undoStackRef: MutableRefObject<StateSnapshot[]>;
  redoStackRef: MutableRefObject<StateSnapshot[]>;
  applyInitialHighlightSnapshot: (
    snapshot: HighlightSnapshot | null,
    options?: { bumpVersion?: boolean; markPersisted?: boolean }
  ) => void;
  resetEditStacks: () => void;
} {
  const [initialHighlights, setInitialHighlights] = useState<HighlightSnapshot | null>(null);
  const [initialHighlightsVersion, setInitialHighlightsVersion] = useState<number>(0);
  const [canUndo, setCanUndo] = useState<boolean>(false);
  const [canRedo, setCanRedo] = useState<boolean>(false);

  const latestHighlightRef = useRef<HighlightSnapshot | null>(null);
  const persistedSignatureRef = useRef<string | null>(null);
  const undoStackRef = useRef<StateSnapshot[]>([]);
  const redoStackRef = useRef<StateSnapshot[]>([]);

  const applyInitialHighlightSnapshot = useCallback(
    (
      snapshot: HighlightSnapshot | null,
      { bumpVersion = false, markPersisted = false }: { bumpVersion?: boolean; markPersisted?: boolean } = {}
    ): void => {
      setInitialHighlights(snapshot ?? null);
      if (bumpVersion) {
        setInitialHighlightsVersion((prev) => prev + 1);
      }
      latestHighlightRef.current = snapshot ?? null;
      if (markPersisted) {
        persistedSignatureRef.current = snapshot?.signature ?? null;
      }
    },
    [setInitialHighlights, setInitialHighlightsVersion]
  );

  const resetEditStacks = useCallback((): void => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    setCanUndo(false);
    setCanRedo(false);
  }, [setCanUndo, setCanRedo]);

  return {
    initialHighlights,
    setInitialHighlights,
    initialHighlightsVersion,
    setInitialHighlightsVersion,
    canUndo,
    setCanUndo,
    canRedo,
    setCanRedo,
    latestHighlightRef,
    persistedSignatureRef,
    undoStackRef,
    redoStackRef,
    applyInitialHighlightSnapshot,
    resetEditStacks,
  };
}
