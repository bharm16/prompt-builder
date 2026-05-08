export interface ClampedSpan {
  start: number;
  end: number;
}

export function clampSpanRange(
  start: number,
  end: number,
  textLength: number,
): ClampedSpan | null {
  if (!Number.isFinite(start) || !Number.isFinite(end) || textLength <= 0) {
    return null;
  }
  const safeStart = Math.max(0, Math.min(Math.floor(start), textLength));
  const safeEnd = Math.max(safeStart, Math.min(Math.floor(end), textLength));
  if (safeEnd <= safeStart) return null;
  return { start: safeStart, end: safeEnd };
}
