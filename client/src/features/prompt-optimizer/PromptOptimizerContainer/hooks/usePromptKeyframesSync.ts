import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { KeyframeTile } from '@components/ToolSidebar/types';
import type { PromptKeyframe } from '@features/prompt-optimizer/types/domain/prompt-session';
import type { PromptHistory } from '../../context/types';
import { areKeyframesEqual, hydrateKeyframes, serializeKeyframes } from '../../utils/keyframeTransforms';

type UsePromptKeyframesSyncParams = {
  keyframes: KeyframeTile[];
  setKeyframes: (tiles: KeyframeTile[] | null | undefined) => void;
  setStartFrame: (tile: KeyframeTile | null) => void;
  currentPromptUuid: string | null | undefined;
  currentPromptDocId: string | null | undefined;
  promptHistory: Pick<PromptHistory, 'history' | 'updateEntryPersisted'>;
};

export type UsePromptKeyframesSyncResult = {
  serializedKeyframes: PromptKeyframe[];
  onLoadKeyframes: (stored: PromptKeyframe[] | null | undefined) => void;
};

export function usePromptKeyframesSync({
  keyframes,
  setKeyframes,
  setStartFrame,
  currentPromptUuid,
  currentPromptDocId,
  promptHistory,
}: UsePromptKeyframesSyncParams): UsePromptKeyframesSyncResult {
  const { history, updateEntryPersisted } = promptHistory;
  const keyframesRef = useRef<KeyframeTile[]>(keyframes);
  const keyframeSessionRef = useRef<{ uuid: string | null; docId: string | null }>({
    uuid: currentPromptUuid ?? null,
    docId: currentPromptDocId ?? null,
  });
  const localWritePendingRef = useRef(false);

  useEffect(() => {
    keyframesRef.current = keyframes;
  }, [keyframes]);

  useEffect(() => {
    if (localWritePendingRef.current) {
      localWritePendingRef.current = false;
      return;
    }
    if (!currentPromptUuid) {
      if (keyframesRef.current.length) {
        setKeyframes([]);
      }
      return;
    }
    const entry = history.find((item) => item.uuid === currentPromptUuid);
    if (!entry) {
      if (keyframesRef.current.length) {
        setKeyframes([]);
      }
      return;
    }
    const nextKeyframes = hydrateKeyframes(entry.keyframes ?? []);
    if (areKeyframesEqual(nextKeyframes, keyframesRef.current)) return;
    setKeyframes(nextKeyframes);
  }, [currentPromptUuid, history, setKeyframes]);

  useEffect(() => {
    if (!currentPromptUuid) {
      keyframeSessionRef.current = { uuid: null, docId: null };
      return;
    }
    keyframeSessionRef.current = {
      uuid: currentPromptUuid,
      docId: currentPromptDocId ?? null,
    };
  }, [keyframes, currentPromptUuid, currentPromptDocId]);

  useEffect(() => {
    const { uuid, docId } = keyframeSessionRef.current;
    if (!uuid) return;
    const entry = history.find((item) => item.uuid === uuid);
    if (!entry) return;
    const serialized = serializeKeyframes(keyframes);
    if (areKeyframesEqual(serialized, entry.keyframes ?? [])) return;
    localWritePendingRef.current = true;
    updateEntryPersisted(uuid, docId, { keyframes: serialized });
  }, [keyframes, history, updateEntryPersisted]);

  const serializedKeyframes = useMemo(() => serializeKeyframes(keyframes), [keyframes]);

  const onLoadKeyframes = useCallback(
    (stored: PromptKeyframe[] | null | undefined) => {
      const hydrated = hydrateKeyframes(stored);
      setKeyframes(hydrated);
      setStartFrame(hydrated[0] ?? null);
    },
    [setKeyframes, setStartFrame]
  );

  return { serializedKeyframes, onLoadKeyframes };
}
