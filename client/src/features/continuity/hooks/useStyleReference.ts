import { useMemo } from 'react';
import type { ContinuitySession, ContinuityShot, StyleReference } from '../types';

export function useStyleReference(
  session: ContinuitySession | null,
  shot?: ContinuityShot | null
): StyleReference | null {
  return useMemo(() => {
    if (!session) return null;
    if (!shot) return session.primaryStyleReference;
    if (!shot.styleReferenceId) {
      return session.primaryStyleReference;
    }
    const refShot = session.shots.find((candidate) => candidate.id === shot.styleReferenceId);
    if (refShot?.styleReference) {
      return refShot.styleReference;
    }
    return session.primaryStyleReference;
  }, [session, shot]);
}

export default useStyleReference;
