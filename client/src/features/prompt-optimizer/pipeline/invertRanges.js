const sortRanges = (ranges) =>
  [...ranges]
    .filter(range => typeof range.start === 'number' && typeof range.end === 'number')
    .map(range => ({
      start: Math.max(0, range.start),
      end: Math.max(0, Math.max(range.start, range.end)),
    }))
    .sort((a, b) => a.start - b.start || a.end - b.end);

export const mergeRanges = (ranges) => {
  const sorted = sortRanges(ranges);
  if (!sorted.length) return [];

  const merged = [sorted[0]];
  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i];
    const last = merged[merged.length - 1];
    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push({ ...current });
    }
  }
  return merged;
};

export const invertRanges = (ranges, totalLength) => {
  const merged = mergeRanges(ranges);
  const limit = Math.max(0, totalLength);
  if (!merged.length) {
    return limit > 0 ? [{ start: 0, end: limit }] : [];
  }

  const inverted = [];
  let cursor = 0;
  merged.forEach((range) => {
    const { start, end } = range;
    if (cursor < start) {
      inverted.push({ start: cursor, end: Math.min(start, limit) });
    }
    cursor = Math.max(cursor, end);
  });
  if (cursor < limit) {
    inverted.push({ start: cursor, end: limit });
  }
  return inverted.filter(range => range.end > range.start);
};

