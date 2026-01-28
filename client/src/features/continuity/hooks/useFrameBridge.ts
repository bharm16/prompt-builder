import { useMemo } from 'react';
import type { ContinuityShot, FrameBridge } from '../types';

export function useFrameBridge(shot?: ContinuityShot | null): FrameBridge | null {
  return useMemo(() => shot?.frameBridge ?? null, [shot]);
}

export default useFrameBridge;
