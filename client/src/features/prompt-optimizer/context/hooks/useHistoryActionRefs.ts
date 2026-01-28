import { useRef } from 'react';
import type { MutableRefObject } from 'react';

export function useHistoryActionRefs(): {
  isApplyingHistoryRef: MutableRefObject<boolean>;
  skipLoadFromUrlRef: MutableRefObject<boolean>;
} {
  const isApplyingHistoryRef = useRef<boolean>(false);
  const skipLoadFromUrlRef = useRef<boolean>(false);

  return { isApplyingHistoryRef, skipLoadFromUrlRef };
}
