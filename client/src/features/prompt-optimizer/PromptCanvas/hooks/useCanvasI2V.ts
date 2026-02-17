import { useMemo, useState } from 'react';

interface CanvasI2VParams {
  i2vContext?: any;
  showI2VLockIndicator: boolean;
  resolvedI2VReason: string | null;
  i2vMotionAlternatives: any[];
  handleLockedAlternativeClick: (value: any) => void;
}

export function useCanvasI2V({
  i2vContext,
  showI2VLockIndicator,
  resolvedI2VReason,
  i2vMotionAlternatives,
  handleLockedAlternativeClick,
}: CanvasI2VParams) {
  const isI2VMode = Boolean(i2vContext?.isI2VMode);
  const [constraintMode, setConstraintMode] = useState<'none' | 'locked'>('none');

  const effectiveConstraintMode = useMemo(() => {
    if (!isI2VMode) {
      return 'none' as const;
    }
    if (showI2VLockIndicator) {
      return 'locked' as const;
    }
    return constraintMode;
  }, [constraintMode, isI2VMode, showI2VLockIndicator]);

  const lockedSpanIndicators = useMemo(
    () => ({
      showI2VLockIndicator,
      reason: resolvedI2VReason,
    }),
    [resolvedI2VReason, showI2VLockIndicator]
  );

  return {
    isI2VMode,
    constraintMode: effectiveConstraintMode,
    setConstraintMode,
    lockedSpanIndicators,
    motionAlternatives: i2vMotionAlternatives,
    handleLockedAlternativeClick,
    i2vContext,
  };
}
