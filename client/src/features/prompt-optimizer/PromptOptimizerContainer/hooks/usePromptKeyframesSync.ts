import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { KeyframeTile } from '@components/ToolSidebar/types';
import type { PromptKeyframe } from '@hooks/types';
import type { PromptHistory } from '../../context/types';
import { areKeyframesEqual, hydrateKeyframes, serializeKeyframes } from '../../utils/keyframeTransforms';

type UsePromptKeyframesSyncParams = {
  keyframes: KeyframeTile[];
  setKeyframes: (tiles: KeyframeTile[] | null | undefined) => void;
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
  currentPromptUuid,
  currentPromptDocId,
  promptHistory,
}: UsePromptKeyframesSyncParams): UsePromptKeyframesSyncResult {
  const keyframesRef = useRef<KeyframeTile[]>(keyframes);
  const keyframeSessionRef = useRef<{ uuid: string | null; docId: string | null }>({
    uuid: currentPromptUuid ?? null,
    docId: currentPromptDocId ?? null,
  });

  useEffect(() => {
    keyframesRef.current = keyframes;
  }, [keyframes]);

  useEffect(() => {
    if (!currentPromptUuid) {
      if (keyframesRef.current.length) {
        setKeyframes([]);
      }
      return;
    }
    const entry = promptHistory.history.find((item) => item.uuid === currentPromptUuid);
    if (!entry) {
      if (keyframesRef.current.length) {
        setKeyframes([]);
      }
      return;
    }
    const nextKeyframes = hydrateKeyframes(entry.keyframes ?? []);
    if (areKeyframesEqual(nextKeyframes, keyframesRef.current)) return;
    setKeyframes(nextKeyframes);
  }, [currentPromptUuid, promptHistory.history, setKeyframes]);

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
    const entry = promptHistory.history.find((item) => item.uuid === uuid);
    if (!entry) return;
    const serialized = serializeKeyframes(keyframes);
    if (areKeyframesEqual(serialized, entry.keyframes ?? [])) return;
    promptHistory.updateEntryPersisted(uuid, docId, { keyframes: serialized });
  }, [keyframes, promptHistory.history, promptHistory.updateEntryPersisted]);

  const serializedKeyframes = useMemo(() => serializeKeyframes(keyframes), [keyframes]);

  const onLoadKeyframes = useCallback(
    (stored: PromptKeyframe[] | null | undefined) => {
      setKeyframes(hydrateKeyframes(stored));
    },
    [setKeyframes]
  );

  return { serializedKeyframes, onLoadKeyframes };
}
